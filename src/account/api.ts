import { Platform } from 'react-native';
import { API_URL } from '../config';
import type { Usage } from '../data/types';

/** What the account server says about an account (account_view in server/api/lib.php). */
export interface AccountView {
  phone: string;
  plan: 'free' | 'pro';
  proUntil: string;
  docsUsed: number;
  cashUsed: number;
  limits: Usage;
  supportWhatsapp: string;
}

/**
 * Why a request did not succeed. The words come from the server, except:
 * offline = the server could not be reached; server = it answered with something unexpected.
 */
export type ApiError = 'bad_phone' | 'wait' | 'too_many' | 'bad_code' | 'expired' | 'signed_out' | 'setup' | 'server' | 'offline';

export type ApiResult<T> = ({ ok: true } & T) | { ok: false; error: ApiError; wait?: number; triesLeft?: number };

const APP_VERSION: string = require('../../app.json').expo.version;
const KNOWN: ApiError[] = ['bad_phone', 'wait', 'too_many', 'bad_code', 'expired', 'signed_out', 'setup'];

async function call<T>(route: string, body: Record<string, unknown>): Promise<ApiResult<T>> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 15000);
  try {
    const response = await fetch(`${API_URL}?r=${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: abort.signal });
    const json = (await response.json()) as { ok?: boolean; error?: string; wait?: number; triesLeft?: number };
    if (json && json.ok === true) return json as ApiResult<T>;
    const error = KNOWN.includes(json?.error as ApiError) ? (json.error as ApiError) : 'server';
    return { ok: false, error, wait: json?.wait, triesLeft: json?.triesLeft };
  } catch {
    return { ok: false, error: 'offline' };
  } finally {
    clearTimeout(timer);
  }
}

export interface AccountApi {
  requestCode(phone: string): Promise<ApiResult<{ wait: number; delivery: string }>>;
  verifyCode(phone: string, code: string): Promise<ApiResult<{ token: string; account: AccountView }>>;
  sync(token: string, usage: Usage): Promise<ApiResult<{ account: AccountView }>>;
  logout(token: string): Promise<ApiResult<object>>;
  deleteAccount(token: string): Promise<ApiResult<object>>;
}

const live: AccountApi = {
  requestCode: (phone) => call('auth/request', { phone }),
  verifyCode: (phone, code) => call('auth/verify', { phone, code, device: Platform.OS }),
  sync: (token, usage) => call('account/sync', { token, docsUsed: usage.docs, cashUsed: usage.cash, appVersion: APP_VERSION, platform: Platform.OS }),
  logout: (token) => call('auth/logout', { token }),
  deleteAccount: (token) => call('account/delete', { token }),
};

/**
 * A stand-in server inside the app, for the automated phone check only, where the test phone has no
 * route to a real server. It exists only in a build made with EXPO_PUBLIC_FAKE_SERVER=1; the builds
 * that go to phones and to the website are made without it and always talk to the real server.
 * Any number signs in with the code 123456.
 */
function fake(): AccountApi {
  let seen: Usage = { docs: 0, cash: 0 };
  const view = (phone: string): AccountView => ({ phone, plan: 'free', proUntil: '', docsUsed: seen.docs, cashUsed: seen.cash, limits: { docs: 10, cash: 10 }, supportWhatsapp: '+923001234567' });
  let phoneNow = '';
  return {
    requestCode: async (phone) => {
      phoneNow = phone;
      return { ok: true, wait: 60, delivery: 'test' };
    },
    verifyCode: async (phone, code) => (code === '123456' ? { ok: true, token: 'f'.repeat(64), account: view(phone) } : { ok: false, error: 'bad_code', triesLeft: 4 }),
    sync: async (_token, usage) => {
      seen = { docs: Math.max(seen.docs, usage.docs), cash: Math.max(seen.cash, usage.cash) };
      return { ok: true, account: view(phoneNow) };
    },
    logout: async () => ({ ok: true }),
    deleteAccount: async () => ({ ok: true }),
  };
}

export const api: AccountApi = process.env.EXPO_PUBLIC_FAKE_SERVER === '1' ? fake() : live;
