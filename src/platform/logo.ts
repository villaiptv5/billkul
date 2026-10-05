import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

/**
 * Picks a logo from the gallery and shrinks it to 256 px wide.
 * The result is a data URI, so the logo travels inside backups and PDFs.
 */
export async function pickLogo(): Promise<string | null> {
  const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 1 });
  if (picked.canceled || !picked.assets?.length) return null;
  const rendered = await ImageManipulator.manipulate(picked.assets[0].uri).resize({ width: 256 }).renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.PNG, base64: true });
  return saved.base64 ? `data:image/png;base64,${saved.base64}` : null;
}
