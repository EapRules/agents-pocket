#!/usr/bin/env node
// What a person reads says "Agents Pocket": never "Agentico" (the Swift app this was ported from) nor
// "OpenAgentsPocket" (the project name). The rule is a whole word, case-sensitive, so identifiers stay
// out of scope by their shape: the plugin id `agentico`, the `@openagentspocket/*` scope, domains, URL
// schemes and bundle ids are lower case, `AGENTICO_*` markers are upper case, and compound names
// (`AgenticoNotify`, `updateAgentico`, `AgenticoTests`) are not the word on its own.
//
// It scans:
// - string tables: every catalog value (packages/i18n/src/catalogs, regenerated from Swift with the
//   name rewritten) and every extras value, both languages. Keys may keep the Swift wording;
// - the plugin manifest's human-readable fields (name, title, description);
// - prose files a person reads whole: the site pages, the privacy policy, the plugin's installers,
//   program hooks and README, the Host's service unit text;
// - the code that builds user text (app, core, ui, session bridge, relay, update server, plugin):
//   a string literal or JSX text saying the old name fails. In app, core and ui a catalog key is
//   exempt, since `t()` and `message()` resolve it to a rewritten value; the others have no catalog.
//   Comments, tests, testkits and fixtures are skipped: no person reads them, and fixtures pin what
//   other programs send. A key rendered without a translator would still show the old name; core's
//   message-keys test and the review of `renderText` callers cover that, not this check.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const OLD_BRAND = /\bAgentico\b|\bOpenAgentsPocket\b/;

const TABLES = ['packages/i18n/src/catalogs', 'packages/i18n/src/extras'];
const MANIFEST = 'packages/plugin/herdr-plugin.toml';
const MANIFEST_FIELDS = /^\s*(name|title|description)\s*=\s*"((?:[^"\\]|\\.)*)"/;
/** Read whole: every line is text a person may read. */
const PROSE = [
  'apps/site/src',
  'packages/relay/src/privacy.js',
  'packages/plugin/install',
  'packages/plugin/src/program-hooks',
  'packages/plugin/README.md',
];
/** Code read through the catalogs: literals and JSX text, catalog keys exempt. */
const CATALOG_CODE = ['apps/mobile/src', 'packages/core/src', 'packages/ui/src'];
/** Code that has no catalog: every literal is shown as written. */
const PLAIN_CODE = [
  'packages/session-bridge/src',
  'packages/relay/src',
  'packages/updates-server/src',
  'packages/plugin/src',
];
const SKIP_DIRS = new Set(['node_modules', 'fixtures', 'goldens', 'ios', 'android', 'dist']);
const NOT_SHOWN = /\.(test|testkit|test-util|test-utils)\.|\.d\.ts$/;
const CODE_FILE = /\.(tsx?|m?js)$/;
const TEXT_FILE = /\.(html|css|m?js|ts|md|sh|ps1|py|ya?ml|json|txt)$/;
const LITERAL = /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g;

function* walk(path) {
  if (!statSync(path).isDirectory()) {
    yield path;
    return;
  }
  for (const name of readdirSync(path)) {
    if (!SKIP_DIRS.has(name)) yield* walk(join(path, name));
  }
}

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
/** Escapes as a person sees them, so `\nAgentico` reads as a word. */
const asShown = (text) => text.replace(/\\[nt]/g, ' ').replace(/\\(['"`\\])/g, '$1');

/** Values of a string table that say the old name. */
export function tableOffenders(table) {
  return Object.entries(table)
    .filter(([, value]) => typeof value === 'string' && OLD_BRAND.test(value))
    .map(([key]) => key);
}

/** Line numbers (1-based) of code that shows the old name, a catalog key being exempt. */
export function codeOffenders(source, keys) {
  const found = [];
  source.split('\n').forEach((line, index) => {
    if (!OLD_BRAND.test(asShown(line))) return;
    const trimmed = line.trim();
    if (/^(\/\/|\/\*|\*)/.test(trimmed)) return;
    const shown = line
      .replace(LITERAL, (literal) => {
        const text = asShown(literal.slice(1, -1));
        return keys.has(text) ? '""' : ` ${text} `;
      })
      .replace(/\s\/\/.*$/, '');
    if (OLD_BRAND.test(asShown(shown))) found.push(index + 1);
  });
  return found;
}

/** Line numbers of prose that says the old name. */
export function proseOffenders(text) {
  return text
    .split('\n')
    .flatMap((line, index) => (OLD_BRAND.test(asShown(line)) ? [index + 1] : []));
}

/** Manifest fields a person reads that say the old name. */
export function manifestOffenders(toml) {
  return toml.split('\n').flatMap((line, index) => {
    const field = line.match(MANIFEST_FIELDS);
    return field && OLD_BRAND.test(field[2]) ? [index + 1] : [];
  });
}

/** Every user-facing place under `root` that says the old name, as `path[:line or key]`. */
export function offenders(root = ROOT) {
  const at = (path) => relative(root, path);
  const found = [];
  const keys = new Set();
  for (const top of TABLES) {
    for (const file of walk(join(root, top))) {
      if (!file.endsWith('.json')) continue;
      const table = readJson(file);
      for (const key of tableOffenders(table))
        found.push(`${at(file)}: value of ${JSON.stringify(key)}`);
      if (/\/(catalogs\/en\/[^/]+|extras\/en)\.json$/.test(file))
        for (const key of Object.keys(table)) keys.add(key);
    }
  }
  const manifest = join(root, MANIFEST);
  for (const line of manifestOffenders(readFileSync(manifest, 'utf8')))
    found.push(`${at(manifest)}:${line}`);
  for (const top of PROSE) {
    for (const file of walk(join(root, top))) {
      if (!TEXT_FILE.test(file) || NOT_SHOWN.test(file)) continue;
      for (const line of proseOffenders(readFileSync(file, 'utf8')))
        found.push(`${at(file)}:${line}`);
    }
  }
  const none = new Set();
  for (const [tops, exempt] of [
    [CATALOG_CODE, keys],
    [PLAIN_CODE, none],
  ]) {
    for (const top of tops) {
      for (const file of walk(join(root, top))) {
        if (!CODE_FILE.test(file) || NOT_SHOWN.test(file)) continue;
        const source = readFileSync(file, 'utf8');
        for (const line of codeOffenders(source, exempt)) found.push(`${at(file)}:${line}`);
      }
    }
  }
  return [...new Set(found)];
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const failures = offenders();
  if (failures.length > 0) {
    console.error(
      `Say "Agents Pocket" where a person reads the product name (not "Agentico" or "OpenAgentsPocket"); in code, pass a catalog key through t() or message():\n${failures.join('\n')}`,
    );
    process.exit(1);
  }
}
