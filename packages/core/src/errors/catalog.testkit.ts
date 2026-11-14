// The app's string tables as tests read them, and the catalog keys core passes to `message(...)`.
// Core has no i18n runtime, so these read the JSON the i18n package ships.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const I18N = fileURLToPath(new URL('../../../i18n/src/', import.meta.url));
const SOURCES = fileURLToPath(new URL('../', import.meta.url));

export type Locale = 'en' | 'es';
type Table = Record<string, string>;

const read = (path: string): Table => JSON.parse(readFileSync(join(I18N, path), 'utf8'));

/** The Swift String Catalog's `app` table, converted. */
export const swiftCatalog = (locale: Locale): Table => read(`catalogs/${locale}/app.json`);

/** The strings only the React Native app has. */
export const appExtras = (locale: Locale): Table => read(`extras/${locale}.json`);

/** What `t()` reads: the extras, with the Swift catalog winning on a shared key. */
export const appTable = (locale: Locale): Table => ({
  ...appExtras(locale),
  ...swiftCatalog(locale),
});

/** Every catalog key a source file passes to `message(...)` as a literal, unescaped. */
export function messageKeys(source: string): string[] {
  const keys: string[] = [];
  for (const match of source.matchAll(/message\(\s*('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")/g)) {
    const literal = match[1] ?? '';
    const inner = literal.slice(1, -1).replaceAll("\\'", "'").replaceAll('"', '\\"');
    keys.push(JSON.parse(`"${inner}"`));
  }
  return keys;
}

/** The `message(...)` keys of every source file (tests and testkits left out) under `dir` in core's src. */
export function sourceMessageKeys(dir = ''): string[] {
  const root = join(SOURCES, dir);
  const files = readdirSync(root, { recursive: true, encoding: 'utf8' }).filter(
    (file) => file.endsWith('.ts') && !file.includes('.test.') && !file.includes('.testkit.'),
  );
  const keys = files.flatMap((file) => messageKeys(readFileSync(join(root, file), 'utf8')));
  return [...new Set(keys)];
}
