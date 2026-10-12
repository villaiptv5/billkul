import { useEffect, useState } from 'react';

/**
 * Long lists show the first rows only, then more on each tap of "Show more", so a shop with years
 * of bills still opens its lists at once. Changing `reset` (a filter or a search) starts again.
 */
export function usePaged<T>(list: T[], page = 100, reset: unknown = null): { rows: T[]; more: (() => void) | null } {
  const [shown, setShown] = useState(page);
  useEffect(() => setShown(page), [reset, page]);
  return { rows: list.length > shown ? list.slice(0, shown) : list, more: list.length > shown ? () => setShown(shown + page) : null };
}
