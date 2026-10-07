/** What Nastaliq (Urdu) text needs that Latin text does not. Plain rules with no platform code, so they can be tested. */

const URDU_SCRIPT = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/;

export function hasUrduScript(text: string): boolean {
  return URDU_SCRIPT.test(text);
}

/** Nastaliq letters are drawn small for their size, so Urdu is set a little larger than Latin text. */
export function urduSize(size: number): number {
  return Math.max(13, Math.round(size * 1.1 * 2) / 2);
}

/**
 * Room for Nastaliq strokes that reach outside the line.
 *
 * Measured from the font: a word such as "کیش" rises 2.1 em above the baseline and some words drop
 * 0.7 em below it, while a line twice the Latin size only covers about 1.6 em up and 0.25 em down.
 * Both the phone and the browser cut whatever falls outside the text box, which turned "کیش" into "لیش".
 * Padding widens the box and an equal negative margin keeps the layout where it was.
 */
export function nastaliqRoom(fontSize: number): { top: number; bottom: number; start: number; end: number } {
  return { top: Math.ceil(fontSize * 0.8), bottom: Math.ceil(fontSize * 0.45), start: Math.ceil(fontSize * 0.5), end: Math.ceil(fontSize * 0.25) };
}

/**
 * On the phone, sideways room has to be part of the text itself: Android cuts letters at the edge of
 * the text, not of its padding, and on Android 15 and later it wraps a word whose strokes do not fit.
 * The first stroke of "ک" reaches 0.45 em before the word and a final "ر" 0.2 em after it;
 * a no-break space in this font is 0.15 em wide.
 */
export const NASTALIQ_LEAD = '\u00A0\u00A0\u00A0';
export const NASTALIQ_TAIL = '\u00A0\u00A0';

const LATIN_RUN = /[A-Za-z0-9](?:[A-Za-z0-9 .,:/+%#&()'-]*[A-Za-z0-9%)])?/g;

/** Splits mixed text into Urdu and Latin runs, so the phone can set digits and English words in the Latin face. */
export function splitLatin(text: string): { text: string; latin: boolean }[] {
  const runs: { text: string; latin: boolean }[] = [];
  let at = 0;
  for (const match of text.matchAll(LATIN_RUN)) {
    if (match.index > at) runs.push({ text: text.slice(at, match.index), latin: false });
    runs.push({ text: match[0], latin: true });
    at = match.index + match[0].length;
  }
  if (at < text.length) runs.push({ text: text.slice(at), latin: false });
  return runs;
}
