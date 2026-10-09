import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View, type LayoutChangeEvent, type ViewStyle } from 'react-native';
import { store, useAppState } from '../data/app';
import type { Customer, Item, TemplateId } from '../data/types';
import { formatDate } from '../logic/dates';
import { formatAmount, money } from '../logic/money';
import { lineTotal } from '../logic/totals';
import { buildDocHtml, whatsappNumber } from '../pdf/template';
import { openWhatsappText, printDoc } from '../platform/docActions';
import { DocView } from '../platform/DocView';
import { ReceiptSheet } from '../screens/receipt';
import { CustomerPicker } from '../screens/CustomerPicker';
import { TaxSheet } from '../screens/EditorScreen';
import { LineStock, useStock } from '../screens/books';
import { matchItems, useDocEditor } from '../screens/useDocEditor';
import { C } from '../theme';
import { Button, IconButton } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { Field, NumberField, SearchBox } from '../ui/Input';
import { Avatar, Divider, StatusPill, useDialogs } from '../ui/kit';
import { useDeskSize } from '../ui/layout';
import { useLocale } from '../ui/locale';
import { T } from '../ui/T';
import { Panel } from './parts';
import { useDesk } from './route';
import { useLimits } from '../screens/limits';
import { CompleteSheet, HoldSheet } from '../screens/finish';
import { NewItemSheet } from '../screens/NewItemSheet';

// Keeps the preview in view while the form beside it scrolls.
const STICKY = { position: 'sticky', top: 0 } as unknown as ViewStyle;

export function EditorPage({ docId }: { docId: string }) {
  const { t, lang } = useLocale();
  const { go, back } = useDesk();
  const { confirm, notify } = useDialogs();
  const { items, settings, docs } = useAppState();
  const editor = useDocEditor(docId);
  const { levels } = useStock();
  const doc = editor?.doc;
  const [query, setQuery] = useState('');
  const [pickingCustomer, setPickingCustomer] = useState(false);
  const [editingTax, setEditingTax] = useState(false);
  const [previewWidth, setPreviewWidth] = useState(0);
  const [receipt, setReceipt] = useState(false);
  const pageRef = useRef<View>(null);
  const { snug } = useDeskSize();

  // A document opened and left blank is thrown away when the page is left.
  useEffect(() => () => void store.discardIfEmpty(docId), [docId]);
  const suggestions = useMemo(() => matchItems(items, query, 8), [items, query]);
  const html = useMemo(() => (doc ? buildDocHtml({ doc, settings, lang }) : ''), [doc, settings, lang]);
  // A print or send asked for on a draft invoice waits until it is completed, then uses the finished page.
  const htmlRef = useRef(html);
  htmlRef.current = html;
  const [newName, setNewName] = useState<string | null>(null);
  const [finishing, setFinishing] = useState<'complete' | 'hold' | null>(null);
  const after = useRef<(() => void) | null>(null);
  const completed = useRef(false);
  const status = doc?.status;
  useEffect(() => {
    if (status && status !== 'draft' && after.current) {
      const next = after.current;
      after.current = null;
      next();
    }
  }, [status]);
  const limits = useLimits();
  if (!editor || !doc) return null;
  const draft = doc.status === 'draft';

  const finishFirst = (action: () => void) => {
    if (!doc.lines.length) return notify(t('needLine'));
    if (doc.type === 'invoice' && doc.status === 'draft') {
      after.current = action;
      setFinishing('complete');
    } else action();
  };

  const complete = () => {
    if (!doc.lines.length) return notify(t('needLine'));
    if (doc.type === 'quote') {
      store.completeDoc(doc.id, false);
      notify(t('quoteCompleted'));
    } else setFinishing('complete');
  };

  const held = (startNew: boolean) => {
    if (startNew && limits.allowDoc()) go({ page: 'editor', docId: store.createDoc(doc.type).id });
    else back();
  };

  const { totals, save, changeLine } = editor;
  const name = query.trim();
  const exact = items.some((i) => i.name.toLowerCase() === name.toLowerCase());
  const taxName = settings.taxLabel.trim() || t('tax');
  const isQuote = doc.type === 'quote';
  const invoice = doc.invoiceId ? docs.find((d) => d.id === doc.invoiceId) : undefined;

  const addItem = (item: Item) => {
    editor.addItem(item);
    setQuery('');
  };

  /** Enter in the search box adds the first match, or the typed name as a new item. */
  const submitSearch = () => {
    if (!name) return;
    if (suggestions.length) addItem(suggestions[0]);
    else {
      setNewName(name);
    }
  };

  const pickCustomer = (c: Customer) => {
    editor.pickCustomer(c);
    setPickingCustomer(false);
  };

  const print = () => finishFirst(() => void printNow());
  const printNow = async () => {
    try {
      await printDoc(htmlRef.current);
      store.markSent(doc.id);
    } catch {
      notify(t('shareFailed'));
    }
  };

  const whatsapp = () => finishFirst(whatsappNow);
  const whatsappNow = () => {
    const text = t('whatsappMessage', { type: t(doc.type), number: doc.number, shop: settings.shopName || t('myShop'), total: money(totals.total, settings.currency) });
    openWhatsappText(whatsappNumber(doc.customerPhone), text);
    store.markSent(doc.id);
  };

  const convert = () => {
    if (!doc.invoiceId && !limits.allowDoc()) return;
    const made = store.convertToInvoice(doc.id);
    if (made) go({ page: 'editor', docId: made.id });
  };

  const remove = async () => {
    if (await confirm({ title: t('deleteDocTitle', { number: doc.number }), body: t('deleteWarning'), confirmLabel: t('delete'), danger: true })) {
      const type = doc.type;
      store.deleteDoc(doc.id);
      go({ page: 'documents', type });
    }
  };

  const template = (id: TemplateId, label: string) => {
    const selected = settings.template === id;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected }}
        onPress={() => store.updateSettings({ template: id })}
        testID={`template-${id}`}
        style={{ flex: 1, minHeight: 48, paddingHorizontal: 12, borderRadius: 12, borderWidth: selected ? 2 : 1.5, borderColor: selected ? C.greenDeep : C.border, backgroundColor: C.surface, flexDirection: 'row', alignItems: 'center', gap: 10 }}
      >
        <View style={{ width: 22, height: 28, borderRadius: 3, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, overflow: 'hidden' }}>
          {id === 'classic' ? <View style={{ height: 8, backgroundColor: C.ink }} /> : <View style={{ marginTop: 7, height: 2, backgroundColor: C.green }} />}
        </View>
        <T size={14} w={selected ? 'semibold' : 'medium'}>
          {label}
        </T>
      </Pressable>
    );
  };

  return (
    <View style={{ gap: 18 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 }}>
        <IconButton icon="back" label={t('backToDocuments')} onPress={back} testID="back" />
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
            <T size={24} w="semibold" head accessibilityRole="header">
              {t(doc.type)}
            </T>
            <T size={24} w="semibold" head latin>
              {doc.number}
            </T>
          </View>
          <StatusPill status={doc.status} held={!!doc.heldAt} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: C.tintGreen }}>
            <Icon name="check" size={15} color={C.greenDark} stroke={2.4} />
            <T size={12.5} w="semibold" color={C.greenDark}>
              {t('saved')}
            </T>
          </View>
        </View>
        {isQuote && doc.status === 'sent' ? <Button label={t('markAccepted')} variant="secondary" onPress={() => store.markAccepted(doc.id)} testID="mark-accepted" /> : null}
        {isQuote && invoice ? <Button label={t('openInvoice', { number: invoice.number })} variant="secondary" onPress={() => go({ page: 'editor', docId: invoice.id })} testID="open-invoice" /> : null}
        {isQuote && !invoice && doc.status !== 'draft' ? <Button label={t('convertToInvoice')} onPress={convert} testID="convert" /> : null}
        {!isQuote && doc.status === 'due' ? <Button label={t('markPaid')} onPress={() => store.markPaid(doc.id)} testID="mark-paid" /> : null}
        {!isQuote && doc.status === 'paid' ? <Button label={t('markUnpaid')} variant="secondary" onPress={() => store.markUnpaid(doc.id)} testID="mark-unpaid" /> : null}
        <IconButton icon="trash" label={t('delete')} color={C.muted} onPress={remove} testID="delete-doc" />
      </View>

      <View style={snug ? { gap: 24 } : { flexDirection: 'row', alignItems: 'flex-start', gap: 24 }}>
        {/* The form */}
        <View style={[{ gap: 16, minWidth: 0 }, snug ? null : { flex: 1.15 }]}>
          <Panel style={{ padding: 16, gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <T size={13} w="semibold" color={C.muted}>
                  {t('customer')}
                </T>
              </View>
              <T size={13} color={C.muted}>
                {formatDate(doc.date, lang)}
              </T>
            </View>
            {doc.customerName ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Avatar name={doc.customerName} />
                <View style={{ flex: 1 }}>
                  <T size={15.5} w="semibold" numberOfLines={1}>
                    {doc.customerName}
                  </T>
                  {doc.customerPhone ? (
                    <T size={13} color={C.muted} latin>
                      {doc.customerPhone}
                    </T>
                  ) : null}
                </View>
                <Button label={t('change')} variant="ghost" size="sm" onPress={() => setPickingCustomer(true)} testID="change-customer" style={{ paddingHorizontal: 12 }} />
              </View>
            ) : (
              <Pressable
                accessibilityRole="button"
                onPress={() => setPickingCustomer(true)}
                testID="choose-customer"
                style={{ minHeight: 52, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.borderStrong, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 }}
              >
                <Icon name="user" color={C.greenText} />
                <T size={15} w="semibold" color={C.greenText}>
                  {t('chooseCustomer')}
                </T>
              </Pressable>
            )}
          </Panel>

          <Panel style={{ padding: 16, gap: 12 }}>
            <SearchBox value={query} onChangeText={setQuery} placeholder={t('searchAddItem')} testID="item-search" onSubmit={submitSearch} />
            {name ? (
              <View style={{ borderWidth: 1, borderColor: C.line, borderRadius: 12 }}>
                {suggestions.map((item, i) => (
                  <Pressable
                    key={item.id}
                    accessibilityRole="button"
                    onPress={() => addItem(item)}
                    testID={`suggest-${item.name}`}
                    style={{ minHeight: 44, paddingHorizontal: 14, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: C.lineSoft, backgroundColor: i === 0 ? '#F4F9F6' : 'transparent', borderTopLeftRadius: i === 0 ? 12 : 0, borderTopRightRadius: i === 0 ? 12 : 0 }}
                  >
                    <View style={{ flex: 1 }}>
                      <T size={14.5} w="medium" numberOfLines={1}>
                        {item.name}
                      </T>
                    </View>
                    {item.unit ? (
                      <T size={13} color={C.muted}>
                        {t('per', { unit: item.unit })}
                      </T>
                    ) : null}
                    <T size={14.5} w="semibold" latin color={item.price ? C.ink : C.muted}>
                      {item.price ? formatAmount(item.price) : '—'}
                    </T>
                  </Pressable>
                ))}
                {!exact ? (
                  <Pressable accessibilityRole="button" onPress={() => setNewName(name)} testID="item-add-new" style={{ minHeight: 44, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Icon name="plus" size={18} color={C.greenText} stroke={2.2} />
                    <T size={14.5} w="semibold" color={C.greenText}>
                      {t('addAsNewItem', { name })}
                    </T>
                  </Pressable>
                ) : null}
              </View>
            ) : (
              <T size={12.5} color={C.muted}>
                {t('enterToAdd')}
              </T>
            )}

            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 36, borderBottomWidth: 1, borderBottomColor: C.line }}>
                <View style={{ flex: 1 }}>
                  <T size={12.5} w="semibold" color={C.muted}>{t('colItem')}</T>
                </View>
                <View style={{ width: 64 }}>
                  <T size={12.5} w="semibold" color={C.muted} center>{t('colQty')}</T>
                </View>
                <View style={{ width: 100 }}>
                  <T size={12.5} w="semibold" color={C.muted} center>{t('price')}</T>
                </View>
                <View style={{ width: 92 }}>
                  <T size={12.5} w="semibold" color={C.muted} end>{t('colAmount')}</T>
                </View>
                <View style={{ width: 40 }} />
              </View>
              {doc.lines.length === 0 ? (
                <View style={{ paddingVertical: 22 }}>
                  <T size={14} color={C.muted} center>
                    {t('noLinesYet')}
                  </T>
                </View>
              ) : (
                doc.lines.map((line, i) => (
                  <View key={line.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 60, paddingVertical: 6, borderBottomWidth: i === doc.lines.length - 1 ? 0 : 1, borderBottomColor: C.lineSoft }}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <T size={14.5} w="semibold" numberOfLines={3}>
                        {line.name}
                      </T>
                      {line.unit ? (
                        <T size={12.5} color={C.muted}>
                          {t('per', { unit: line.unit })}
                        </T>
                      ) : null}
                      <LineStock doc={doc} line={line} levels={levels} />
                    </View>
                    <NumberField label={t('qty')} value={line.qty} onChange={(qty) => changeLine(line, { qty })} width={64} testID={`qty-${i}`} />
                    <NumberField label={t('price')} value={line.price} onChange={(price) => changeLine(line, { price })} width={100} blankZero testID={`price-${i}`} />
                    <View style={{ width: 92 }}>
                      <T size={14.5} w="semibold" latin end testID={`line-total-${i}`}>
                        {formatAmount(lineTotal(line))}
                      </T>
                    </View>
                    <IconButton icon="trash" label={t('removeItem', { name: line.name })} color={C.muted} size={40} onPress={() => editor.removeLine(line)} testID={`remove-${i}`} />
                  </View>
                ))
              )}
            </View>
          </Panel>

          <View style={{ flexDirection: 'row', gap: 16, alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Field label={`${t('notes')} (${t('optional')})`} value={doc.notes} onChangeText={(notes) => save({ notes })} placeholder={t('notesPh')} multiline testID="notes" />
            </View>
            <Panel style={{ width: 320, paddingHorizontal: 16, paddingVertical: 6 }}>
              <View style={{ minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <T size={14.5} color={C.muted}>{t('subtotal')}</T>
                <T size={14.5} w="semibold" latin testID="subtotal">{formatAmount(totals.subtotal)}</T>
              </View>
              <Divider />
              <View style={{ minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <T size={14.5} color={C.muted}>{t('discount')}</T>
                <NumberField label={t('discount')} value={doc.discount} onChange={(discount) => save({ discount })} height={40} align="end" blankZero testID="discount" />
              </View>
              <Divider />
              <Pressable accessibilityRole="button" onPress={() => setEditingTax(true)} testID="tax-row" style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <T size={14.5} color={C.muted}>{doc.taxPercent > 0 ? `${taxName} ${formatAmount(doc.taxPercent)}%` : t('tax')}</T>
                {doc.taxPercent > 0 ? <T size={14.5} w="semibold" latin>{formatAmount(totals.tax)}</T> : <T size={14.5} w="semibold" color={C.greenText}>{t('addTax')}</T>}
              </Pressable>
              <View style={{ height: 2, backgroundColor: C.ink }} />
              <View style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <T size={15} w="semibold">{t('total')}</T>
                <T size={22} w="bold" head latin testID="total">{money(totals.total, settings.currency)}</T>
              </View>
            </Panel>
          </View>
        </View>

        {/* The live preview */}
        <View style={snug ? { gap: 12, width: '100%', maxWidth: 640, alignSelf: 'center' } : [{ flex: 1, gap: 12, minWidth: 0 }, STICKY]}>
          {/* The actions sit above the page so they stay in reach on a short screen. */}
          {draft ? (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {isQuote ? null : <Button label={t('hold')} variant="secondary" size="lg" onPress={() => (doc.lines.length ? setFinishing('hold') : notify(t('needLine')))} style={{ flex: 1 }} testID="hold" />}
              <Button label={t('complete')} icon="check" size="lg" head onPress={complete} style={{ flex: 1.5 }} testID="complete" />
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button label={`${t('print')} / ${t('savePdf')}`} icon="printer" head onPress={print} style={{ flex: 1.3 }} testID="print" />
            <Button label={t('sendWhatsappText')} icon="chat" variant="secondary" onPress={whatsapp} style={{ flex: 1 }} testID="send-whatsapp-text" />
          </View>
          <Button label={t('thermalReceipt')} icon="printer" variant="secondary" onPress={() => finishFirst(() => setReceipt(true))} testID="open-receipt" />
          <View
            onLayout={(e: LayoutChangeEvent) => setPreviewWidth(Math.floor(e.nativeEvent.layout.width))}
            style={{ borderRadius: 6, backgroundColor: C.surface, overflow: 'hidden', boxShadow: '0 6px 24px rgba(11,31,23,0.14)' } as ViewStyle}
            testID="doc-preview"
          >
            {previewWidth > 0 ? <DocView ref={pageRef} html={html} width={previewWidth} /> : <View style={{ height: 420 }} />}
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {template('classic', t('tplClassic'))}
            {template('simple', t('tplSimple'))}
          </View>
        </View>
      </View>

      <CustomerPicker visible={pickingCustomer} onClose={() => setPickingCustomer(false)} onPick={pickCustomer} />
      <ReceiptSheet doc={doc} visible={receipt} onClose={() => setReceipt(false)} />
      <CompleteSheet
        doc={doc}
        visible={finishing === 'complete'}
        onClose={() => {
          setFinishing(null);
          if (!completed.current) after.current = null;
          completed.current = false;
        }}
        onDone={() => {
          completed.current = true;
        }}
      />
      <NewItemSheet
        name={newName ?? ''}
        visible={newName !== null}
        onClose={() => setNewName(null)}
        onAdd={(input) => {
          editor.addNewItem(input);
          setQuery('');
        }}
      />
      <HoldSheet doc={doc} visible={finishing === 'hold'} onClose={() => setFinishing(null)} onHeld={held} />
      <TaxSheet visible={editingTax} onClose={() => setEditingTax(false)} percent={doc.taxPercent} onSave={(taxPercent) => save({ taxPercent })} />
    </View>
  );
}
