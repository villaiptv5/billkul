import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { store, useAppState } from '../data/app';
import type { DocType } from '../data/types';
import type { StringKey } from '../i18n';
import { useBackupActions } from '../screens/backupActions';
import { SetupScreen } from '../screens/SetupScreen';
import { C } from '../theme';
import { Button } from '../ui/Button';
import { Icon, type IconName } from '../ui/Icon';
import { useDeskSize } from '../ui/layout';
import { useLocale } from '../ui/locale';
import { T } from '../ui/T';
import { CashPage } from './CashPage';
import { CustomerPage, DuePage } from './CustomerPage';
import { CustomersPage } from './CustomersPage';
import { CashReportPage, StatementPage } from './ReportPages';
import { DocumentsPage } from './DocumentsPage';
import { EditorPage } from './EditorPage';
import { HomePage } from './HomePage';
import { ItemsPage } from './ItemsPage';
import { SalesPage } from './SalesPage';
import { DeskContext, fromHash, toHash, type Desk, type Route } from './route';
import { SettingsPage } from './SettingsPage';

const SIDEBAR_WIDTH = 248;
const RAIL_WIDTH = 88;

type NavPage = 'home' | 'documents' | 'cash' | 'sales' | 'customers' | 'items' | 'settings';

const NAV: { page: NavPage; icon: IconName; label: StringKey }[] = [
  { page: 'home', icon: 'home', label: 'tabHome' },
  { page: 'documents', icon: 'file', label: 'tabDocuments' },
  { page: 'cash', icon: 'wallet', label: 'cashBook' },
  { page: 'sales', icon: 'chart', label: 'salesReport' },
  { page: 'customers', icon: 'users', label: 'tabCustomers' },
  { page: 'items', icon: 'box', label: 'tabItems' },
  { page: 'settings', icon: 'sliders', label: 'tabSettings' },
];

/** The logo is never mirrored or translated: same order and same side in every language. */
function Logo({ markOnly }: { markOnly?: boolean }) {
  return (
    <View style={{ direction: 'ltr', flexDirection: 'row', alignItems: 'center', gap: 10 }} accessible accessibilityLabel="BillKul">
      <Image source={require('../../assets/icon.png')} style={{ width: 36, height: 36, borderRadius: 9 }} />
      {markOnly ? null : (
        <Text style={{ fontFamily: 'Sora_700Bold', fontSize: 21, lineHeight: 28, color: C.onInk, writingDirection: 'ltr' }} testID="wordmark">
          Bill<Text style={{ color: C.green }}>Kul</Text>
        </Text>
      )}
    </View>
  );
}

function NavItem({ icon, label, active, rail, onPress, testID }: { icon: IconName; label: string; active: boolean; rail: boolean; onPress: () => void; testID: string }) {
  const [hovered, setHovered] = useState(false);
  const color = active ? C.onInk : C.onInkSoft;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      testID={testID}
      style={[
        { borderRadius: 12, alignItems: 'center', backgroundColor: active ? C.inkPanel : hovered ? '#102A1E' : 'transparent' },
        rail ? { minHeight: 58, paddingVertical: 6, justifyContent: 'center', gap: 2 } : { minHeight: 46, paddingHorizontal: 12, flexDirection: 'row', gap: 12 },
      ]}
    >
      <Icon name={icon} color={active ? C.green : color} stroke={active ? 2.1 : 1.8} />
      <T size={rail ? 11.5 : 15} w={active ? 'semibold' : 'medium'} color={color} center={rail} numberOfLines={1}>
        {label}
      </T>
    </Pressable>
  );
}

/** "New quote" or "New invoice" on the narrow rail: a plus with the kind of document under it. */
function RailNew({ label, hint, filled, onPress, testID }: { label: string; hint: string; filled?: boolean; onPress: () => void; testID: string }) {
  const fg = filled ? C.ink : C.onInk;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={hint}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => ({ minHeight: 54, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 1, paddingVertical: 5, backgroundColor: filled ? C.green : 'transparent', borderWidth: filled ? 0 : 1.5, borderColor: '#5E7469', opacity: pressed ? 0.7 : 1 })}
    >
      <Icon name="plus" size={18} color={fg} stroke={2.3} />
      <T size={11.5} w="semibold" color={fg} center numberOfLines={1}>
        {label}
      </T>
    </Pressable>
  );
}

function Sidebar({ route, go, onNew, rail }: { route: Route; go: (r: Route) => void; onNew: (type: DocType) => void; rail: boolean }) {
  const { t } = useLocale();
  const { settings } = useAppState();
  const backup = useBackupActions();
  // Pages that are not in the sidebar light up the entry they were opened from.
  const PARENT: Partial<Record<Route['page'], NavPage>> = { editor: 'documents', cashReport: 'cash', due: 'home', customer: 'customers', statement: 'customers' };
  const current: NavPage = PARENT[route.page] ?? (route.page as NavPage);

  const open = (page: NavPage) => go(page === 'documents' ? { page, type: route.page === 'documents' ? route.type : 'quote' } : { page });
  const backupColor = backup.backedUp ? C.mint : C.orangeOnInk;

  return (
    <View role="navigation" style={{ width: rail ? RAIL_WIDTH : SIDEBAR_WIDTH, backgroundColor: C.ink, paddingHorizontal: rail ? 8 : 16, paddingTop: 22, paddingBottom: 16, gap: 22 }}>
      {rail ? (
        <View style={{ alignItems: 'center' }}>
          <Logo markOnly />
        </View>
      ) : (
        <View style={{ paddingHorizontal: 6, gap: 14 }}>
          <Logo />
          <T size={13.5} color={C.onInkMuted} numberOfLines={1}>
            {settings.shopName || t('myShop')}
          </T>
        </View>
      )}

      {rail ? (
        <View style={{ gap: 8 }}>
          <RailNew label={t('quote')} hint={t('newQuote')} filled onPress={() => onNew('quote')} testID="side-new-quote" />
          <RailNew label={t('invoice')} hint={t('newInvoice')} onPress={() => onNew('invoice')} testID="side-new-invoice" />
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          <Button label={t('newQuote')} icon="plus" variant="onInk" head onPress={() => onNew('quote')} testID="side-new-quote" />
          <Button label={t('newInvoice')} variant="onInkOutline" onPress={() => onNew('invoice')} testID="side-new-invoice" />
        </View>
      )}

      {/* The list scrolls by itself, so every page stays in reach on a short screen. */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 4 }} showsVerticalScrollIndicator={false}>
        {NAV.map((item) => (
          <NavItem key={item.page} icon={item.icon} label={t(rail && item.page === 'cash' ? 'tabCash' : rail && item.page === 'sales' ? 'sales' : item.label)} active={current === item.page} rail={rail} onPress={() => open(item.page)} testID={`nav-${item.page}`} />
        ))}
      </ScrollView>

      <Pressable
        accessibilityRole="link"
        accessibilityLabel={backup.status}
        onPress={() => go({ page: 'settings' })}
        testID="side-backup"
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: rail ? 'center' : 'flex-start', gap: 10, paddingHorizontal: 6, minHeight: 44 }}
      >
        <Icon name={backup.backedUp ? 'cloudCheck' : 'cloudOff'} size={rail ? 22 : 20} color={backupColor} stroke={2} />
        {rail ? null : (
          <View style={{ flex: 1 }}>
            <T size={12.5} color={backupColor}>
              {backup.status}
            </T>
          </View>
        )}
      </Pressable>
    </View>
  );
}

function currentRoute(): Route {
  return fromHash(typeof window === 'undefined' ? '' : window.location.hash);
}

/** The app as it appears on a computer screen: a sidebar, and pages that use the full width. */
export function DesktopApp() {
  const { rtl } = useLocale();
  const { settings, docs, customers } = useAppState();
  const [route, setRoute] = useState<Route>(currentRoute);
  // How many pages deep this visit is, kept in the browser's own history entries so Back never leaves the app by surprise.
  const depth = useRef<number>((typeof window !== 'undefined' && (window.history.state as { bk?: number } | null)?.bk) || 0);
  const scroll = useRef<ScrollView>(null);
  const { rail, snug } = useDeskSize();

  useEffect(() => {
    // Back and Forward in the browser, and an address typed by hand.
    const onPop = (e: PopStateEvent) => {
      depth.current = (e.state as { bk?: number } | null)?.bk ?? 0;
      setRoute(currentRoute());
    };
    const onHash = () => setRoute(currentRoute());
    window.addEventListener('popstate', onPop);
    window.addEventListener('hashchange', onHash);
    return () => {
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('hashchange', onHash);
    };
  }, []);

  const go = useCallback((next: Route) => {
    const hash = toHash(next);
    if (window.location.hash !== hash) {
      depth.current += 1;
      window.history.pushState({ bk: depth.current }, '', hash);
    }
    setRoute(next);
  }, []);

  const replace = useCallback((next: Route) => {
    window.history.replaceState({ bk: depth.current }, '', toHash(next));
    setRoute(next);
  }, []);

  /** The back arrow on a page: the page before this one, or the Dashboard when there is none. */
  const back = useCallback(() => {
    if (depth.current > 0) window.history.back();
    else replace({ page: 'home' });
  }, [replace]);

  const desk = useMemo<Desk>(() => ({ route, go, back }), [route, go, back]);

  const onNew = useCallback(
    (type: DocType) => {
      const doc = store.createDoc(type);
      go({ page: 'editor', docId: doc.id });
    },
    [go],
  );

  // An address that points at a document which no longer exists falls back to the list.
  const missing = route.page === 'editor' && !docs.some((d) => d.id === route.docId);
  const missingCustomer = (route.page === 'customer' || route.page === 'statement') && !customers.some((c) => c.id === route.id);
  useEffect(() => {
    if (missing) replace({ page: 'documents', type: 'quote' });
    else if (missingCustomer) replace({ page: 'customers' });
  }, [missing, missingCustomer, replace]);

  const pageKey = route.page === 'editor' ? `doc:${route.docId}` : route.page === 'customer' || route.page === 'statement' ? `${route.page}:${route.id}` : route.page;
  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [pageKey]);

  if (!settings.setupDone) {
    return (
      <View style={{ flex: 1, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <View style={{ width: '100%', maxWidth: 520, flex: 1, maxHeight: 900, borderRadius: 24, overflow: 'hidden', backgroundColor: C.surface }}>
          <SetupScreen />
        </View>
      </View>
    );
  }

  let page: React.ReactNode = null;
  if (!missing && !missingCustomer) {
    switch (route.page) {
      case 'home':
        page = <HomePage onNew={onNew} />;
        break;
      case 'documents':
        page = <DocumentsPage type={route.type} onNew={onNew} />;
        break;
      case 'cash':
        page = <CashPage />;
        break;
      case 'cashReport':
        page = <CashReportPage />;
        break;
      case 'due':
        page = <DuePage />;
        break;
      case 'customer':
        page = <CustomerPage key={route.id} id={route.id} />;
        break;
      case 'statement':
        page = <StatementPage key={route.id} id={route.id} />;
        break;
      case 'sales':
        page = <SalesPage />;
        break;
      case 'customers':
        page = <CustomersPage />;
        break;
      case 'items':
        page = <ItemsPage />;
        break;
      case 'settings':
        page = <SettingsPage />;
        break;
      case 'editor':
        page = <EditorPage key={route.docId} docId={route.docId} />;
        break;
    }
  }

  return (
    <DeskContext.Provider value={desk}>
      <View style={{ flex: 1, flexDirection: 'row', backgroundColor: C.bg, direction: rtl ? 'rtl' : 'ltr' }}>
        <Sidebar route={route} go={go} onNew={onNew} rail={rail} />
        <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: snug ? 24 : 32, paddingTop: 28, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
          <View role="main" style={{ width: '100%', maxWidth: 1240, alignSelf: 'center' }}>
            {page}
          </View>
        </ScrollView>
      </View>
    </DeskContext.Provider>
  );
}
