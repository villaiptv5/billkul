import type { Lang } from '../data/types';
import { en, type StringKey } from './en';
import { ur } from './ur';

const TABLES = { en, ur };

export type Vars = Record<string, string | number>;

export function translate(lang: Lang, key: StringKey, vars?: Vars): string {
  let text: string = TABLES[lang][key] ?? en[key] ?? key;
  if (vars) {
    for (const name of Object.keys(vars)) text = text.split(`{${name}}`).join(String(vars[name]));
  }
  return text;
}

export function isRTL(lang: Lang): boolean {
  return lang === 'ur';
}

export type { StringKey };
