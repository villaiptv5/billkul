import React, { useEffect, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { api, type ApiError } from '../account/api';
import { toAccount } from '../account/sync';
import { PRIVACY_URL } from '../config';
import { store, useAppState } from '../data/app';
import type { Lang } from '../data/types';
import type { StringKey } from '../i18n';
import { joinPhone, ltr, showPhone } from '../logic/phone';
import { C } from '../theme';
import { Button } from '../ui/Button';
import { Field } from '../ui/Input';
import { Screen } from '../ui/kit';
import { useLocale } from '../ui/locale';
import { T } from '../ui/T';

export const ERRORS: Record<ApiError, StringKey> = {
  bad_phone: 'errBadPhone',
  same_phone: 'errSamePhone',
  number_taken: 'errNumberTaken',
  wait: 'errWait',
  too_many: 'errTooMany',
  bad_code: 'errBadCode',
  expired: 'errExpired',
  signed_out: 'errOffline',
  no_password: 'errNoPassword',
  bad_password: 'errBadPassword',
  weak_password: 'errWeakPassword',
  setup: 'errOffline',
  server: 'errOffline',
  offline: 'errOffline',
};

/** Seconds left until a moment, counted down once a second. */
function useCountdown(until: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (until <= Date.now()) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [until]);
  return Math.max(0, Math.ceil((until - now) / 1000));
}

function LanguagePicker() {
  const language = useAppState().settings.language;
  return (
    <View style={{ flexDirection: 'row', gap: 6, direction: 'ltr' }}>
      {(['en', 'ur'] as Lang[]).map((code) => {
        const on = language === code;
        return (
          <Pressable
            key={code}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => store.updateSettings({ language: code })}
            testID={`lang-${code}`}
            style={{ minHeight: 44, minWidth: 76, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1.5, borderColor: on ? C.ink : C.border, backgroundColor: on ? C.ink : C.surface, alignItems: 'center', justifyContent: 'center' }}
          >
            <T size={code === 'en' ? 14 : 15} w="semibold" latin={code === 'en'} color={on ? C.onInk : C.ink} center>
              {code === 'en' ? 'English' : 'اردو'}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * The first screen of the app: the shop owner's mobile number, then the 6-digit code sent to its WhatsApp.
 * The number becomes the BillKul account; the free allowance and Pro belong to it.
 */
export function SignInScreen() {
  const { t } = useLocale();
  const [step, setStep] = useState<'phone' | 'password' | 'code'>('phone');
  const [password, setPassword] = useState('');
  const [country, setCountry] = useState('+92');
  const [number, setNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [resendAt, setResendAt] = useState(0);
  const [forgot, setForgot] = useState(false);
  const wait = useCountdown(resendAt);

  const fail = (word: ApiError, seconds?: number) => setError(t(ERRORS[word], { n: seconds ?? 60 }));

  const send = async (target: string | null) => {
    if (busy) return;
    if (!target) return fail('bad_phone');
    setBusy(true);
    setError('');
    const result = await api.requestCode(target);
    setBusy(false);
    if (result.ok) {
      setPhone(target);
      setCode('');
      setStep('code');
      setResendAt(Date.now() + result.wait * 1000);
    } else if (result.error === 'wait' && target === phone) {
      // A code for this number is already on its way: go on to the code step.
      setStep('code');
      setResendAt(Date.now() + (result.wait ?? 60) * 1000);
    } else {
      fail(result.error, result.wait);
    }
  };

  /** After the number: its password when it has one, otherwise a code on WhatsApp. */
  const begin = async () => {
    const target = joinPhone(country, number);
    if (busy) return;
    if (!target) return fail('bad_phone');
    setBusy(true);
    setError('');
    setForgot(false);
    const result = await api.start(target);
    setBusy(false);
    if (!result.ok) return fail(result.error, result.wait);
    if (result.hasPassword) {
      setPhone(target);
      setPassword('');
      setStep('password');
    } else {
      void send(target);
    }
  };

  const passwordSignIn = async () => {
    if (busy || !password) return;
    setBusy(true);
    setError('');
    const result = await api.passwordSignIn(phone, password);
    setBusy(false);
    if (result.ok) {
      store.raiseUsage({ docs: result.account.docsUsed, cash: result.account.cashUsed });
      store.signIn(toAccount(result.account, result.token));
    } else if (result.error === 'no_password') {
      void send(phone);
    } else {
      setPassword('');
      fail(result.error);
    }
  };

  const verify = async (typed: string) => {
    if (busy || typed.length < 6) return;
    setBusy(true);
    setError('');
    const result = await api.verifyCode(phone, typed);
    setBusy(false);
    if (result.ok) {
      store.raiseUsage({ docs: result.account.docsUsed, cash: result.account.cashUsed });
      store.signIn({ ...toAccount(result.account, result.token), resetPassword: forgot });
    } else {
      setCode('');
      fail(result.error);
    }
  };

  const typeCode = (text: string) => {
    const digits = text.replace(/\D+/g, '').slice(0, 6);
    setCode(digits);
    if (digits.length === 6) void verify(digits);
  };

  const minutes = `${Math.floor(wait / 60)}:${String(wait % 60).padStart(2, '0')}`;

  return (
    <Screen bg={C.surface}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, padding: 24, paddingTop: 20, gap: 20 }}>
        <View style={{ direction: 'ltr', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          {/* The logo is never mirrored or translated: same order and same side in every language. */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }} accessible accessibilityLabel="BillKul">
            <Image source={require('../../assets/icon.png')} style={{ width: 48, height: 48, borderRadius: 12 }} accessibilityIgnoresInvertColors />
            <Text style={{ fontFamily: 'Sora_700Bold', fontSize: 24, lineHeight: 32, color: C.ink, writingDirection: 'ltr' }} testID="wordmark">
              Bill<Text style={{ color: C.greenDeep }}>Kul</Text>
            </Text>
          </View>
          <LanguagePicker />
        </View>

        {step === 'phone' ? (
          <>
            <View style={{ gap: 6 }}>
              <T size={26} w="semibold" head accessibilityRole="header">
                {t('signInTitle')}
              </T>
              <T size={15} color={C.muted}>
                {t('signInSub')}
              </T>
            </View>
            {/* A phone number reads left to right in every language. */}
            <View style={{ flexDirection: 'row', gap: 10, direction: 'ltr' }}>
              <Field label={t('countryCode')} value={country} onChangeText={(text) => setCountry(`+${text.replace(/\D+/g, '').slice(0, 4)}`)} keyboardType="phone-pad" latin maxLength={5} style={{ width: 92 }} inputStyle={{ textAlign: 'center' }} testID="signin-country" />
              <Field label={t('mobileNumber')} value={number} onChangeText={setNumber} placeholder="300 1234567" keyboardType="phone-pad" latin autoFocus maxLength={16} style={{ flex: 1 }} inputStyle={{ textAlign: 'left' }} onSubmitEditing={() => void begin()} testID="signin-number" />
            </View>
            {error ? (
              <T size={14} w="medium" color={C.danger} testID="signin-error">
                {error}
              </T>
            ) : null}
            <Button label={t('continue')} size="lg" head disabled={busy} onPress={() => void begin()} testID="signin-send" />
            <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(PRIVACY_URL)} testID="signin-privacy" style={{ minHeight: 44, justifyContent: 'center' }}>
              <T size={13} color={C.muted}>
                {t('signInPrivacy')}
              </T>
            </Pressable>
          </>
        ) : step === 'password' ? (
          <>
            <View style={{ gap: 6 }}>
              <T size={26} w="semibold" head accessibilityRole="header">
                {t('passwordTitle')}
              </T>
              <T size={15} color={C.muted} testID="signin-password-for">
                {t('passwordSub', { phone: ltr(showPhone(phone)) })}
              </T>
            </View>
            <Field label={t('password')} value={password} onChangeText={setPassword} secure latin autoFocus maxLength={72} onSubmitEditing={() => void passwordSignIn()} testID="signin-password" />
            {error ? (
              <T size={14} w="medium" color={C.danger} testID="signin-error">
                {error}
              </T>
            ) : null}
            <Button label={t('signIn')} size="lg" head disabled={busy || !password} onPress={() => void passwordSignIn()} testID="signin-password-go" />
            <Button
              label={t('forgotPassword')}
              variant="ghost"
              size="sm"
              disabled={busy}
              onPress={() => {
                setForgot(true);
                void send(phone);
              }}
              testID="signin-forgot"
            />
            <Button
              label={t('changeNumber')}
              variant="ghost"
              size="sm"
              onPress={() => {
                setStep('phone');
                setError('');
              }}
              testID="signin-change"
            />
          </>
        ) : (
          <>
            <View style={{ gap: 6 }}>
              <T size={26} w="semibold" head accessibilityRole="header">
                {t('codeTitle')}
              </T>
              <T size={15} color={C.muted} testID="signin-sent-to">
                {t('codeSub', { phone: ltr(showPhone(phone)) })}
              </T>
            </View>
            <Field label={t('codeLabel')} value={code} onChangeText={typeCode} keyboardType="number-pad" latin autoFocus maxLength={6} inputStyle={{ textAlign: 'center', fontSize: 26, letterSpacing: 8, minHeight: 64 }} onSubmitEditing={() => void verify(code)} testID="signin-code" />
            {error ? (
              <T size={14} w="medium" color={C.danger} testID="signin-error">
                {error}
              </T>
            ) : null}
            <Button label={t('verifyCode')} size="lg" head disabled={busy || code.length < 6} onPress={() => void verify(code)} testID="signin-verify" />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <Button label={t('changeNumber')} variant="ghost" size="sm" onPress={() => { setStep('phone'); setError(''); }} testID="signin-change" style={{ paddingHorizontal: 4 }} />
              <Button label={wait > 0 ? t('resendIn', { time: minutes }) : t('resend')} variant="ghost" size="sm" disabled={busy || wait > 0} onPress={() => void send(phone)} testID="signin-resend" style={{ paddingHorizontal: 4 }} />
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

/** Asked right after signing in with a code, when the number has no password yet (or it was forgotten). */
export function SetPasswordScreen() {
  const { t } = useLocale();
  const { account } = useAppState();
  const [one, setOne] = useState('');
  const [two, setTwo] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    if (busy || !account) return;
    if (one.length < 6) return setError(t('errWeakPassword'));
    if (one !== two) return setError(t('errPasswordsDiffer'));
    setBusy(true);
    setError('');
    const result = await api.setPassword(account.token, one);
    setBusy(false);
    if (result.ok) store.updateAccount({ ...toAccount(result.account, account.token), resetPassword: false });
    // Signed out elsewhere, or the code was too long ago to replace a forgotten password: start again.
    else if (result.error === 'signed_out' || result.error === 'bad_password') store.signOut();
    else setError(t(ERRORS[result.error]));
  };

  return (
    <Screen bg={C.surface}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, padding: 24, paddingTop: 28, gap: 18 }}>
        <View style={{ gap: 6 }}>
          <T size={26} w="semibold" head accessibilityRole="header">
            {t('setPasswordTitle')}
          </T>
          <T size={15} color={C.muted}>
            {t('setPasswordSub')}
          </T>
          {account ? (
            <T size={15} w="semibold" latin testID="setpw-phone">
              {showPhone(account.phone)}
            </T>
          ) : null}
        </View>
        <Field label={t('newPassword')} value={one} onChangeText={setOne} secure latin autoFocus maxLength={72} testID="setpw-new" />
        <Field label={t('repeatPassword')} value={two} onChangeText={setTwo} secure latin maxLength={72} onSubmitEditing={() => void save()} testID="setpw-again" />
        {error ? (
          <T size={14} w="medium" color={C.danger} testID="setpw-error">
            {error}
          </T>
        ) : null}
        <Button label={t('savePassword')} size="lg" head disabled={busy} onPress={() => void save()} testID="setpw-save" />
        <Button label={t('signOut')} variant="ghost" size="sm" disabled={busy} onPress={() => store.signOut()} testID="setpw-sign-out" />
      </ScrollView>
    </Screen>
  );
}
