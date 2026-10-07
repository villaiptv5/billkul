import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Linking } from 'react-native';
import { captureRef } from 'react-native-view-shot';

/** True in the phone app, where documents can be sent as files. */
export const IS_PHONE = true;

/** Paper size in millimetres, for pages that are not A4 (a thermal receipt). */
export interface PageSize {
  widthMm: number;
  heightMm: number;
}

// A4 in points.
const A4 = { width: 595, height: 842 };

function points(page?: PageSize): { width: number; height: number } {
  return page ? { width: Math.round((page.widthMm * 72) / 25.4), height: Math.round((page.heightMm * 72) / 25.4) } : A4;
}

export async function printDoc(html: string, page?: PageSize): Promise<void> {
  await Print.printAsync({ html, ...points(page) });
}

/** Makes the PDF, gives it a readable name, and opens the phone's share menu. */
export async function sharePdf(html: string, fileName: string, page?: PageSize): Promise<boolean> {
  const { uri } = await Print.printToFileAsync({ html, ...points(page) });
  let shareUri = uri;
  try {
    const named = new File(Paths.cache, `${fileName}.pdf`);
    if (named.exists) named.delete();
    await new File(uri).copy(named);
    shareUri = named.uri;
  } catch {
    // The PDF still shares under its temporary name.
  }
  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(shareUri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: fileName });
  return true;
}

/** Captures the preview as a picture and opens the share menu. */
export async function shareImage(view: unknown, fileName: string): Promise<boolean> {
  const uri = await captureRef(view as never, { format: 'png', quality: 1, result: 'tmpfile', fileName });
  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: fileName });
  return true;
}

export function openWhatsappText(number: string, text: string): void {
  void Linking.openURL(`https://wa.me/${number}?text=${encodeURIComponent(text)}`);
}
