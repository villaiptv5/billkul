// Brand colours from the BillKul "Checked B" logo.
export const C = {
  ink: '#0B1F17',
  inkPanel: '#15301F',
  inkLine: '#24382F',
  green: '#00D27A',
  greenDeep: '#00995A',
  greenText: '#007A48',
  greenDark: '#00603A',
  tintGreen: '#E6F8EF',
  mint: '#8FE6BF',
  bg: '#F4F7F5',
  bgDeep: '#E9EFEC',
  surface: '#FFFFFF',
  line: '#DCE5E0',
  lineSoft: '#E6ECE8',
  border: '#C5D2CB',
  borderStrong: '#8FA59A',
  muted: '#51635A',
  onInk: '#FFFFFF',
  onInkSoft: '#C9D8D0',
  onInkMuted: '#B8CCC2',
  danger: '#B42318',
  dangerTint: '#FDECEA',
  orange: '#8A3A00',
  orangeOnInk: '#FFB877',
} as const;

export type StatusTone = { bg: string; fg: string };

export const STATUS_TONES: Record<string, StatusTone> = {
  draft: { bg: '#E6ECE8', fg: '#3D4D45' },
  sent: { bg: '#E1ECFF', fg: '#1E40AF' },
  accepted: { bg: '#D5F1EE', fg: '#0A5A54' },
  due: { bg: '#FFE7D1', fg: '#8A3A00' },
  paid: { bg: '#D8F5E6', fg: '#00603A' },
};

export const R = { sm: 10, md: 12, lg: 14, xl: 16 } as const;
