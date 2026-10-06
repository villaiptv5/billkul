import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { store, useAppState } from '../data/app';
import type { Customer, Item } from '../data/types';
import { formatDate } from '../logic/dates';
import { formatAmount, money } from '../logic/money';
import { lineTotal } from '../logic/totals';
import type { RootNav, RootParams } from '../nav';
import { C } from '../theme';
import { Button, IconButton } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { Field, NumberField, SearchBox } from '../ui/Input';
import { Avatar, Card, Divider, Screen, Sheet, SheetScroll, TopBar, useDialogs } from '../ui/kit';
import { useLocale } from '../ui/locale';
import { T } from '../ui/T';
import { CustomerPicker } from './CustomerPicker';
import { showDoc } from './shared';
import { LineStock, useStock } from './books';
import { matchItems, useDocEditor } from './useDocEditor';

export function EditorScreen() {
  const nav = useNavigation<RootNav>();
  const { docId } = useRoute<RouteProp<RootParams, 'Editor'>>().params;
  const { t, lang } = useLocale();
  const { notify } = useDialogs();
  const { items, settings } = useAppState();
  const editor = useDocEditor(docId);
  const { levels } = useStock();
  const doc = editor?.doc;
  const [query, setQuery] = useState('');
  const [pickingCustomer, setPickingCustomer] = useState(false);
  const [editingTax, setEditingTax] = useState(false);

  // A document opened and left blank is thrown away when the screen closes.
  useEffect(() => nav.addListener('beforeRemove', () => void store.discardIfEmpty(docId)), [nav, docId]);
  useEffect(() => {
    if (!doc) nav.goBack();
  }, [doc, nav]);

  const suggestions = useMemo(() => matchItems(items, query), [items, query]);
  if (!editor || !doc) return null;

  const { totals, save, changeLine } = editor;
  const name = query.trim();
  const exact = items.some((i) => i.name.toLowerCase() === name.toLowerCase());

  const addItem = (item: Item) => {
    editor.addItem(item);
    setQuery('');
  };

  const pickCustomer = (c: Customer) => {
    editor.pickCustomer(c);
    setPickingCustomer(false);
  };

  const preview = () => {
    if (!doc.lines.length) return notify(t('needLine'));
    showDoc(nav, 'Preview', docId);
  };

  const title = doc.status === 'draft' ? t(doc.type === 'quote' ? 'newQuote' : 'newInvoice') : t(doc.type);
  const taxName = settings.taxLabel.trim() || t('tax');

  return (
    <Screen>
      <TopBar
        title={title}
        subtitle={`${doc.number} · ${formatDate(doc.date, lang)}`}
        onBack={() => nav.goBack()}
        right={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: C.tintGreen, marginEnd: 6 }}>
            <Icon name="check" size={16} color={C.greenDark} stroke={2.4} />
            <T size={13} w="semibold" color={C.greenDark}>
              {t('saved')}
            </T>
          </View>
        }
      />
      <View style={{ flex: 1 }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 14 }}>
          <View style={{ gap: 8 }}>
            <T size={13} w="semibold" color={C.muted}>
              {t('customer')}
            </T>
            {doc.customerName ? (
              <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingStart: 12, paddingEnd: 6, paddingVertical: 10 }}>
                <Avatar name={doc.customerName} />
                <View style={{ flex: 1 }}>
                  <T size={15} w="semibold" numberOfLines={1}>
                    {doc.customerName}
                  </T>
                  {doc.customerPhone ? (
                    <T size={13} color={C.muted} latin>
                      {doc.customerPhone}
                    </T>
                  ) : null}
                </View>
                <Button label={t('change')} variant="ghost" size="sm" onPress={() => setPickingCustomer(true)} testID="change-customer" style={{ paddingHorizontal: 12 }} />
              </Card>
            ) : (
              <Pressable
                accessibilityRole="button"
                onPress={() => setPickingCustomer(true)}
                testID="choose-customer"
                style={{ minHeight: 60, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.borderStrong, backgroundColor: C.surface, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14 }}
              >
                <Icon name="user" color={C.greenText} />
                <T size={15} w="semibold" color={C.greenText}>
                  {t('chooseCustomer')}
                </T>
              </Pressable>
            )}
          </View>

          <View style={{ gap: 8 }}>
            <SearchBox value={query} onChangeText={setQuery} placeholder={t('searchAddItem')} testID="item-search" />
            {name ? (
              <Card>
                {suggestions.map((item) => (
                  <Pressable
                    key={item.id}
                    accessibilityRole="button"
                    onPress={() => addItem(item)}
                    testID={`suggest-${item.name}`}
                    style={({ pressed }) => ({ minHeight: 52, paddingHorizontal: 14, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: C.lineSoft, opacity: pressed ? 0.6 : 1 })}
                  >
                    <View style={{ flex: 1 }}>
                      <T size={15} w="medium" numberOfLines={1}>
                        {item.name}
                      </T>
                      {item.unit ? (
                        <T size={12.5} color={C.muted}>
                          {t('per', { unit: item.unit })}
                        </T>
                      ) : null}
                    </View>
                    <T size={15} w="semibold" latin color={item.price ? C.ink : C.muted}>
                      {item.price ? formatAmount(item.price) : '—'}
                    </T>
                  </Pressable>
                ))}
                {!exact ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => { editor.addNewItem(name); setQuery(''); }}
                    testID="item-add-new"
                    style={{ minHeight: 52, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}
                  >
                    <Icon name="plus" size={20} color={C.greenText} stroke={2.2} />
                    <View style={{ flex: 1 }}>
                      <T size={15} w="semibold" color={C.greenText}>
                        {t('addAsNewItem', { name })}
                      </T>
                    </View>
                  </Pressable>
                ) : null}
              </Card>
            ) : null}
          </View>

          <View style={{ gap: 8 }}>
            <T size={13} w="semibold" color={C.muted}>
              {t('items')}
            </T>
            <Card>
              {doc.lines.length === 0 ? (
                <View style={{ padding: 16 }}>
                  <T size={14} color={C.muted} center>
                    {t('noLinesYet')}
                  </T>
                </View>
              ) : (
                doc.lines.map((line, i) => (
                  <View key={line.id} style={{ paddingStart: 12, paddingEnd: 4, paddingTop: 12, paddingBottom: 10, gap: 8, borderBottomWidth: i === doc.lines.length - 1 ? 0 : 1, borderBottomColor: C.lineSoft }}>
                    <View style={{ flexDirection: 'row', gap: 10, paddingEnd: 8 }}>
                      <View style={{ flex: 1, gap: 1 }}>
                        <T size={15} w="semibold">
                          {line.name}
                        </T>
                        <LineStock doc={doc} line={line} levels={levels} />
                      </View>
                      <T size={15} w="semibold" latin testID={`line-total-${i}`}>
                        {formatAmount(lineTotal(line))}
                      </T>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <NumberField label={t('qty')} value={line.qty} onChange={(qty) => changeLine(line, { qty })} width={60} testID={`qty-${i}`} />
                      <T size={14} color={C.muted} latin>
                        ×
                      </T>
                      <NumberField label={t('price')} value={line.price} onChange={(price) => changeLine(line, { price })} blankZero testID={`price-${i}`} />
                      <View style={{ flex: 1 }}>
                        {line.unit ? (
                          <T size={13.5} color={C.muted} numberOfLines={1}>
                            {t('per', { unit: line.unit })}
                          </T>
                        ) : null}
                      </View>
                      <IconButton icon="trash" label={t('removeItem', { name: line.name })} color={C.muted} onPress={() => editor.removeLine(line)} testID={`remove-${i}`} />
                    </View>
                  </View>
                ))
              )}
            </Card>
          </View>

          <Card style={{ paddingHorizontal: 12, paddingVertical: 4 }}>
            <View style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <T size={15} color={C.muted}>
                {t('subtotal')}
              </T>
              <T size={15} w="semibold" latin testID="subtotal">
                {formatAmount(totals.subtotal)}
              </T>
            </View>
            <Divider />
            <View style={{ minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <T size={15} color={C.muted}>
                {t('discount')}
              </T>
              <NumberField label={t('discount')} value={doc.discount} onChange={(discount) => save({ discount })} height={40} align="end" blankZero testID="discount" />
            </View>
            <Divider />
            <Pressable accessibilityRole="button" onPress={() => setEditingTax(true)} testID="tax-row" style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <T size={15} color={C.muted}>
                {doc.taxPercent > 0 ? `${taxName} ${formatAmount(doc.taxPercent)}%` : t('tax')}
              </T>
              {doc.taxPercent > 0 ? (
                <T size={15} w="semibold" latin>
                  {formatAmount(totals.tax)}
                </T>
              ) : (
                <T size={15} w="semibold" color={C.greenText}>
                  {t('addTax')}
                </T>
              )}
            </Pressable>
          </Card>

          <Field label={`${t('notes')} (${t('optional')})`} value={doc.notes} onChangeText={(notes) => save({ notes })} placeholder={t('notesPh')} multiline testID="notes" />
        </ScrollView>

        <View style={{ backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.line, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ flex: 1 }}>
            <T size={13} color={C.muted}>
              {t('total')}
            </T>
            <T size={22} w="bold" head latin numberOfLines={1} testID="total">
              {money(totals.total, settings.currency)}
            </T>
          </View>
          <Button label={t('preview')} size="lg" head onPress={preview} testID="preview" style={{ paddingHorizontal: 28 }} />
        </View>
      </View>

      <CustomerPicker visible={pickingCustomer} onClose={() => setPickingCustomer(false)} onPick={pickCustomer} />
      <TaxSheet visible={editingTax} onClose={() => setEditingTax(false)} percent={doc.taxPercent} onSave={(taxPercent) => save({ taxPercent })} />
    </Screen>
  );
}

/** Tax for this document. The tax name is shared by all documents. */
export function TaxSheet({ visible, onClose, percent, onSave }: { visible: boolean; onClose: () => void; percent: number; onSave: (percent: number) => void }) {
  const { t } = useLocale();
  const settings = useAppState().settings;
  const [value, setValue] = useState(percent);
  const [label, setLabel] = useState(settings.taxLabel);

  useEffect(() => {
    if (visible) {
      setValue(percent);
      setLabel(settings.taxLabel);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const apply = (next: number) => {
    store.updateSettings({ taxLabel: label.trim() });
    onSave(Math.min(Math.max(next, 0), 100));
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={t('tax')}>
      <SheetScroll>
        <View style={{ gap: 6 }}>
          <T size={13} w="semibold" color={C.muted}>
            {t('taxPercent')}
          </T>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <NumberField label={t('taxPercent')} value={value} onChange={setValue} width={120} height={52} blankZero autoFocus testID="tax-percent" />
            <T size={16} w="semibold" latin>
              %
            </T>
          </View>
        </View>
        <Field label={t('taxName')} value={label} onChangeText={setLabel} placeholder={t('taxNamePh')} testID="tax-name" />
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
          <Button label={t('noTax')} variant="secondary" onPress={() => apply(0)} style={{ flex: 1 }} testID="tax-none" />
          <Button label={t('save')} onPress={() => apply(value)} style={{ flex: 1 }} testID="tax-save" />
        </View>
      </SheetScroll>
    </Sheet>
  );
}
