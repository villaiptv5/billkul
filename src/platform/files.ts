import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/** Writes the backup and opens the share menu, so it can go to Drive, WhatsApp or email. */
export async function saveBackupFile(fileName: string, json: string): Promise<boolean> {
  const file = new File(Paths.cache, fileName);
  if (file.exists) file.delete();
  file.create();
  file.write(json);
  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json', dialogTitle: fileName });
  return true;
}

/** Lets the user choose a backup file. Returns its text, or null if they cancelled. */
export async function pickBackupFile(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'application/octet-stream', 'text/plain', '*/*'], copyToCacheDirectory: true });
  if (result.canceled || !result.assets?.length) return null;
  return await new File(result.assets[0].uri).text();
}
