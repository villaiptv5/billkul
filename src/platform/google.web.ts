/** In a browser the Drive backup is not offered yet: the web version keeps using backup files. */
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
export const GOOGLE_AVAILABLE = false;

export async function chooseGoogleAccount(_clientId: string): Promise<{ email: string } | null> {
  return null;
}

export async function googleToken(_clientId: string): Promise<string | null> {
  return null;
}

export async function forgetGoogleToken(_token: string): Promise<void> {}

export async function leaveGoogle(_clientId: string): Promise<void> {}
