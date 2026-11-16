import { encodeQuickKey, NO_MODIFIERS } from '@openagentspocket/core';
import { CONTROL_KEYS, FULL_KEYBOARD, type KeyRows } from './keyTables';

describe.each([
  ['control keys', CONTROL_KEYS],
  ['full keyboard', FULL_KEYBOARD],
] as [string, KeyRows][])('%s table', (_name, table) => {
  const specs = table.rows.flat();

  it('has unique ids, so a tap maps back to exactly one key', () => {
    const ids = specs.map((spec) => spec.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('maps every non-modifier key back and encodes it', () => {
    for (const spec of specs.filter((candidate) => !candidate.modifier)) {
      const key = table.lookup.get(spec.id);
      expect(key).toBeDefined();
      if (key) expect(encodeQuickKey(key, NO_MODIFIERS)).not.toBeNull();
    }
  });

  it('labels every key for a screen reader', () => {
    for (const spec of specs)
      expect((spec.accessibilityLabel ?? spec.label).length).toBeGreaterThan(0);
  });
});

describe('full keyboard', () => {
  it('carries the sticky modifiers and a space bar', () => {
    const ids = FULL_KEYBOARD.rows.flat().map((spec) => spec.id);
    expect(ids).toEqual(
      expect.arrayContaining(['mod-control', 'mod-option', 'mod-shift', 'char-space']),
    );
  });

  it('fits a phone: at most 11 cells a row, no Esc, Tab or function keys', () => {
    for (const row of FULL_KEYBOARD.rows) expect(row.length).toBeLessThanOrEqual(11);
    const ids = FULL_KEYBOARD.rows.flat().map((spec) => spec.id);
    expect(ids).not.toContain('escape');
    expect(ids).not.toContain('tab');
  });

  it('lets the space bar take the widest share of its row', () => {
    const row = FULL_KEYBOARD.rows.find((cells) => cells.some((spec) => spec.id === 'char-space'));
    const weights = (row ?? []).map((spec) => spec.weight ?? 1);
    expect(Math.max(...weights)).toBe(row?.find((spec) => spec.id === 'char-space')?.weight);
  });
});

describe('control keys', () => {
  it('keep Esc and Tab', () => {
    const ids = CONTROL_KEYS.rows.flat().map((spec) => spec.id);
    expect(ids).toEqual(expect.arrayContaining(['escape', 'tab']));
  });
});
