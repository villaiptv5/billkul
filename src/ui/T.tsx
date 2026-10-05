import React from 'react';
import { Text, type StyleProp, type TextProps, type TextStyle } from 'react-native';
import { C } from '../theme';
import { pickFont, textOf, type Weight } from './fonts';
import { useLocale } from './locale';

export interface TProps extends TextProps {
  size?: number;
  w?: Weight;
  /** Display face (Sora) for headings and amounts. */
  head?: boolean;
  /** Always set in the Latin face: amounts, phone numbers, document numbers. */
  latin?: boolean;
  color?: string;
  center?: boolean;
  /** Align to the end edge: right in English, left in Urdu. */
  end?: boolean;
  style?: StyleProp<TextStyle>;
}

export function T({ size = 15, w = 'regular', head, latin, color = C.ink, center, end, style, ...rest }: TProps) {
  const { rtl } = useLocale();
  const font = pickFont(textOf(rest.children), size, w, { head, latin });
  const textAlign = center ? 'center' : end ? (rtl ? 'left' : 'right') : rtl ? 'right' : 'left';
  return <Text {...rest} style={[{ fontSize: size, color, textAlign, ...font }, style]} />;
}
