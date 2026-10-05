/** In a browser the document can be printed or saved as a PDF, but not handed to WhatsApp as a file. */
export const IS_PHONE = false;

export async function printDoc(html: string): Promise<void> {
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  frame.setAttribute('aria-hidden', 'true');
  document.body.appendChild(frame);
  await new Promise<void>((resolve) => {
    frame.onload = () => resolve();
    frame.srcdoc = html;
  });
  const win = frame.contentWindow;
  if (win) {
    // Give web fonts a moment so the printout matches the preview.
    const fonts = (win.document as Document & { fonts?: { ready: Promise<unknown> } }).fonts;
    await Promise.race([fonts?.ready ?? Promise.resolve(), new Promise((r) => setTimeout(r, 1500))]);
    win.focus();
    win.print();
  }
  setTimeout(() => frame.remove(), 60_000);
}

export async function sharePdf(html: string, _fileName: string): Promise<boolean> {
  await printDoc(html);
  return true;
}

export async function shareImage(_view: unknown, _fileName: string): Promise<boolean> {
  return false;
}

export function openWhatsappText(number: string, text: string): void {
  window.open(`https://wa.me/${number}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
}
