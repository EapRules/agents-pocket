import type { ComponentType } from 'react';
import { Platform } from 'react-native';
import { PlainTerminal } from './PlainTerminal';
import type { TerminalViewProps } from './terminalTypes';

export type { TerminalHandle, TerminalViewProps } from './terminalTypes';

/**
 * Whether the native view asks before it sends a bracketed paste. On Android its Paste (menu and
 * accessory bar) shows its own dialog for multi-line text and is the only source of bracketed
 * input; IME commits arrive unbracketed. On iOS a paste is sent without asking.
 */
export const terminalViewReviewsBracketedPaste = Platform.OS === 'android';

let native: ComponentType<TerminalViewProps> | null | undefined;

/**
 * The libghostty renderer when the app binary includes it (ADR 0023), else null. Loaded on
 * first use because `expo-libghostty` throws at import when its native view is missing
 * (unit tests, Expo Go, web).
 */
function nativeTerminal(required: boolean): ComponentType<TerminalViewProps> | null {
  if (native === undefined || (required && native === null)) {
    try {
      const { requireOptionalNativeModule } = require('expo');
      if (!requireOptionalNativeModule('ExpoLibghostty')) throw new Error('ExpoLibghostty missing');
      native = require('./GhosttyTerminal').GhosttyTerminal;
    } catch (error) {
      native = null;
      if (required) throw error;
    }
  }
  return native ?? null;
}

/**
 * The one terminal surface for Agent attach and shells. Renders with libghostty when available;
 * otherwise (or with `renderer="plain"`: demo mode, tests, gallery) the plain-text fallback.
 */
export function TerminalView({
  renderer = 'auto',
  ...props
}: TerminalViewProps & { renderer?: 'auto' | 'plain' | 'native' }) {
  const Native = renderer === 'plain' ? null : nativeTerminal(renderer === 'native');
  return Native ? <Native {...props} /> : <PlainTerminal {...props} />;
}
