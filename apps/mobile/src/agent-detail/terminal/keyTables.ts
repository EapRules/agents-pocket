import {
  character,
  FUNCTION_KEYS,
  keyTitle,
  type Modifier,
  type QuickKey,
  quickKeyId,
} from '@openagentspocket/core';
import { t } from '@openagentspocket/i18n';
import type { IconName, KeySpec } from '@openagentspocket/ui';

/** Keys the dock rows carry, as data; a row cell is a quick key or a sticky modifier. */
type Cell = QuickKey | { readonly modifier: Modifier };

const ARROW_ICONS: Record<string, IconName> = {
  left: 'arrowLeft',
  up: 'arrowUp',
  down: 'arrowDown',
  right: 'arrowRight',
  enter: 'enter',
  backspace: 'backspace',
};

const SPOKEN: Record<string, () => string> = {
  escape: () => t('Escape'),
  tab: () => t('Tab'),
  shiftTab: () => t('Shift Tab'),
  shiftEnter: () => t('Shift Enter'),
  left: () => t('Left Arrow'),
  up: () => t('Up Arrow'),
  down: () => t('Down Arrow'),
  right: () => t('Right Arrow'),
  enter: () => t('Enter'),
  backspace: () => t('Backspace'),
  home: () => t('Home'),
  end: () => t('End'),
  insert: () => t('Insert'),
  forwardDelete: () => t('Forward Delete'),
  pageUp: () => t('Page Up'),
  pageDown: () => t('Page Down'),
};

/** The spoken name of a key (Swift `AgentQuickKey.accessibilityLabel`). */
export function spokenName(key: QuickKey): string {
  if (typeof key !== 'string') return key.character === ' ' ? t('Space') : key.character;
  return SPOKEN[key]?.() ?? key.toUpperCase();
}

const MODIFIERS: Record<Modifier, { label: string; spoken: () => string }> = {
  control: { label: 'Ctrl', spoken: () => t('Control modifier') },
  option: { label: 'Alt', spoken: () => t('Option modifier') },
  shift: { label: 'Shift', spoken: () => t('Shift modifier') },
};

/** The dock's key for `key`; the id is the quick key's id so a tap maps back through `lookup`. */
export function keySpec(key: QuickKey): KeySpec {
  const icon = typeof key === 'string' ? ARROW_ICONS[key] : undefined;
  return {
    id: quickKeyId(key),
    label: keyTitle(key) ?? '',
    icon,
    accessibilityLabel: spokenName(key),
  };
}

/** Maps a tapped `KeySpec` id back to its quick key. */
export type KeyLookup = ReadonlyMap<string, QuickKey>;

export interface KeyRows {
  readonly rows: readonly (readonly KeySpec[])[];
  readonly lookup: KeyLookup;
}

/** A cell with its share of a fitted row (a letter is 1). */
interface Weighted {
  readonly cell: Cell;
  readonly weight: number;
}

const weighted = (cell: Cell, weight: number): Weighted => ({ cell, weight });
const isWeighted = (entry: Cell | Weighted): entry is Weighted =>
  typeof entry === 'object' && 'weight' in entry;

function build(cells: readonly (readonly (Cell | Weighted)[])[]): KeyRows {
  const lookup = new Map<string, QuickKey>();
  const rows = cells.map((row) =>
    row.map((entry): KeySpec => {
      const cell = isWeighted(entry) ? entry.cell : entry;
      const spec = specOf(cell);
      return isWeighted(entry) ? { ...spec, weight: entry.weight } : spec;
    }),
  );
  return { rows, lookup };

  function specOf(cell: Cell): KeySpec {
    if (typeof cell === 'object' && 'modifier' in cell) {
      const info = MODIFIERS[cell.modifier];
      const ui =
        cell.modifier === 'control' ? 'ctrl' : cell.modifier === 'option' ? 'alt' : 'shift';
      return {
        id: `mod-${cell.modifier}`,
        label: info.label,
        accessibilityLabel: info.spoken(),
        modifier: ui,
      };
    }
    lookup.set(quickKeyId(cell), cell);
    return keySpec(cell);
  }
}

const chars = (text: string): QuickKey[] => [...text].map(character);

const MODS: Cell[] = [{ modifier: 'control' }, { modifier: 'option' }, { modifier: 'shift' }];

/** Controls: the keys a TUI wants and the system keyboard lacks (Swift Control Keys pane). */
export const CONTROL_KEYS: KeyRows = build([
  [...MODS, 'escape', 'tab', 'shiftTab', 'backspace', 'forwardDelete'],
  ['left', 'up', 'down', 'right', 'home', 'end', 'pageUp', 'pageDown'],
  ['shiftEnter', 'enter', 'insert', ...chars('/\\|~`-_')],
  FUNCTION_KEYS,
]);

/**
 * The full keyboard for a phone: US QWERTY in six fitted rows of at most 11 cells, so a key stays near
 * 29 pt wide on 375 pt. Esc, Tab and the function keys live in `CONTROL_KEYS` and the key toolbar.
 */
export const FULL_KEYBOARD: KeyRows = build([
  chars("`-=[]\\;',./"),
  chars('1234567890'),
  chars('qwertyuiop'),
  [...chars('asdfghjkl'), weighted('backspace', 2)],
  [weighted({ modifier: 'shift' }, 1.5), ...chars('zxcvbnm'), 'up', weighted('enter', 1.5)],
  [
    weighted({ modifier: 'control' }, 1.5),
    weighted({ modifier: 'option' }, 1.5),
    weighted(character(' '), 5),
    'left',
    'down',
    'right',
  ],
]);

/** The menu's Commands > Keys, as dock keys. */
export const keyLabel = (key: QuickKey): string => keyTitle(key) ?? spokenName(key);
