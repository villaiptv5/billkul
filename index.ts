// On the phone this backs `localStorage` with SQLite; in a browser it does nothing.
import 'expo-sqlite/localStorage/install';

import { boot } from './src/boot';

boot();
