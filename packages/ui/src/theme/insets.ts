import { createContext, useContext } from 'react';
import { type Edge, type EdgeInsets, SafeAreaInsetsContext } from 'react-native-safe-area-context';

const ZERO: EdgeInsets = { top: 0, right: 0, bottom: 0, left: 0 };
// Stands in when a test mocks the safe-area module without its context.
const Fallback = createContext<EdgeInsets | null>(null);

/** Which side of a split a pane sits on, in reading order: the leading pane comes first. */
export type PaneSide = 'leading' | 'trailing';

/** A pane's share of the window's safe area: the insets it reads and the edges it may pad. */
export interface PaneSafeArea {
  insets: EdgeInsets;
  edges: readonly Edge[];
}

/** Set by `SplitView` around each pane; outside a split the window's safe area is the screen's. */
export const PaneSafeAreaContext = createContext<PaneSafeArea | null>(null);

/**
 * The window's safe area shared between two panes, never doubled: both keep top and bottom, only the
 * leading pane keeps the leading side and only the trailing pane the trailing one. Each side is
 * copied as it is (a system column may sit on one side only), never derived from the other.
 */
export function paneSafeArea(window: EdgeInsets, side: PaneSide, rtl = false): PaneSafeArea {
  const leading: Edge = rtl ? 'right' : 'left';
  const trailing: Edge = rtl ? 'left' : 'right';
  const [own, other] = side === 'leading' ? [leading, trailing] : [trailing, leading];
  return { insets: { ...window, [other]: 0 }, edges: ['top', 'bottom', own] };
}

/**
 * Safe-area insets: the pane's share inside a `SplitView`, else the window's, or zero outside a
 * SafeAreaProvider (tests, previews) instead of throwing.
 */
export function useInsets(): EdgeInsets {
  const window = useContext(SafeAreaInsetsContext ?? Fallback) ?? ZERO;
  return useContext(PaneSafeAreaContext)?.insets ?? window;
}
