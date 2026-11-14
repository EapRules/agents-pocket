// Every sentence core keys with `message(...)` reaches the screen translated and with the app's
// name: the key resolves in both languages, and no value says the Swift app's old name.

import { describe, expect, it } from 'vitest';
import { PAIRING_MESSAGE_CATALOG_KEYS } from '../pairing/failure';
import { appTable, sourceMessageKeys } from './catalog.testkit';

// The Swift app's old name, and the project name: the app says "Agents Pocket".
const OLD_BRAND = /\bAgentico\b|OpenAgentsPocket/;

describe("core's catalog keys", () => {
  // Pairing passes ids that its own table maps to catalog keys.
  const pairing: Record<string, string> = PAIRING_MESSAGE_CATALOG_KEYS;
  const keys = sourceMessageKeys().map((key) => pairing[key] ?? key);
  const tables = { en: appTable('en'), es: appTable('es') };

  it('finds the keys', () => {
    expect(keys.length).toBeGreaterThan(300);
  });

  it.each(['en', 'es'] as const)('resolve in %s', (locale) => {
    expect(keys.filter((key) => tables[locale][key] === undefined)).toEqual([]);
  });

  it.each(['en', 'es'] as const)('never render the old brand in %s', (locale) => {
    const branded = keys.filter((key) => OLD_BRAND.test(tables[locale][key] ?? ''));
    expect(branded).toEqual([]);
  });
});
