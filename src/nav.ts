import type { NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { DocType } from './data/types';

export type TabParams = {
  Home: undefined;
  Documents: { type?: DocType } | undefined;
  Cash: undefined;
  Customers: undefined;
  Items: undefined;
};

export type RootParams = {
  SignIn: undefined;
  SetPassword: undefined;
  Setup: undefined;
  Tabs: NavigatorScreenParams<TabParams> | undefined;
  Editor: { docId: string };
  Preview: { docId: string };
  CustomerEdit: { id?: string } | undefined;
  ItemEdit: { id?: string } | undefined;
  Settings: undefined;
  Sales: undefined;
  Due: undefined;
  Customer: { id: string };
  Statement: { id: string };
  CashReport: { side?: 'in' | 'out' | 'all' } | undefined;
  ShopProfile: undefined;
};

export type RootNav = NativeStackNavigationProp<RootParams>;
