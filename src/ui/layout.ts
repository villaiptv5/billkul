import { Platform, useWindowDimensions } from 'react-native';

/** From this window width up, the web version uses the desktop layout instead of the phone one. */
export const DESKTOP_MIN_WIDTH = 1000;
/** Below this the desktop pages fold to one column, so nothing is squeezed. */
export const DESKTOP_ROOMY_WIDTH = 1160;
/** Below this the sidebar shrinks to a narrow rail of icons. */
export const SIDEBAR_FULL_WIDTH = 1340;

export function useWide(): boolean {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= DESKTOP_MIN_WIDTH;
}

/** How much room the desktop layout has: `rail` for the narrow sidebar, `snug` for one-column pages. */
export function useDeskSize(): { rail: boolean; snug: boolean } {
  const { width } = useWindowDimensions();
  return { rail: width < SIDEBAR_FULL_WIDTH, snug: width < DESKTOP_ROOMY_WIDTH };
}
