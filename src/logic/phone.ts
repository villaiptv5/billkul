/**
 * A phone number in international form, "+923001234567", or null when it cannot be a mobile number.
 * Pakistani numbers may be typed the local way: 0300 1234567 or 300 1234567.
 * The account server applies the same rule (normalize_phone in server/api/lib.php); keep the two alike.
 */
export function normalizePhone(raw: string): string | null {
  const text = raw.trim();
  let plus = text.startsWith('+');
  let digits = text.replace(/\D+/g, '');
  if (!digits) return null;
  if (!plus && digits.startsWith('00')) {
    digits = digits.slice(2);
    plus = true;
  }
  if (!plus) {
    if (/^03\d{9}$/.test(digits)) digits = `92${digits.slice(1)}`;
    else if (/^3\d{9}$/.test(digits)) digits = `92${digits}`;
    else if (!/^92\d+$/.test(digits)) return null;
  }
  if (digits.startsWith('92')) return /^923\d{9}$/.test(digits) ? `+${digits}` : null;
  return /^[1-9]\d{7,14}$/.test(digits) ? `+${digits}` : null;
}

/** The country code and the rest, joined the way the sign-in form holds them: "+92" and "300 1234567". */
export function joinPhone(countryCode: string, number: string): string | null {
  const code = countryCode.replace(/\D+/g, '');
  const rest = number.replace(/\D+/g, '').replace(/^0+/, '');
  if (!code || !rest) return null;
  return normalizePhone(`+${code}${rest}`);
}

/** "+92 300 1234567": easier to check by eye than a run of twelve digits. */
export function showPhone(phone: string): string {
  const pk = /^\+92(\d{3})(\d{7})$/.exec(phone);
  return pk ? `+92 ${pk[1]} ${pk[2]}` : phone;
}

/** A Pakistani number the way a shop prints it, "0300 1234567"; other numbers stay international. */
export function localPhone(phone: string): string {
  const pk = /^\+92(\d{3})(\d{7})$/.exec(phone);
  return pk ? `0${pk[1]} ${pk[2]}` : phone;
}

/**
 * Keeps a number in its own left-to-right island inside a sentence. Without it an Urdu sentence
 * shows "+92 300 1234567" as "1234567 300 92+", because each group of digits is placed right to left.
 */
export function ltr(text: string): string {
  return `\u2066${text}\u2069`;
}
