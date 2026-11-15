#!/usr/bin/env node
// Every link opens through the links module (apps/mobile/src/links, packages/ui/src/links):
// nothing else calls Linking.openURL or openBrowserAsync, so the policy cannot drift again.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TOPS = ['apps/mobile/src', 'packages/ui/src'];
const ALLOWED = ['apps/mobile/src/links/', 'packages/ui/src/links/'];
const RAW = /\bLinking\.openURL\b|\bopenBrowserAsync\b/;
const TEST = /\.test\.tsx?$/;

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* walk(path);
    else if (/\.tsx?$/.test(path)) yield path;
  }
}

/** The files under `tops` that open a link without the links module, as repo-relative paths. */
export function offenders(root = ROOT, tops = TOPS) {
  const found = [];
  for (const top of tops) {
    for (const file of walk(join(root, top))) {
      const path = relative(root, file);
      if (TEST.test(path) || ALLOWED.some((dir) => path.startsWith(dir))) continue;
      if (RAW.test(readFileSync(file, 'utf8'))) found.push(path);
    }
  }
  return found;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const failures = offenders();
  if (failures.length > 0) {
    console.error(
      `Open links through the links module (useOpenLink / openExternally), not Linking.openURL or openBrowserAsync:\n${failures.join('\n')}`,
    );
    process.exit(1);
  }
}
