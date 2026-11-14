#!/usr/bin/env node
// The class of defect "one branch drew its own copy of a shared piece", caught on the TypeScript AST:
// (a) a hand-made group of Buttons outside ButtonRow / Answers / ChipRow / KeyPad,
// (b) an app component named like a component `packages/ui` exports,
// (d) a hand-made disclosure chevron.
// Rule (c), every ui component has a caller, lives in check-reuse.mjs.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  handMadeButtonGroups,
  handMadeDisclosureChevrons,
  shadowedUiComponents,
  uiComponentNames,
} from './lib/ui-duplicates.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Button groups that are neither a choice nor a row of one kind of action. Key: `path` (every
 * finding in the file), value: the reason. Keep it short.
 */
const BUTTON_GROUP_EXCEPTIONS = new Map([
  [
    'apps/mobile/src/features/hosts/HostListScreen.tsx',
    'EmptyState actions slot: a primary action and a quiet text link, stacked, not a choice',
  ],
  [
    'apps/mobile/src/home/HomeChrome.tsx',
    'EmptyState actions slot: a primary action, the demo and a text link, stacked, not a choice',
  ],
  [
    'apps/mobile/src/notifications/NotificationDisclosure.tsx',
    'sheet footer: Continue and Not Now stacked under the privacy link, a consent gate not a choice',
  ],
  [
    'apps/mobile/src/ports/PreviewToolbar.tsx',
    'a toolbar of four unrelated icon actions (Back, Forward, Reload, Share), not a choice',
  ],
  [
    'apps/mobile/src/terminal/TerminalStatus.tsx',
    'EmptyState actions slot: the status owner passes its own recovery actions with their kinds',
  ],
  [
    'apps/mobile/src/usage/AccountSuggestions.tsx',
    'ListRow trailing slot: small Add and Ignore of one suggestion, two different kinds, not a choice',
  ],
]);
/** App components that share a name with a ui export on purpose. Key: `path:Name`, value: the reason. */
const SHADOWING_EXCEPTIONS = new Map([]);

const SKIP = /\.test\.|testkit|\/dev\//;

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* walk(path);
    else if (path.endsWith('.tsx')) yield path;
  }
}

const read = (top) =>
  [...walk(join(ROOT, top))]
    .map((file) => ({ path: relative(ROOT, file), text: readFileSync(file, 'utf8') }))
    .filter(({ path }) => !SKIP.test(path));

const app = read('apps/mobile/src');
const ui = read('packages/ui/src').filter(({ path }) => !path.includes('/gallery/'));
const uiNames = uiComponentNames(readFileSync(join(ROOT, 'packages/ui/src/index.ts'), 'utf8'));

const found = [];
for (const file of app) {
  found.push(
    ...handMadeButtonGroups(file).filter(({ path }) => !BUTTON_GROUP_EXCEPTIONS.has(path)),
    ...shadowedUiComponents(file, uiNames).filter(
      ({ path, name }) => !SHADOWING_EXCEPTIONS.has(`${path}:${name}`),
    ),
  );
}
for (const file of [...app, ...ui]) found.push(...handMadeDisclosureChevrons(file));

if (found.length > 0) {
  console.error(found.map(({ path, line, message }) => `${path}:${line}: ${message}`).join('\n'));
  process.exit(1);
}
