import React from 'react';
import { View } from 'react-native';
import { useAppState } from '../data/app';
import { CashReport, Statement } from '../screens/reports';
import { useLocale } from '../ui/locale';
import { PageHeader } from './parts';

/** Cash In, Cash Out or both, as a page to print or send. */
export function CashReportPage() {
  const { t } = useLocale();
  return (
    <View style={{ gap: 20 }}>
      <PageHeader title={t('cashReport')} />
      <CashReport wide />
    </View>
  );
}

/** A customer's statement, as a page to print or send. */
export function StatementPage({ id }: { id: string }) {
  const { t } = useLocale();
  const customer = useAppState().customers.find((c) => c.id === id);
  return (
    <View style={{ gap: 20 }}>
      <PageHeader title={t('statement')} subtitle={customer?.name} />
      <Statement customerId={id} wide />
    </View>
  );
}
