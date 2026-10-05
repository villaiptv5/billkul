import React from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { C } from '../theme';
import { Icon, type IconName } from './Icon';
import { T } from './T';

type Variant = 'primary' | 'secondary' | 'dark' | 'ghost' | 'danger' | 'onInk' | 'onInkOutline';
type Size = 'lg' | 'md' | 'sm';

const HEIGHT: Record<Size, number> = { lg: 56, md: 48, sm: 44 };

const LOOK: Record<Variant, { bg: string; fg: string; border?: string }> = {
  primary: { bg: C.green, fg: C.ink },
  secondary: { bg: C.surface, fg: C.ink, border: '#B4C4BB' },
  dark: { bg: C.ink, fg: C.onInk },
  ghost: { bg: 'transparent', fg: C.greenText },
  danger: { bg: C.surface, fg: C.danger, border: '#E7B6B0' },
  onInk: { bg: C.green, fg: C.ink },
  onInkOutline: { bg: 'transparent', fg: C.onInk, border: '#5E7469' },
};

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  disabled?: boolean;
  /** Use the display face, for the main action on a screen. */
  head?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function Button({ label, onPress, variant = 'primary', size = 'md', icon, disabled, head, style, testID }: ButtonProps) {
  const look = LOOK[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        {
          minHeight: HEIGHT[size],
          borderRadius: size === 'lg' ? 14 : 12,
          backgroundColor: look.bg,
          borderWidth: look.border ? 1.5 : 0,
          borderColor: look.border,
          paddingHorizontal: variant === 'ghost' ? 4 : 16,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
        },
        style,
      ]}
    >
      {icon ? <Icon name={icon} size={size === 'lg' ? 22 : 20} color={look.fg} stroke={2.1} /> : null}
      <View style={{ flexShrink: 1 }}>
        <T size={size === 'lg' ? 16 : 14.5} w="semibold" head={head} color={look.fg} center numberOfLines={1}>
          {label}
        </T>
      </View>
    </Pressable>
  );
}

export function IconButton({ icon, label, onPress, color = C.ink, bg, size = 44, testID }: { icon: IconName; label: string; onPress?: () => void; color?: string; bg?: string; size?: number; testID?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      testID={testID}
      hitSlop={4}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: bg ? 10 : size / 2,
        backgroundColor: bg ?? 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Icon name={icon} size={22} color={color} stroke={2} />
    </Pressable>
  );
}
