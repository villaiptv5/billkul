import React, { useMemo, useState } from 'react';
import { Platform, ScrollView, View, type LayoutChangeEvent } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useAppState } from '../data/app';
import { formatDate, isoDate } from '../logic/dates';
import { money } from '../logic/money';
import { customerSummary } from '../logic/stats';
import type { RootNav, RootParams } from '../nav';
import { buildCashReportHtml, buildStatementHtml, cashReportTotals, reportFileName, type CashSide } from '../pdf/reports';
import { whatsappNumber } from '../pdf/template';
import { IS_PHONE, openWhatsappText, printDoc, sharePdf } from '../platform/docActions';
import { DocView } from '../platform/DocView';
import { C } from '../theme';
import { Button } from '../ui/Button';
import { Empty, Screen, Segmented, TopBar, useDialogs } from '../ui/kit';
import { useLocale } from '../ui/locale';
import { T } from '../ui/T';
import { useCashBook } from './books';
import { usePeriod } from './period';
import { PeriodStepper } from './PeriodStepper';

const SHADOW = Platform.select({
  web: { boxShadow: '0 6px 20px rgba(11,31,23,0.14)' },
  default: { elevation: 4, shadowColor: '#0B1F17', shadowOpacity: 0.14, shadowRadius: 10, shadowOffset: { width: 0, height: 6 } },
}) as object;

/**
 * A report as it will print, with the buttons to print it or send it.
 * On the phone it goes out as a PDF through the share menu; in a browser it prints, or saves as a PDF from the print window.
 */
export function ReportPreview({ html, fileName, whatsappTo = '', message, wide }: { html: string; fileName: string; whatsappTo?: string; message: string; wide?: boolean }) {
  const { t } = useLocale();
  const { notify } = useDialogs();
  const [width, setWidth] = useState(0);
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    try {
      await action();
    } catch {
      notify(t('shareFailed'));
    } finally {
      setBusy(false);
    }
  };

  const buttons = IS_PHONE ? (
    <>
      <Button label={t('sendPdf')} icon="chat" size={wide ? 'md' : 'lg'} head disabled={busy} onPress={() => run(() => sharePdf(html, fileName))} testID="report-send" style={wide ? { flex: 1.3 } : undefined} />
      <Button label={t('print')} icon="printer" variant="secondary" disabled={busy} onPress={() => run(() => printDoc(html))} testID="report-print" style={wide ? { flex: 1 } : undefined} />
    </>
  ) : (
    <>
      <Button label={`${t('print')} / ${t('savePdf')}`} icon="printer" size={wide ? 'md' : 'lg'} head disabled={busy} onPress={() => run(() => printDoc(html))} testID="report-print" style={wide ? { flex: 1.3 } : undefined} />
      <Button label={t('sendWhatsappText')} icon="chat" variant="secondary" onPress={() => openWhatsappText(whatsappNumber(whatsappTo), message)} testID="report-send" style={wide ? { flex: 1 } : undefined} />
    </>
  );

  const page = (
    <View onLayout={(e: LayoutChangeEvent) => setWidth(Math.floor(e.nativeEvent.layout.width))} style={[{ borderRadius: 6, backgroundColor: C.surface, overflow: 'hidden' }, SHADOW]} testID="report-preview">
      {width > 0 ? <DocView html={html} width={width} /> : <View style={{ height: 420 }} />}
    </View>
  );

  const hint = IS_PHONE ? null : (
    <T size={13} color={C.muted}>
      {t('reportPdfHint')}
    </T>
  );

  if (wide) {
    return (
      <View style={{ gap: 12, width: '100%', maxWidth: 720, alignSelf: 'center' }}>
        <View style={{ flexDirection: 'row', gap: 10 }}>{buttons}</View>
        {hint}
        {page}
      </View>
    );
  }
  return (
    <View style={{ gap: 14 }}>
      {page}
      <View style={{ gap: 8 }}>{buttons}</View>
      {hint}
    </View>
  );
}

/** The Cash In report, the Cash Out report or both, for a day or a month, ready to print or send. */
export function CashReport({ wide, initialSide = 'in' }: { wide?: boolean; initialSide?: CashSide }) {
  const { t, lang } = useLocale();
  const { settings } = useAppState();
  const book = useCashBook();
  const period = usePeriod('month');
  const [side, setSide] = useState<CashSide>(initialSide);

  const rows = useMemo(() => book.rows.filter((r) => r.date.startsWith(period.prefix)), [book.rows, period.prefix]);
  const html = useMemo(() => buildCashReportHtml({ rows, side, period: period.name, settings, lang }), [rows, side, period.name, settings, lang]);
  const title = t(side === 'in' ? 'moneyIn' : side === 'out' ? 'moneyOut' : 'cashBook');
  const totals = cashReportTotals(rows.filter((r) => side === 'all' || r.kind === side), side);
  const message = t('cashReportMessage', { title, period: period.name, shop: settings.shopName || t('myShop'), total: money(totals.shown, settings.currency) });

  const sides = (
    <Segmented
      value={side}
      onChange={setSide}
      options={[
        { value: 'in', label: t('moneyIn'), testID: 'report-side-in' },
        { value: 'out', label: t('moneyOut'), testID: 'report-side-out' },
        { value: 'all', label: t('both'), testID: 'report-side-all' },
      ]}
    />
  );
  const modes = (
    <Segmented
      value={period.mode}
      onChange={period.setMode}
      options={[
        { value: 'day', label: t('day'), testID: 'report-day' },
        { value: 'month', label: t('month'), testID: 'report-month' },
      ]}
    />
  );
  const cashDays = useMemo(() => new Set(book.rows.map((r) => r.date)), [book.rows]);
  const stepper = <PeriodStepper period={period} marked={cashDays} testID="report-period" />;

  return (
    <View style={{ gap: wide ? 20 : 14 }}>
      {wide ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, flexWrap: 'wrap', width: '100%', maxWidth: 720, alignSelf: 'center' }}>
          <View style={{ flexGrow: 1, flexBasis: 300 }}>{sides}</View>
          <View style={{ width: 170 }}>{modes}</View>
          <View style={{ width: 210 }}>{stepper}</View>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {sides}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 124 }}>{modes}</View>
            <View style={{ flex: 1 }}>{stepper}</View>
          </View>
        </View>
      )}
      <ReportPreview html={html} fileName={reportFileName(title, period.name)} message={message} wide={wide} />
    </View>
  );
}

/** A customer's statement, ready to print or send to them. */
export function Statement({ customerId, wide }: { customerId: string; wide?: boolean }) {
  const { t, lang } = useLocale();
  const { customers, docs, settings } = useAppState();
  const customer = customers.find((c) => c.id === customerId);
  const summary = useMemo(() => customerSummary(docs, customerId), [docs, customerId]);
  const html = useMemo(() => (customer ? buildStatementHtml({ customer, summary, date: formatDate(isoDate(), lang), settings, lang }) : ''), [customer, summary, settings, lang]);
  if (!customer) return <Empty title={t('noCustomer')} />;

  const cash = (n: number) => money(n, settings.currency);
  const message = t('statementMessage', { shop: settings.shopName || t('myShop'), invoiced: cash(summary.invoiced), paid: cash(summary.paid), due: cash(summary.due) });
  return <ReportPreview html={html} fileName={reportFileName(t('statement'), customer.name)} whatsappTo={customer.phone} message={message} wide={wide} />;
}

export function CashReportScreen() {
  const nav = useNavigation<RootNav>();
  const side = useRoute<RouteProp<RootParams, 'CashReport'>>().params?.side;
  const { t } = useLocale();
  return (
    <Screen bg={C.bgDeep}>
      <TopBar title={t('cashReport')} onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <CashReport initialSide={side} />
      </ScrollView>
    </Screen>
  );
}

export function StatementScreen() {
  const nav = useNavigation<RootNav>();
  const { id } = useRoute<RouteProp<RootParams, 'Statement'>>().params;
  const { t } = useLocale();
  const customer = useAppState().customers.find((c) => c.id === id);
  return (
    <Screen bg={C.bgDeep}>
      <TopBar title={t('statement')} subtitle={customer?.name} onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Statement customerId={id} />
      </ScrollView>
    </Screen>
  );
}
