import { createContext, useContext } from 'react';
import { useWindowDimensions } from 'react-native';

/** One column on a phone; two side by side; two wide ones; those two and a sidebar. */
export type LayoutMode = 'compact' | 'regular' | 'wide' | 'expansive';

const REGULAR_WIDTH = 600;
const WIDE_WIDTH = 860;
const EXPANSIVE_WIDTH = 1160;

export function layoutModeFor(width: number): LayoutMode {
  if (width >= EXPANSIVE_WIDTH) return 'expansive';
  if (width >= WIDE_WIDTH) return 'wide';
  return width >= REGULAR_WIDTH ? 'regular' : 'compact';
}

/** Set by `SplitView` around each pane, from the pane's own width. */
export const PaneLayoutModeContext = createContext<LayoutMode | null>(null);

/**
 * The one place a screen learns how much room it has: never a width check of its own. Inside a
 * `SplitView` pane it is the pane's room, else the window's.
 */
export function useLayoutMode(): LayoutMode {
  const window = layoutModeFor(useWindowDimensions().width);
  return useContext(PaneLayoutModeContext) ?? window;
}
