import { describe, expect, it } from 'vitest';
import { appTable, sourceMessageKeys } from '../errors/catalog.testkit';

describe('the words the Blocked parsers and planners use', () => {
  const keys = sourceMessageKeys('blocked');
  const english = appTable('en');
  const spanish = appTable('es');

  it('finds the keys', () => {
    expect(keys.length).toBeGreaterThan(30);
  });

  it.each(keys.map((key) => [key] as const))('has a catalog entry in both languages: %s', (key) => {
    expect(english[key]).toBeDefined();
    expect(spanish[key]).toBeDefined();
  });
});
