import React from 'react';
import { Platform, StyleSheet, Text, type StyleProp, type TextProps, type TextStyle } from 'react-native';
import { C } from '../theme';
import { ltr } from '../logic/phone';
import { pickFont, textOf, type Weight } from './fonts';
import { NASTALIQ_LEAD, NASTALIQ_TAIL, nastaliqRoom, splitLatin } from './nastaliq';
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

const WEB = Platform.OS === 'web';

function amount(value: unknown): number {
  return typeof value === 'number' ? value : 0;
}

/** The style that lets Nastaliq strokes show in full without moving anything around the text. */
function nastaliqStyle(fontSize: number, given: TextStyle): TextStyle {
  const room = nastaliqRoom(fontSize);
  const top = amount(given.paddingTop ?? given.paddingVertical ?? given.padding);
  const bottom = amount(given.paddingBottom ?? given.paddingVertical ?? given.padding);
  const style: TextStyle = {
    paddingTop: top + room.top,
    paddingBottom: bottom + room.bottom,
    marginTop: amount(given.marginTop ?? given.marginVertical ?? given.margin) - room.top,
    marginBottom: amount(given.marginBottom ?? given.marginVertical ?? given.margin) - room.bottom,
  };
  if (WEB) {
    // Urdu always runs right to left, so its first stroke needs the room on the right.
    const side = amount(given.paddingHorizontal ?? given.padding);
    style.paddingRight = Math.max(side, room.start);
    style.paddingLeft = Math.max(side, room.end);
  }
  return style;
}

/** On the phone: digits and English words in the Latin face, and room at both ends of the line. */
function nastaliqChildren(children: React.ReactNode, latinFamily: string): React.ReactNode {
  const runs = typeof children === 'string' ? splitLatin(children) : [];
  return (
    <>
      {NASTALIQ_LEAD}
      {runs.length === 0
        ? children
        : runs.map((run, i) =>
            run.latin ? (
              <Text key={i} style={{ fontFamily: latinFamily }}>
                {run.text}
              </Text>
            ) : (
              run.text
            ),
          )}
      {NASTALIQ_TAIL}
    </>
  );
}

export function T({ size = 15, w = 'regular', head, latin, color = C.ink, center, end, style, children, ...rest }: TProps) {
  const { rtl } = useLocale();
  const font = pickFont(textOf(children), size, w, { head, latin });
  const textAlign = center ? 'center' : end ? (rtl ? 'left' : 'right') : rtl ? 'right' : 'left';
  const base: TextStyle = { fontSize: font.fontSize, color, textAlign, fontFamily: font.fontFamily, lineHeight: font.lineHeight };
  if (!font.urdu) {
    // In an Urdu screen a number such as "+92 300 1234567" or "Rs 4,500" would otherwise have its
    // groups laid out right to left ("1234567 300 92+"); an isolate keeps it in reading order.
    const text = latin && rtl && typeof children === 'string' ? ltr(children) : children;
    return (
      <Text {...rest} style={[base, style]}>
        {text}
      </Text>
    );
  }
  return (
    <Text {...rest} style={[base, style, nastaliqStyle(font.fontSize, StyleSheet.flatten(style) ?? {})]}>
      {WEB ? children : nastaliqChildren(children, font.urdu.latinFamily)}
    </Text>
  );
}
