import { GoogleSignin } from '@react-native-google-signin/google-signin';

/** Only the files BillKul makes itself: Google classes this as a non-sensitive permission. */
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

/** Google sign-in for the Drive backup works in the phone app; the web version keeps backup files. */
export const GOOGLE_AVAILABLE = true;

let configuredFor = '';

function setUp(clientId: string) {
  if (configuredFor === clientId) return;
  GoogleSignin.configure({ webClientId: clientId, scopes: [DRIVE_SCOPE] });
  configuredFor = clientId;
}

/** Google's own window for choosing the account and allowing the Drive backup. Null when the person backs out. */
export async function chooseGoogleAccount(clientId: string): Promise<{ email: string } | null> {
  setUp(clientId);
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const result = await GoogleSignin.signIn();
  if (result.type !== 'success') return null;
  if (!result.data.scopes.includes(DRIVE_SCOPE)) {
    const more = await GoogleSignin.addScopes({ scopes: [DRIVE_SCOPE] });
    if (!more || more.type !== 'success') return null;
  }
  return { email: result.data.user.email };
}

/** A fresh access token for the chosen account, without asking anything; null when it must be chosen again. */
export async function googleToken(clientId: string): Promise<string | null> {
  setUp(clientId);
  try {
    const silent = await GoogleSignin.signInSilently();
    if (silent.type !== 'success') return null;
    return (await GoogleSignin.getTokens()).accessToken;
  } catch {
    return null;
  }
}

export async function forgetGoogleToken(token: string): Promise<void> {
  try {
    await GoogleSignin.clearCachedAccessToken(token);
  } catch {
    // the next request asks again either way
  }
}

/** Stops the Drive backup: BillKul gives back its permission to the Drive. */
export async function leaveGoogle(clientId: string): Promise<void> {
  setUp(clientId);
  try {
    await GoogleSignin.revokeAccess();
  } catch {
    // already gone
  }
  try {
    await GoogleSignin.signOut();
  } catch {
    // already gone
  }
}
