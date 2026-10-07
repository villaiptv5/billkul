import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { store, useAppState } from '../data/app';
import type { Account } from '../data/types';
import { api, type AccountView } from './api';

/** Turns the server's answer into the account kept on the device. */
export function toAccount(view: AccountView, token: string): Account {
  return { phone: view.phone, token, plan: view.plan, proUntil: view.proUntil, limits: view.limits, supportWhatsapp: view.supportWhatsapp };
}

export type SyncResult = 'ok' | 'offline' | 'signed_out';

let lastSync = 0;

/**
 * Tells the account server how much has been used and learns the plan from it.
 * Without internet nothing changes: the app goes on with what it last knew.
 */
export async function syncAccount(): Promise<SyncResult> {
  const { account, usage } = store.getState();
  if (!account) return 'signed_out';
  lastSync = Date.now();
  const result = await api.sync(account.token, usage);
  if (result.ok) {
    // The token has not changed while the request was out: the account is still the one that asked.
    if (store.getState().account?.token === account.token) {
      store.updateAccount(toAccount(result.account, account.token));
      store.raiseUsage({ docs: result.account.docsUsed, cash: result.account.cashUsed });
    }
    return 'ok';
  }
  if (result.error === 'signed_out') {
    store.signOut();
    return 'signed_out';
  }
  return 'offline';
}

/** Keeps the account in step: when the app opens, when it comes back to the front, and after something is made. */
export function useAccountSync(): void {
  const { account, usage } = useAppState();
  const token = account?.token ?? '';
  const first = useRef(true);

  useEffect(() => {
    if (!token) return;
    void syncAccount();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && Date.now() - lastSync > 5 * 60 * 1000) void syncAccount();
    });
    return () => sub.remove();
  }, [token]);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!token) return;
    const timer = setTimeout(() => void syncAccount(), 4000);
    return () => clearTimeout(timer);
  }, [token, usage.docs, usage.cash]);
}
