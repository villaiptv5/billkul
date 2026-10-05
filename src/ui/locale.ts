import { useMemo } from 'react';
import { useAppState } from '../data/app';
import type { Lang } from '../data/types';
import { translate, type StringKey, type Vars } from '../i18n';

export interface Locale {
  lang: Lang;
  rtl: boolean;
  t: (key: StringKey, vars?: Vars) => string;
}

export function useLocale(): Locale {
  const lang = useAppState().settings.language;
  return useMemo(() => ({ lang, rtl: lang === 'ur', t: (key, vars) => translate(lang, key, vars) }), [lang]);
}
