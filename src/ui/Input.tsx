import React, { useEffect, useState } from 'react';
import { Platform, TextInput, View, type KeyboardTypeOptions, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { formatAmount, parseAmount } from '../logic/money';
import { C } from '../theme';
import { pickFont } from './fonts';
import { Icon } from './Icon';
import { useLocale } from './locale';
import { T } from './T';

const NO_OUTLINE = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as TextStyle) : null;

export interface FieldProps {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  /** Latin face and left-to-right entry, for phone numbers and codes. */
  latin?: boolean;
  multiline?: boolean;
  autoFocus?: boolean;
  maxLength?: number;
  style?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  testID?: string;
  onSubmitEditing?: () => void;
  autoCapitalize?: 'none' | 'sentences' | 'words';
}

export function Field({ label, value, onChangeText, placeholder, keyboardType, latin, multiline, autoFocus, maxLength, style, inputStyle, testID, onSubmitEditing, autoCapitalize }: FieldProps) {
  const { rtl } = useLocale();
  const [focused, setFocused] = useState(false);
  const font = pickFont(value || placeholder || '', 16, 'regular', { latin });
  return (
    <View style={[{ gap: 6 }, style]}>
      {label ? (
        <T size={13} w="semibold" color={C.muted}>
          {label}
        </T>
      ) : null}
      <TextInput
        accessibilityLabel={label ?? placeholder}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#7C8C84"
        keyboardType={keyboardType}
        multiline={multiline}
        autoFocus={autoFocus}
        maxLength={maxLength}
        testID={testID}
        onSubmitEditing={onSubmitEditing}
        autoCapitalize={autoCapitalize}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[
          {
            minHeight: multiline ? 84 : 52,
            borderRadius: 12,
            borderWidth: focused ? 2 : 1.5,
            borderColor: focused ? C.greenDeep : C.border,
            backgroundColor: C.surface,
            paddingHorizontal: focused ? 13.5 : 14,
            paddingVertical: multiline ? 12 : 0,
            fontSize: 16,
            color: C.ink,
            fontFamily: font.fontFamily,
            textAlign: rtl ? 'right' : 'left',
            textAlignVertical: multiline ? 'top' : 'center',
          },
          NO_OUTLINE,
          inputStyle,
        ]}
      />
    </View>
  );
}

export interface NumberFieldProps {
  value: number;
  onChange: (n: number) => void;
  label: string;
  width?: number;
  height?: number;
  align?: 'center' | 'end';
  /** Show an empty box rather than 0, so a price can be typed straight in. */
  blankZero?: boolean;
  highlight?: boolean;
  autoFocus?: boolean;
  testID?: string;
  onSubmit?: () => void;
}

/** Amount box: shows 68,000 at rest, takes plain typing while focused, and saves on every keystroke. */
export function NumberField({ value, onChange, label, width = 104, height = 44, align = 'center', blankZero, highlight, autoFocus, testID, onSubmit }: NumberFieldProps) {
  const { rtl } = useLocale();
  const shown = (n: number) => (blankZero && !n ? '' : formatAmount(n));
  const [text, setText] = useState(shown(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(shown(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, focused]);

  const font = pickFont('', 15, 'semibold', { latin: true });
  const active = focused || highlight;
  return (
    <TextInput
      accessibilityLabel={label}
      value={text}
      testID={testID}
      autoFocus={autoFocus}
      keyboardType="decimal-pad"
      selectTextOnFocus
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        setText(shown(parseAmount(text)));
      }}
      onChangeText={(next) => {
        setText(next);
        onChange(parseAmount(next));
      }}
      onSubmitEditing={onSubmit}
      placeholder="0"
      placeholderTextColor="#7C8C84"
      style={[
        {
          width,
          height,
          borderRadius: 10,
          borderWidth: active ? 2 : 1.5,
          borderColor: active ? C.greenDeep : C.border,
          backgroundColor: C.surface,
          paddingHorizontal: 10,
          paddingVertical: 0,
          fontSize: 15,
          color: C.ink,
          fontFamily: font.fontFamily,
          textAlign: align === 'center' ? 'center' : rtl ? 'left' : 'right',
        },
        NO_OUTLINE,
      ]}
    />
  );
}

export function SearchBox({ value, onChangeText, placeholder, autoFocus, tone = 'plain', testID }: { value: string; onChangeText: (t: string) => void; placeholder: string; autoFocus?: boolean; tone?: 'plain' | 'sunken'; testID?: string }) {
  const { rtl } = useLocale();
  const [focused, setFocused] = useState(false);
  const font = pickFont(value || placeholder, 15, 'regular');
  return (
    <View
      style={{
        height: 48,
        borderRadius: 12,
        borderWidth: focused ? 2 : 1.5,
        borderColor: focused ? C.greenDeep : tone === 'sunken' ? C.border : C.borderStrong,
        backgroundColor: tone === 'sunken' ? C.bg : C.surface,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        gap: 10,
      }}
    >
      <Icon name="search" size={20} color={C.muted} />
      <TextInput
        accessibilityLabel={placeholder}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#66776E"
        autoFocus={autoFocus}
        testID={testID}
        autoCapitalize="none"
        autoCorrect={false}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[
          { flex: 1, height: 44, fontSize: 15, color: C.ink, fontFamily: font.fontFamily, textAlign: rtl ? 'right' : 'left', paddingVertical: 0 },
          NO_OUTLINE,
        ]}
      />
    </View>
  );
}
