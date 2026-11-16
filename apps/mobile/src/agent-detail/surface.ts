import type { KeyValueStorage } from '@openagentspocket/core';
import type { LayoutMode } from '@openagentspocket/ui';
import { useCallback, useState } from 'react';

/** What the detail screen shows for an Agent: its conversation or its terminal. */
export type Surface = 'chat' | 'terminal';

/** What is on screen: the terminal only when it is the surface; Chat too beside it from `regular` up. */
export interface ShownSurfaces {
  chat: boolean;
  terminal: boolean;
}

/**
 * The surface in force on screen. Chat alone stays alone at any width: the terminal attaches (and
 * resizes the Agent's terminal on the Host) only when the user asks for it.
 */
export function shownSurfaces(surface: Surface, mode: LayoutMode): ShownSurfaces {
  return { chat: surface === 'chat' || mode !== 'compact', terminal: surface === 'terminal' };
}

/** How the terminal surface takes input: its key toolbar (the system keyboard types into it), or the Composer. */
export type TerminalInput = 'keys' | 'compose';

/** The one bar over the keyboard: the terminal's key toolbar or the Composer, never both. */
export type DockBar = 'keys' | 'composer';

/** Chat always writes in the Composer; the terminal shows the bar its input mode names. */
export function dockBar(surface: Surface, input: TerminalInput): DockBar {
  return surface === 'terminal' && input === 'keys' ? 'keys' : 'composer';
}

const STORAGE_KEY = 'agentDetail.surface';
const INPUT_KEY = 'agentDetail.terminalInput';

/** Keys unless the user last chose to compose on the terminal; one choice per device, not per Agent. */
export function readTerminalInput(storage: KeyValueStorage): TerminalInput {
  return storage.getString(INPUT_KEY) === 'compose' ? 'compose' : 'keys';
}

export function saveTerminalInput(storage: KeyValueStorage, input: TerminalInput): void {
  storage.set(INPUT_KEY, input);
}

/** Chat unless the user last chose the terminal. */
export function readSurface(storage: KeyValueStorage): Surface {
  return storage.getString(STORAGE_KEY) === 'terminal' ? 'terminal' : 'chat';
}

/** A deep-link param (`?surface=terminal`) as a Surface; anything else is no request. */
export function parseSurface(param: string | string[] | undefined): Surface | undefined {
  const value = Array.isArray(param) ? param[0] : param;
  return value === 'chat' || value === 'terminal' ? value : undefined;
}

/**
 * The surface in force and a setter that persists the choice. A deep link's surface wins for
 * this visit without overwriting the saved preference.
 */
export function useSurface(
  storage: KeyValueStorage,
  requested?: Surface,
  /** A new token re-applies `requested` on a detail that is already open (a Composer handoff). */
  request?: string,
): [Surface, (surface: Surface) => void] {
  const [chosen, setChosen] = useState<Surface | undefined>(requested);
  const [saved, setSaved] = useState(() => readSurface(storage));
  const [applied, setApplied] = useState(request);
  if (request !== applied) {
    setApplied(request);
    setChosen(requested);
  }
  const select = useCallback(
    (surface: Surface) => {
      storage.set(STORAGE_KEY, surface);
      setSaved(surface);
      setChosen(undefined);
    },
    [storage],
  );
  return [chosen ?? saved, select];
}
