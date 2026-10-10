import React from 'react';
import { Platform, Pressable, useWindowDimensions, View } from 'react-native';
import { createBottomTabNavigator, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAccountSync } from './src/account/sync';
import { useAutoDriveBackup } from './src/backup/auto';
import { useLiveSync } from './src/sync/live';
import { useAppState } from './src/data/app';
import { DesktopApp } from './src/desktop/DesktopApp';
import type { StringKey } from './src/i18n';
import type { RootParams, TabParams } from './src/nav';
import { CashScreen } from './src/screens/CashScreen';
import { CustomerScreen, DueScreen } from './src/screens/customer';
import { CustomerEditScreen } from './src/screens/CustomerEditScreen';
import { CustomersScreen } from './src/screens/CustomersScreen';
import { DocumentsScreen } from './src/screens/DocumentsScreen';
import { EditorScreen } from './src/screens/EditorScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { ItemEditScreen } from './src/screens/ItemEditScreen';
import { ItemsScreen } from './src/screens/ItemsScreen';
import { PreviewScreen } from './src/screens/PreviewScreen';
import { CashReportScreen, StatementScreen } from './src/screens/reports';
import { SalesScreen } from './src/screens/sales';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { SetupScreen } from './src/screens/SetupScreen';
import { SetPasswordScreen, SignInScreen } from './src/screens/SignInScreen';
import { LimitsProvider } from './src/screens/limits';
import { ShopProfileScreen } from './src/screens/ShopProfileScreen';
import { C } from './src/theme';
import { FONT_ASSETS } from './src/ui/fonts';
import { Icon, type IconName } from './src/ui/Icon';
import { DialogHost } from './src/ui/kit';
import { useWide } from './src/ui/layout';
import { useLocale } from './src/ui/locale';
import { T } from './src/ui/T';

const Stack = createNativeStackNavigator<RootParams>();
const Tab = createBottomTabNavigator<TabParams>();

const TABS: Record<keyof TabParams, { icon: IconName; label: StringKey }> = {
  Home: { icon: 'home', label: 'tabHome' },
  Documents: { icon: 'file', label: 'tabDocuments' },
  Cash: { icon: 'wallet', label: 'tabCash' },
  Customers: { icon: 'users', label: 'tabCustomers' },
  Items: { icon: 'box', label: 'tabItems' },
};

function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { t, rtl } = useLocale();
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: 'row', backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.line, paddingBottom: insets.bottom, direction: rtl ? 'rtl' : 'ltr' }}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const tab = TABS[route.name as keyof TabParams];
        const color = focused ? C.greenText : C.muted;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={t(tab.label)}
            testID={`tab-${route.name}`}
            onPress={() => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
            }}
            style={{ flex: 1, minHeight: 64, alignItems: 'center', justifyContent: 'center', gap: 3, paddingVertical: 6 }}
          >
            <Icon name={tab.icon} color={color} stroke={focused ? 2.1 : 1.8} />
            <T size={11.5} w={focused ? 'semibold' : 'medium'} color={color} center numberOfLines={1}>
              {t(tab.label)}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

function Tabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Documents" component={DocumentsScreen} />
      <Tab.Screen name="Cash" component={CashScreen} />
      <Tab.Screen name="Customers" component={CustomersScreen} />
      <Tab.Screen name="Items" component={ItemsScreen} />
    </Tab.Navigator>
  );
}

/** Width of the app column when it is shown on a computer screen. */
export const PHONE_WIDTH = 412;

const NAV_THEME = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: C.bg, card: C.surface, text: C.ink, border: C.line, primary: C.greenText } };

export default function App() {
  const [fontsReady] = useFonts(FONT_ASSETS);
  const { ready, settings, account } = useAppState();
  useAccountSync();
  useAutoDriveBackup();
  useLiveSync();

  // In a browser the app has two layouts: the desktop one on a wide window, and the phone one,
  // kept at a phone's width and centred, on a narrow window.
  const { width } = useWindowDimensions();
  const wide = useWide();
  const framed = Platform.OS === 'web' && width > PHONE_WIDTH + 40;

  if (!fontsReady || !ready) return <View style={{ flex: 1, backgroundColor: C.ink }} />;

  if (wide) {
    return (
      <SafeAreaProvider>
        <DialogHost>
          <LimitsProvider>
            <DesktopApp />
          </LimitsProvider>
        </DialogHost>
      </SafeAreaProvider>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: framed ? '#06130E' : C.bg, alignItems: framed ? 'center' : 'stretch' }}>
    <View style={framed ? { flex: 1, width: PHONE_WIDTH, overflow: 'hidden' } : { flex: 1 }}>
    <SafeAreaProvider>
      <DialogHost>
        <LimitsProvider>
        <NavigationContainer theme={NAV_THEME}>
          <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }}>
            {!account ? (
              <Stack.Screen name="SignIn" component={SignInScreen} />
            ) : account.hasPassword === false || account.resetPassword ? (
              <Stack.Screen name="SetPassword" component={SetPasswordScreen} />
            ) : settings.setupDone ? (
              <>
                <Stack.Screen name="Tabs" component={Tabs} />
                <Stack.Screen name="Editor" component={EditorScreen} />
                <Stack.Screen name="Preview" component={PreviewScreen} />
                <Stack.Screen name="CustomerEdit" component={CustomerEditScreen} />
                <Stack.Screen name="ItemEdit" component={ItemEditScreen} />
                <Stack.Screen name="Settings" component={SettingsScreen} />
                <Stack.Screen name="Sales" component={SalesScreen} />
                <Stack.Screen name="Due" component={DueScreen} />
                <Stack.Screen name="Customer" component={CustomerScreen} />
                <Stack.Screen name="Statement" component={StatementScreen} />
                <Stack.Screen name="CashReport" component={CashReportScreen} />
                <Stack.Screen name="ShopProfile" component={ShopProfileScreen} />
              </>
            ) : (
              <Stack.Screen name="Setup" component={SetupScreen} />
            )}
          </Stack.Navigator>
        </NavigationContainer>
        </LimitsProvider>
        <StatusBar style="dark" />
      </DialogHost>
    </SafeAreaProvider>
    </View>
    </View>
  );
}
