import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { STATUS_TONES, C } from '../theme';
import type { DocStatus } from '../data/types';
import type { StringKey } from '../i18n';
import { Button, IconButton } from './Button';
import { useWide } from './layout';
import { useLocale } from './locale';
import { T } from './T';

/** Full-screen container: safe-area padding, background, room for the keyboard, and right-to-left layout in Urdu. */
export function Screen({ children, bg = C.bg, topColor, bottom = true }: { children: React.ReactNode; bg?: string; topColor?: string; bottom?: boolean }) {
  const insets = useSafeAreaInsets();
  const { rtl } = useLocale();
  return (
    <View style={{ flex: 1, backgroundColor: bg, direction: rtl ? 'rtl' : 'ltr' }}>
      <View style={{ height: insets.top, backgroundColor: topColor ?? C.surface }} />
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        {children}
      </KeyboardAvoidingView>
      {bottom ? <View style={{ height: insets.bottom, backgroundColor: C.surface }} /> : null}
    </View>
  );
}

export function TopBar({ title, subtitle, onBack, right, big, latinSubtitle }: { title: string; subtitle?: string; onBack?: () => void; right?: React.ReactNode; big?: boolean; latinSubtitle?: boolean }) {
  const { t } = useLocale();
  return (
    <View
      style={{
        minHeight: 60,
        backgroundColor: C.surface,
        borderBottomWidth: big ? 0 : 1,
        borderBottomColor: C.line,
        flexDirection: 'row',
        alignItems: 'center',
        paddingStart: onBack ? 4 : 20,
        paddingEnd: 8,
        gap: 4,
      }}
    >
      {onBack ? <IconButton icon="back" label={t('back')} onPress={onBack} testID="back" /> : null}
      <View style={{ flex: 1 }}>
        <T size={big ? 20 : 17} w="semibold" head accessibilityRole="header" numberOfLines={1}>
          {title}
        </T>
        {subtitle ? (
          <T size={13} color={C.muted} latin={latinSubtitle} numberOfLines={1}>
            {subtitle}
          </T>
        ) : null}
      </View>
      {right}
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.line }, style]}>{children}</View>;
}

export function Divider() {
  return <View style={{ height: 1, backgroundColor: C.lineSoft }} />;
}

const STATUS_KEY: Record<DocStatus, StringKey> = { draft: 'stDraft', sent: 'stSent', accepted: 'stAccepted', due: 'stDue', paid: 'stPaid' };

export function StatusPill({ status }: { status: DocStatus }) {
  const { t } = useLocale();
  const tone = STATUS_TONES[status];
  return (
    <View style={{ backgroundColor: tone.bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2 }}>
      <T size={12} w="semibold" color={tone.fg}>
        {t(STATUS_KEY[status])}
      </T>
    </View>
  );
}

export function statusLabelKey(status: DocStatus): StringKey {
  return STATUS_KEY[status];
}

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const initials = (words.length > 1 ? [...words[0]][0] + [...words[1]][0] : [...(words[0] ?? '?')].slice(0, 2).join('')).toUpperCase();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' }}>
      <T size={size * 0.35} w="semibold" head color={C.green} center>
        {initials}
      </T>
    </View>
  );
}

export function Chip({ label, selected, onPress, testID }: { label: string; selected?: boolean; onPress?: () => void; testID?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      testID={testID}
      style={{
        minHeight: 44,
        paddingHorizontal: 16,
        borderRadius: 999,
        borderWidth: 1.5,
        borderColor: selected ? C.ink : C.border,
        backgroundColor: selected ? C.ink : C.surface,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <T size={14} w={selected ? 'semibold' : 'medium'} color={selected ? C.onInk : C.ink}>
        {label}
      </T>
    </Pressable>
  );
}

export function Segmented<V extends string>({ options, value, onChange }: { options: { value: V; label: string; testID?: string }[]; value: V; onChange: (v: V) => void }) {
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: 'row', gap: 4, padding: 4, borderRadius: 14, backgroundColor: C.bgDeep }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.value)}
            testID={o.testID}
            style={{
              flex: 1,
              minHeight: 44,
              borderRadius: 10,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: on ? C.surface : 'transparent',
              ...(on ? Platform.select({ web: { boxShadow: '0 1px 3px rgba(11,31,23,0.16)' } as ViewStyle, default: { elevation: 1 } }) : null),
            }}
          >
            <T size={15} w={on ? 'semibold' : 'medium'} color={on ? C.ink : '#3D4D45'}>
              {o.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Empty({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <View style={{ paddingVertical: 36, paddingHorizontal: 24, alignItems: 'center', gap: 6 }}>
      <T size={16} w="semibold" head center>
        {title}
      </T>
      {hint ? (
        <T size={14} color={C.muted} center>
          {hint}
        </T>
      ) : null}
      {action ? <View style={{ marginTop: 10 }}>{action}</View> : null}
    </View>
  );
}

/** Sheets keep the phone's width when the app is open on a computer screen. */
const SHEET_MAX_WIDTH = Platform.OS === 'web' ? 412 : 9999;

/** Bottom sheet for pickers and short forms. */
export function Sheet({ visible, onClose, title, children, full }: { visible: boolean; onClose: () => void; title: string; children: React.ReactNode; full?: boolean }) {
  const insets = useSafeAreaInsets();
  const { rtl, t } = useLocale();
  const wide = useWide();
  if (wide) {
    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: 'rgba(11,31,23,0.45)' }}>
          <Pressable accessibilityLabel={t('close')} onPress={onClose} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }} />
          <View style={{ width: '100%', maxWidth: 480, height: full ? '80%' : undefined, maxHeight: '88%', backgroundColor: C.surface, borderRadius: 20, paddingBottom: 16, direction: rtl ? 'rtl' : 'ltr' }}>
            <View style={{ minHeight: 60, flexDirection: 'row', alignItems: 'center', paddingStart: 20, paddingEnd: 8 }}>
              <View style={{ flex: 1 }}>
                <T size={17} w="semibold" head accessibilityRole="header">
                  {title}
                </T>
              </View>
              <IconButton icon="close" label={t('close')} onPress={onClose} testID="sheet-close" />
            </View>
            {children}
          </View>
        </View>
      </Modal>
    );
  }
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: 'flex-end', alignItems: 'center', backgroundColor: 'rgba(11,31,23,0.45)' }}>
        <Pressable accessibilityLabel={t('close')} onPress={onClose} style={{ alignSelf: 'stretch', flex: full ? 0 : 1, height: full ? insets.top + 24 : undefined }} />
        <View
          style={{
            width: '100%',
            maxWidth: SHEET_MAX_WIDTH,
            flex: full ? 1 : undefined,
            maxHeight: full ? undefined : '86%',
            backgroundColor: C.surface,
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            paddingBottom: insets.bottom + 12,
            direction: rtl ? 'rtl' : 'ltr',
          }}
        >
          <View style={{ minHeight: 60, flexDirection: 'row', alignItems: 'center', paddingStart: 20, paddingEnd: 8 }}>
            <View style={{ flex: 1 }}>
              <T size={17} w="semibold" head accessibilityRole="header">
                {title}
              </T>
            </View>
            <IconButton icon="close" label={t('close')} onPress={onClose} testID="sheet-close" />
          </View>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function SheetScroll({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 8, gap: 12 }}>
      {children}
    </ScrollView>
  );
}

// ---- confirm dialog and toast ----

interface ConfirmOptions {
  title: string;
  body?: string;
  confirmLabel: string;
  danger?: boolean;
}

interface Dialogs {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  notify: (message: string) => void;
}

const DialogContext = createContext<Dialogs>({ confirm: async () => false, notify: () => {} });

export function useDialogs(): Dialogs {
  return useContext(DialogContext);
}

export function DialogHost({ children }: { children: React.ReactNode }) {
  const { rtl, t } = useLocale();
  const insets = useSafeAreaInsets();
  const [ask, setAsk] = useState<ConfirmOptions | null>(null);
  const [toast, setToast] = useState('');
  const resolver = useRef<((ok: boolean) => void) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    setAsk(opts);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const notify = useCallback((message: string) => {
    setToast(message);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(''), 3200);
  }, []);

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const answer = (ok: boolean) => {
    setAsk(null);
    resolver.current?.(ok);
    resolver.current = null;
  };

  const value = useMemo(() => ({ confirm, notify }), [confirm, notify]);

  return (
    <DialogContext.Provider value={value}>
      {children}
      <Modal visible={!!ask} transparent animationType="fade" onRequestClose={() => answer(false)} statusBarTranslucent>
        <View style={{ flex: 1, backgroundColor: 'rgba(11,31,23,0.5)', alignItems: 'center', justifyContent: 'center', padding: 28 }}>
          <View style={{ width: '100%', maxWidth: 360, backgroundColor: C.surface, borderRadius: 20, padding: 20, gap: 8, direction: rtl ? 'rtl' : 'ltr' }}>
            <T size={18} w="semibold" head accessibilityRole="header">
              {ask?.title}
            </T>
            {ask?.body ? (
              <T size={15} color={C.muted}>
                {ask.body}
              </T>
            ) : null}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
              <Button label={t('cancel')} variant="secondary" onPress={() => answer(false)} style={{ flex: 1 }} testID="confirm-cancel" />
              <Button label={ask?.confirmLabel ?? ''} variant={ask?.danger ? 'danger' : 'primary'} onPress={() => answer(true)} style={{ flex: 1 }} testID="confirm-ok" />
            </View>
          </View>
        </View>
      </Modal>
      {toast ? (
        <View pointerEvents="none" style={{ position: 'absolute', left: 16, right: 16, bottom: insets.bottom + 84, alignItems: 'center' }}>
          <View accessibilityLiveRegion="polite" style={{ maxWidth: 420, backgroundColor: C.ink, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, direction: rtl ? 'rtl' : 'ltr' }}>
            <T size={14.5} w="medium" color={C.onInk} center>
              {toast}
            </T>
          </View>
        </View>
      ) : null}
    </DialogContext.Provider>
  );
}
