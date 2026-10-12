import { registerRootComponent } from 'expo';

import { loadWebKV } from './data/webKV';

/**
 * On the PC the shop is read from the browser's database first, then the app starts. The app is
 * required only after that, because its store reads the shop the moment it is loaded.
 */
export function boot() {
  void loadWebKV().finally(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const App = require('../App').default;
    registerRootComponent(App);
  });
}
