/**
 * Google sign-in for the Drive backup in the web version, with Google Identity Services: Google's own
 * window lets the shop owner choose the account and allow the backup. Google gives a browser a token
 * for about an hour; while it lasts, backups run by themselves. After that the next backup waits until
 * the owner taps to continue (Google does not let a page open its window without a tap).
 */
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
export const GOOGLE_AVAILABLE = true;

const SCRIPT = 'https://accounts.google.com/gsi/client';
const KEY = 'bk1:gtoken';

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
}
interface TokenClient {
  requestAccessToken(options?: { prompt?: string; login_hint?: string }): void;
}
interface GoogleOAuth {
  initTokenClient(config: { client_id: string; scope: string; callback: (r: TokenResponse) => void; error_callback?: (e: unknown) => void }): TokenClient;
  hasGrantedAllScopes(r: TokenResponse, ...scopes: string[]): boolean;
  revoke(token: string, done?: () => void): void;
}
declare global {
  interface Window {
    google?: { accounts?: { oauth2?: GoogleOAuth } };
  }
}

interface Saved {
  token: string;
  /** ms since 1970 when Google stops taking it. */
  until: number;
  email: string;
}

function readSaved(): Saved | null {
  try {
    const saved = JSON.parse(window.localStorage.getItem(KEY) ?? 'null') as Saved | null;
    return saved && saved.token ? saved : null;
  } catch {
    return null;
  }
}
function writeSaved(saved: Saved | null) {
  try {
    if (saved) window.localStorage.setItem(KEY, JSON.stringify(saved));
    else window.localStorage.removeItem(KEY);
  } catch {
    // the token then lasts only for this page
  }
  memory = saved;
}
let memory: Saved | null = null;

let loading: Promise<GoogleOAuth> | null = null;
function oauth(): Promise<GoogleOAuth> {
  const ready = window.google?.accounts?.oauth2;
  if (ready) return Promise.resolve(ready);
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = SCRIPT;
      script.async = true;
      script.onload = () => (window.google?.accounts?.oauth2 ? resolve(window.google.accounts.oauth2) : reject(new Error('no google')));
      script.onerror = () => {
        loading = null;
        reject(new Error('offline'));
      };
      document.head.appendChild(script);
    });
  }
  return loading;
}

/** Asks Google for a token in its own window; must run from a tap. */
async function askGoogle(clientId: string, hint: string): Promise<TokenResponse | null> {
  const google = await oauth();
  return new Promise((resolve) => {
    const client = google.initTokenClient({
      client_id: clientId,
      scope: `${DRIVE_SCOPE} email`,
      callback: (r) => resolve(r.access_token ? r : null),
      error_callback: () => resolve(null),
    });
    client.requestAccessToken(hint ? { prompt: '', login_hint: hint } : { prompt: 'select_account' });
  });
}

/** Google's window for choosing the account and allowing the Drive backup. Null when the person backs out. */
export async function chooseGoogleAccount(clientId: string): Promise<{ email: string } | null> {
  const known = (memory ?? readSaved())?.email ?? '';
  const answer = await askGoogle(clientId, known);
  if (!answer?.access_token) return null;
  const google = await oauth();
  if (!google.hasGrantedAllScopes(answer, DRIVE_SCOPE)) return null;
  let email = known;
  try {
    const me = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${answer.access_token}` } });
    if (me.ok) email = ((await me.json()) as { email?: string }).email ?? email;
  } catch {
    // the backup still works without showing the address
  }
  writeSaved({ token: answer.access_token, until: Date.now() + (answer.expires_in ?? 3600) * 1000, email: email || 'Google Drive' });
  return { email: email || 'Google Drive' };
}

/** The token from the last time the account was chosen, while Google still takes it; null when a tap is needed. */
export async function googleToken(_clientId: string): Promise<string | null> {
  const saved = memory ?? readSaved();
  if (!saved || saved.until - 60_000 < Date.now()) return null;
  memory = saved;
  return saved.token;
}

export async function forgetGoogleToken(token: string): Promise<void> {
  const saved = memory ?? readSaved();
  if (saved && saved.token === token) writeSaved({ ...saved, token: '', until: 0 });
}

/** Stops the Drive backup: BillKul gives back its permission to the Drive. */
export async function leaveGoogle(_clientId: string): Promise<void> {
  const saved = memory ?? readSaved();
  writeSaved(null);
  if (!saved?.token) return;
  try {
    (await oauth()).revoke(saved.token);
  } catch {
    // already gone
  }
}
