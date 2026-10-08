import * as Application from 'expo-application';
import { Platform } from 'react-native';

let cached: string | null = null;

/**
 * The ID Android gives this app on this phone. It stays the same after the app is reinstalled or its
 * data cleared, so the account server can tell when another number signs in on a phone that already
 * used its free allowance. The server keeps only a one-way fingerprint of it. '' when there is none.
 */
export async function deviceId(): Promise<string> {
  if (cached !== null) return cached;
  let id: string | null = null;
  try {
    id = Platform.OS === 'android' ? Application.getAndroidId() : Platform.OS === 'ios' ? await Application.getIosIdForVendorAsync() : null;
  } catch {
    id = null;
  }
  cached = id && /^[A-Za-z0-9_-]{8,128}$/.test(id) ? id : '';
  return cached;
}
