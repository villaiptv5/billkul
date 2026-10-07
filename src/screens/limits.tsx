import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { api } from '../account/api';
import { syncAccount } from '../account/sync';
import { store, useAppState } from '../data/app';
import { formatDate } from '../logic/dates';
import { ltr, showPhone } from '../logic/phone';
import { allowance, type Allowance } from '../logic/plan';
import { openWhatsappText } from '../platform/docActions';
import { C } from '../theme';
import { Button } from '../ui/Button';
import { Card, Sheet, SheetScroll, useDialogs } from '../ui/kit';
import { useLocale } from '../ui/locale';
import { T } from '../ui/T';

type Reason = 'docs' | 'cash' | 'plan';

interface Limits {
  /** True when another quotation or invoice may be made; otherwise explains the limit and returns false. */
  allowDoc: () => boolean;
  /** The same for a new cash book entry. */
  allowCash: () => boolean;
  /** Opens the page about Pro. */
  showPro: () => void;
}

const LimitsContext = createContext<Limits>({ allowDoc: () => true, allowCash: () => true, showPro: () => {} });

export function useLimits(): Limits {
  return useContext(LimitsContext);
}

/** What the signed-in account may still make. */
export function useAllowance(): Allowance {
  const { account, usage } = useAppState();
  return useMemo(() => allowance(account, usage), [account, usage]);
}

/** Says why something is limited and how to get Pro. Until Pro can be bought in the app, the owner switches it on. */
function ProSheet({ reason, onClose }: { reason: Reason | null; onClose: () => void }) {
  const { t } = useLocale();
  const { notify } = useDialogs();
  const { account } = useAppState();
  const plan = useAllowance();
  const [checking, setChecking] = useState(false);

  const contact = () => {
    if (account?.supportWhatsapp) openWhatsappText(account.supportWhatsapp.replace(/\D+/g, ''), t('proMessage', { phone: ltr(showPhone(account.phone)) }));
  };

  const check = async () => {
    setChecking(true);
    const result = await syncAccount();
    setChecking(false);
    if (result === 'offline') return notify(t('errOffline'));
    if (allowance(store.getState().account, store.getState().usage).pro) {
      notify(t('proNow'));
      onClose();
    } else {
      notify(t('stillFree'));
    }
  };

  const body = reason === 'docs' ? t('limitDocsBody', { limit: plan.docs.limit }) : reason === 'cash' ? t('limitCashBody', { limit: plan.cash.limit }) : t('proBody');

  return (
    <Sheet visible={reason !== null} onClose={onClose} title={t(reason === 'plan' ? 'proTitle' : 'limitTitle')}>
      <SheetScroll>
        <T size={15} testID="limit-body">
          {body}
        </T>
        {account?.supportWhatsapp ? (
          <Button label={t('contactForPro')} icon="chat" size="lg" head onPress={contact} testID="limit-contact" />
        ) : (
          <T size={14} color={C.muted}>
            {t('proSoon')}
          </T>
        )}
        <Button label={t('checkPro')} variant="secondary" disabled={checking} onPress={() => void check()} testID="limit-check" />
      </SheetScroll>
    </Sheet>
  );
}

export function LimitsProvider({ children }: { children: React.ReactNode }) {
  const [reason, setReason] = useState<Reason | null>(null);

  const allow = useCallback((kind: 'docs' | 'cash') => {
    const { account, usage } = store.getState();
    if (!allowance(account, usage)[kind].full) return true;
    setReason(kind);
    return false;
  }, []);

  const limits = useMemo<Limits>(() => ({ allowDoc: () => allow('docs'), allowCash: () => allow('cash'), showPro: () => setReason('plan') }), [allow]);

  return (
    <LimitsContext.Provider value={limits}>
      {children}
      <ProSheet reason={reason} onClose={() => setReason(null)} />
    </LimitsContext.Provider>
  );
}

function Meter({ label, used, limit, testID }: { label: string; used: number; limit: number; testID: string }) {
  const share = limit > 0 ? Math.min(1, used / limit) : 1;
  const full = used >= limit;
  return (
    <View style={{ gap: 5 }}>
      <T size={14} color={full ? C.danger : C.ink} w={full ? 'semibold' : 'regular'} testID={testID}>
        {label}
      </T>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: C.bgDeep, overflow: 'hidden', direction: 'ltr' }}>
        <View style={{ width: `${Math.round(share * 100)}%`, height: 6, borderRadius: 3, backgroundColor: full ? C.danger : C.greenDeep }} />
      </View>
    </View>
  );
}

/** The account in Settings: the number, the plan, how much of the free allowance is used, and sign out. */
export function AccountCard() {
  const { t, lang } = useLocale();
  const { confirm, notify } = useDialogs();
  const { account } = useAppState();
  const plan = useAllowance();
  const limits = useLimits();
  if (!account) return null;

  const signOut = async () => {
    if (!(await confirm({ title: t('signOutTitle'), body: t('signOutBody'), confirmLabel: t('signOut') }))) return;
    void api.logout(account.token);
    store.signOut();
  };

  const remove = async () => {
    if (!(await confirm({ title: t('deleteAccountTitle'), body: t(plan.pro ? 'deleteAccountBodyPro' : 'deleteAccountBody'), confirmLabel: t('deleteAccount'), danger: true }))) return;
    const result = await api.deleteAccount(account.token);
    // Deleted now, or already gone from the server: either way this device is signed out.
    if (result.ok || result.error === 'signed_out') store.signOut();
    else notify(t('errOffline'));
  };

  return (
    <Card style={{ padding: 14, gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ flex: 1, gap: 1 }}>
          <T size={13} w="semibold" color={C.muted}>
            {t('accountTitle')}
          </T>
          <T size={17} w="semibold" latin testID="account-phone">
            {showPhone(account.phone)}
          </T>
        </View>
        <View style={{ paddingHorizontal: 12, minHeight: 28, borderRadius: 14, justifyContent: 'center', backgroundColor: plan.pro ? '#D5F5E3' : C.bgDeep }}>
          <T size={13} w="semibold" color={plan.pro ? C.greenText : C.ink} testID="account-plan">
            {t(plan.pro ? 'planPro' : 'planFree')}
          </T>
        </View>
      </View>
      {plan.pro ? (
        <T size={14} color={C.muted} testID="account-pro">
          {`${account.proUntil ? t('proUntilDate', { date: formatDate(account.proUntil, lang) }) : t('proForever')} · ${t('unlimitedAll')}`}
        </T>
      ) : (
        <>
          <Meter label={t('usedDocs', { used: plan.docs.used, limit: plan.docs.limit })} used={plan.docs.used} limit={plan.docs.limit} testID="account-docs" />
          <Meter label={t('usedCash', { used: plan.cash.used, limit: plan.cash.limit })} used={plan.cash.used} limit={plan.cash.limit} testID="account-cash" />
        </>
      )}
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        {plan.pro ? null : <Button label={t('getPro')} onPress={limits.showPro} testID="account-get-pro" style={{ flexGrow: 1 }} />}
        <Button label={t('signOut')} variant="secondary" onPress={() => void signOut()} testID="account-sign-out" style={{ flexGrow: 1 }} />
      </View>
      <Pressable accessibilityRole="button" onPress={() => void remove()} testID="account-delete" style={{ alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' }}>
        <T size={13.5} w="medium" color={C.muted}>
          {t('deleteAccount')}
        </T>
      </Pressable>
    </Card>
  );
}

/** A line on the Dashboard once half of the free allowance is gone, so the limit is never a surprise. */
export function PlanNotice() {
  const { t } = useLocale();
  const plan = useAllowance();
  const limits = useLimits();
  if (plan.pro) return null;
  const docsLow = plan.docs.used * 2 >= plan.docs.limit;
  const cashLow = plan.cash.used * 2 >= plan.cash.limit;
  if (!docsLow && !cashLow) return null;
  const text = docsLow ? t('usedDocs', { used: Math.min(plan.docs.used, plan.docs.limit), limit: plan.docs.limit }) : t('usedCash', { used: Math.min(plan.cash.used, plan.cash.limit), limit: plan.cash.limit });
  return (
    <Pressable accessibilityRole="button" onPress={limits.showPro} testID="plan-notice" style={({ pressed }) => ({ minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface, paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 10, opacity: pressed ? 0.7 : 1 })}>
      <View style={{ flex: 1 }}>
        <T size={14} w="medium">
          {text}
        </T>
      </View>
      <T size={14} w="semibold" color={C.greenText}>
        {t('getPro')}
      </T>
    </Pressable>
  );
}
