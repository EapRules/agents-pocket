#!/usr/bin/env node
// Reuse rules the linter cannot see:
// 1. A card starts from `Card`: only the base pieces below draw the card radius themselves.
// 2. Every ui component has a caller: an app screen or another ui component (the gallery, the
//    atlas and barrels do not count).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RADIUS = /radius\.card\b/;

/** The bases: they define the shapes everything else reuses. */
const BASES = new Set([
  'packages/ui/src/primitives/Card.tsx',
  'packages/ui/src/primitives/Banner.tsx',
  'packages/ui/src/overlay/ToastHost.tsx',
]);

/** Not cards: a shape drawn with the card radius for its own reason. */
const NOT_CARDS = new Map([
  ['packages/ui/src/components/BackgroundWorkStrip.tsx', 'a floating status line'],
  ['packages/ui/src/components/ChatUserBubble.tsx', 'message bubble'],
  ['packages/ui/src/components/SessionsStrip.tsx', 'terminal thumbnail in its own palette'],
  ['packages/ui/src/components/TerminalThemePreview.tsx', 'a preview in a terminal palette'],
  ['packages/ui/src/components/ThemeChoiceCard.tsx', "a preview in another theme's colors"],
  ['packages/ui/src/composer/Composer.tsx', 'a text field that grows'],
  ['packages/ui/src/scanner/QRCamera.tsx', 'camera frame'],
]);

const SKIP = /\.test\.|testkit|\/gallery\/|\/dev\/atlas\//;

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* walk(path);
    else if (/\.tsx?$/.test(path)) yield path;
  }
}

const sources = new Map();
for (const top of ['apps/mobile/src', 'packages/ui/src']) {
  for (const file of walk(join(ROOT, top))) {
    const path = relative(ROOT, file);
    if (!SKIP.test(path)) sources.set(path, readFileSync(file, 'utf8'));
  }
}

const failures = [];
for (const [path, text] of sources) {
  const draws = RADIUS.test(text);
  if (draws && !BASES.has(path) && !NOT_CARDS.has(path)) {
    failures.push(`${path}: draws the card radius by hand; start from Card`);
  }
}

const COMPONENT_DIRS = [
  'packages/ui/src/components/',
  'packages/ui/src/primitives/',
  'packages/ui/src/overlay/',
  'packages/ui/src/terminal/',
  'packages/ui/src/keys/',
  'packages/ui/src/composer/',
  'packages/ui/src/markdown/',
  'packages/ui/src/form/',
  'packages/ui/src/diff/',
  'packages/ui/src/scanner/',
];
const isBarrel = (path) => /\/index\.tsx?$/.test(path) || /\/[a-z][A-Za-z]*\.ts$/.test(path);
/** Components with no caller yet, kept on purpose; each needs its reason. */
const NO_CALLER_YET = new Map([
  [
    'packages/ui/src/diff/DiffView.tsx',
    'built and exported for the review feature; no screen shows a diff yet (lead decides)',
  ],
]);
/** The components a file exports (a file may hold several), or its own name when it has none. */
const exportedNames = (path, text) => {
  const names = [...text.matchAll(/^export (?:function|const) ([A-Z]\w*)/gm)].map((m) => m[1]);
  return names.length > 0 ? names : [basename(path, '.tsx')];
};
for (const [path, own] of sources) {
  if (!path.endsWith('.tsx') || !COMPONENT_DIRS.some((dir) => path.startsWith(dir))) continue;
  if (NO_CALLER_YET.has(path)) continue;
  const names = exportedNames(path, own);
  const word = new RegExp(`\\b(${names.join('|')})\\b`);
  const used = [...sources].some(
    ([other, text]) =>
      other !== path && word.test(text) && (other.startsWith('apps/') || !isBarrel(other)),
  );
  if (!used) failures.push(`${path}: no screen or component uses ${names.join(', ')}; delete it`);
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}
