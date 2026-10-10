import { useEffect } from 'react';
import { AppState } from 'react-native';
import { api } from '../account/api';
import { store, useAppState } from '../data/app';
import { deviceKV } from '../data/storage';
import { createSync } from './engine';

/** The running app's sync, talking to the account server. */
export const sync = createSync(store, deviceKV(), {
  push: (token, changes) => api.syncPush(token, changes),
  pull: (token, since) => api.syncPull(token, since),
});

const EVERY_MS = 5000;
const AFTER_CHANGE_MS = 1200;

/**
 * Pro: while the app is open, looks for changes from the other devices every few seconds, and sends
 * changes made here a moment after they are made. Nothing runs for a Free account.
 */
export function useLiveSync(): void {
  const { account } = useAppState();
  const on = !!account && account.plan === 'pro';
  const token = account?.token ?? '';

  useEffect(() => {
    if (!on) return;
    let active = AppState.currentState !== 'background';
    let soon: ReturnType<typeof setTimeout> | null = null;
    const run = () => {
      if (active) void sync.syncNow();
    };
    run();
    const timer = setInterval(run, EVERY_MS);
    const appState = AppState.addEventListener('change', (next) => {
      active = next === 'active';
      // Going to the background: send what is waiting. Coming back: catch up at once.
      void sync.syncNow();
    });
    const unsubscribe = store.subscribe(() => {
      if (soon) clearTimeout(soon);
      soon = setTimeout(() => void sync.syncNow(), AFTER_CHANGE_MS);
    });
    return () => {
      clearInterval(timer);
      appState.remove();
      unsubscribe();
      if (soon) clearTimeout(soon);
    };
  }, [on, token]);
}
