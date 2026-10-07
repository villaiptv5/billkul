import { DMSans_400Regular } from '@expo-google-fonts/dm-sans/400Regular';
import { DMSans_500Medium } from '@expo-google-fonts/dm-sans/500Medium';
import { DMSans_600SemiBold } from '@expo-google-fonts/dm-sans/600SemiBold';
import { NotoNastaliqUrdu_400Regular } from '@expo-google-fonts/noto-nastaliq-urdu/400Regular';
import { NotoNastaliqUrdu_600SemiBold } from '@expo-google-fonts/noto-nastaliq-urdu/600SemiBold';
import { NotoNastaliqUrdu_700Bold } from '@expo-google-fonts/noto-nastaliq-urdu/700Bold';
import { Sora_600SemiBold } from '@expo-google-fonts/sora/600SemiBold';
import { Sora_700Bold } from '@expo-google-fonts/sora/700Bold';
import { Platform } from 'react-native';
import { hasUrduScript, urduSize } from './nastaliq';

export const FONT_ASSETS = {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  Sora_600SemiBold,
  Sora_700Bold,
  NotoNastaliqUrdu_400Regular,
  NotoNastaliqUrdu_600SemiBold,
  NotoNastaliqUrdu_700Bold,
};

export type Weight = 'regular' | 'medium' | 'semibold' | 'bold';

const BODY: Record<Weight, string> = {
  regular: 'DMSans_400Regular',
  medium: 'DMSans_500Medium',
  semibold: 'DMSans_600SemiBold',
  bold: 'DMSans_600SemiBold',
};
const HEAD: Record<Weight, string> = {
  regular: 'Sora_600SemiBold',
  medium: 'Sora_600SemiBold',
  semibold: 'Sora_600SemiBold',
  bold: 'Sora_700Bold',
};
const URDU: Record<Weight, string> = {
  regular: 'NotoNastaliqUrdu_400Regular',
  medium: 'NotoNastaliqUrdu_400Regular',
  semibold: 'NotoNastaliqUrdu_600SemiBold',
  bold: 'NotoNastaliqUrdu_700Bold',
};

export interface FontChoice {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  /** Set when the text is drawn in Nastaliq, with the face its Latin letters and digits use. */
  urdu?: { latinFamily: string };
}

/**
 * The face follows the words, not the app language: a customer name typed in English
 * stays in the Latin face inside an Urdu screen, and an Urdu name gets Nastaliq inside an English one.
 */
export function pickFont(text: string, size: number, weight: Weight, opts: { head?: boolean; latin?: boolean } = {}): FontChoice {
  const latinFamily = (opts.head ? HEAD : BODY)[weight];
  if (opts.latin || !hasUrduScript(text)) return { fontFamily: latinFamily, fontSize: size, lineHeight: Math.round(size * 1.35) };
  // A browser can mix faces within one line; on the phone the Latin runs are set apart by splitLatin.
  const fontFamily = Platform.OS === 'web' ? `${latinFamily}, ${URDU[weight]}` : URDU[weight];
  // The line stays twice the Latin size, so rows keep their height; nastaliqRoom gives the strokes their space.
  return { fontFamily, fontSize: urduSize(size), lineHeight: Math.round(size * 2), urdu: { latinFamily } };
}

/** Plain text inside a React node, for choosing a face. */
export function textOf(node: unknown): string {
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  return '';
}
