import { describe, expect, it } from 'vitest';
import { catalogs } from './catalogs.generated';
import { appExtras, keysOf, setLocale, t } from './index';

// The project name is not what a user reads: the app says "Agents Pocket". A value may name the
// project only where it is not the product's name in a sentence (a URL, a command to type).
const PROJECT_NAME = /OpenAgentsPocket/i;
const PROJECT_NAME_ALLOWED: RegExp[] = [/openagentspocket\.com/i];

const sayProjectName = (value: string) =>
  PROJECT_NAME.test(PROJECT_NAME_ALLOWED.reduce((text, ok) => text.replace(ok, ''), value));

describe('app extras', () => {
  it('ship every key in English and Spanish', () => {
    expect(Object.keys(appExtras.es).sort()).toEqual(Object.keys(appExtras.en).sort());
  });

  it('never shadow a Swift key (the Swift catalog would win and the extra would be dead)', () => {
    const swift = new Set(Object.keys(catalogs.en.app));
    expect(Object.keys(appExtras.en).filter((key) => swift.has(key))).toEqual([]);
  });

  it("never say the Swift app's old name (the catalogs rewrite it; the extras are written by hand)", () => {
    for (const table of [appExtras.en, appExtras.es]) {
      expect(Object.values(table).filter((value) => /\bAgentico\b/.test(value))).toEqual([]);
    }
  });

  it('say "Agents Pocket", never the project name, where they name the product', () => {
    for (const table of [appExtras.en, appExtras.es]) {
      expect(Object.values(table).filter(sayProjectName)).toEqual([]);
    }
  });

  it('keep the project name out of every catalog value too', () => {
    const values = Object.values(catalogs).flatMap((locale) =>
      Object.values(locale).flatMap((table) => Object.values(table as Record<string, string>)),
    );
    expect(values.length).toBeGreaterThan(1000);
    expect(values.filter(sayProjectName)).toEqual([]);
  });

  it('resolve through t() as part of the app table', () => {
    const [key] = Object.keys(appExtras.en);
    expect(keysOf('app')).toContain(key);
    setLocale('es');
    expect(t('Switch Agent')).toBe(appExtras.es['Switch Agent']);
    setLocale('en');
  });
});
