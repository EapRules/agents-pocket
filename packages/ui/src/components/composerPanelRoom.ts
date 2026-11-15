import {
  createContext,
  createElement,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Keyboard, Platform, useWindowDimensions } from 'react-native';
import { CHROME_KEYBOARD_GAP } from '../theme/chrome';
import { airy, spacing } from '../theme/metrics';
import { typography } from '../theme/typography';

/** Of the window's height: the panel's upper bound with no keyboard. */
export const PANEL_MAX_SHARE = 0.3;
/** The panel's head (title row with Close) and its top padding. */
export const PANEL_HEAD = 32 + spacing.sm;
/** One row of the panel: a title line and a description line between its vertical padding. */
export const PANEL_ROW =
  2 * airy.stack + typography.body.lineHeight + typography.caption.lineHeight;
/** The panel never shrinks under the head and this many rows, whatever is left. */
export const PANEL_MIN_ROWS = 3;
/** What the Chat keeps above the Composer: its status line and a strip of transcript. */
export const STATUS_LINE_ROOM = typography.body.lineHeight + 2 * spacing.sm;
export const TRANSCRIPT_STRIP = 3 * typography.body.lineHeight;

export interface PanelRoom {
  windowHeight: number;
  /** From the window's top to the bottom of the screen's header: nothing is laid out over it. */
  topChrome: number;
  /** The keyboard's height; 0 while it is down. */
  keyboardHeight: number;
  /** The Composer's own height, the open panel left out. */
  composerHeight: number;
}

/**
 * The tallest a Composer panel (head included) may be: its share of the window, and never more than
 * is left between the header and the Composer once the status line and a strip of transcript stay
 * visible. The strip gives way before the header does; the floor is the head and three rows.
 */
export function composerPanelMaxHeight(room: PanelRoom): number {
  const floor = PANEL_HEAD + PANEL_MIN_ROWS * PANEL_ROW;
  const left = room.windowHeight - room.topChrome - room.keyboardHeight - room.composerHeight;
  const withStrip = left - STATUS_LINE_ROOM - TRANSCRIPT_STRIP;
  const withoutStrip = left - STATUS_LINE_ROOM;
  const fit = withStrip >= floor ? withStrip : Math.max(withoutStrip, floor);
  return Math.max(floor, Math.min(room.windowHeight * PANEL_MAX_SHARE, fit));
}

/** The screen's header bottom, and (for a drawn state) a simulated keyboard height. */
export interface ComposerRoomValue {
  top: number;
  keyboardHeight?: number;
}
const ComposerRoomContext = createContext<ComposerRoomValue>({ top: 0 });

/** A screen states where its header ends; a simulated keyboard height set above it carries through. */
export function ComposerRoomProvider({
  top,
  keyboardHeight,
  children,
}: ComposerRoomValue & { children: ReactNode }) {
  const parent = useContext(ComposerRoomContext);
  const value = useMemo(
    () => ({ top, keyboardHeight: keyboardHeight ?? parent.keyboardHeight }),
    [top, keyboardHeight, parent.keyboardHeight],
  );
  return createElement(ComposerRoomContext.Provider, { value }, children);
}

/** The keyboard's height while it is up (0 on web and while it is down). */
function useKeyboardHeight(): number {
  const [height, setHeight] = useState(() => Keyboard.metrics?.()?.height ?? 0);
  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const shown = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (event) =>
      setHeight(event.endCoordinates.height),
    );
    const hidden = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () =>
      setHeight(0),
    );
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);
  return height;
}

/** The panel's max height for a Composer `composerHeight` tall, from what the screen provides. */
export function useComposerPanelMax(composerHeight: number): number {
  const { height } = useWindowDimensions();
  const room = useContext(ComposerRoomContext);
  const real = useKeyboardHeight();
  return composerPanelMaxHeight({
    windowHeight: height,
    topChrome: room.top,
    keyboardHeight: room.keyboardHeight ?? real,
    composerHeight: composerHeight + CHROME_KEYBOARD_GAP,
  });
}
