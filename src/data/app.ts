import { useSyncExternalStore } from 'react';
import { deviceKV } from './storage';
import { createStore, type State } from './store';

/** The one store for the running app. */
export const store = createStore(deviceKV());
store.load();

export function useAppState(): State {
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}
