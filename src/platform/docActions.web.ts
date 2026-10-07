import { RECEIPT_PAGE_STYLE } from '../pdf/receipt';

/** In a browser the document can be printed or saved as a PDF, but not handed to WhatsApp as a file. */
export const IS_PHONE = false;

/** Paper size in millimetres, for pages that are not A4 (a thermal receipt). */
export interface PageSize {
  widthMm: number;
  heightMm: number;
}

export async function printDoc(html: string, page?: PageSize): Promise<void> {
  const frame = document.createElement('iframe');
  // A receipt's frame is as wide as the roll, so its length can be measured before printing.
  frame.style.cssText = `position:fixed;right:0;bottom:0;width:${page ? `${page.widthMm}mm` : '0'};height:0;border:0;visibility:hidden`;
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
    if (page) {
      // A receipt is one long page. Now that it is laid out, give the printer its real length
      // in place of the estimate, so no blank paper is fed after the last line.
      const style = win.document.getElementById(RECEIPT_PAGE_STYLE);
      const heightMm = Math.ceil((win.document.body.scrollHeight * 25.4) / 96) + 4;
      if (style) style.textContent = `@page { size: ${page.widthMm}mm ${heightMm}mm; margin: 0; }`;
    }
    win.focus();
    win.print();
  }
  setTimeout(() => frame.remove(), 60_000);
}

export async function sharePdf(html: string, _fileName: string, page?: PageSize): Promise<boolean> {
  await printDoc(html, page);
  return true;
}

export async function shareImage(_view: unknown, _fileName: string): Promise<boolean> {
  return false;
}

export function openWhatsappText(number: string, text: string): void {
  window.open(`https://wa.me/${number}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
}
