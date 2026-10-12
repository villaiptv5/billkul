import { registerRootComponent } from 'expo';

import App from '../App';

/** On the phone the app starts at once; its storage is SQLite and needs no loading. */
export function boot() {
  registerRootComponent(App);
}
