// CI step: can this commit's JS ship over the air to a released store build, or does it need a new
// store build? Computes the iOS source fingerprint (scripts/lib/runtime-version.mjs: the runtime
// version without the Apple team id, which a clean checkout does not have), compares it with the
// `sourceFingerprint` of each build in docs/releases/builds.json and prints one verdict, also
// appended to $GITHUB_STEP_SUMMARY.
//   node scripts/ci-ota-verdict.mjs
// Exit 0 for both verdicts; non-zero only when the computation itself fails. Run it on macOS: the
// released fingerprints were computed there.
import { appendFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { otaVerdict, verdictMarkdown } from './lib/ota-verdict.mjs';
import { BUILDS_FILE, readBuilds } from './lib/released-builds.mjs';
import { computeSourceFingerprint } from './lib/runtime-version.mjs';

const PLATFORM = 'ios';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

try {
  const verdict = otaVerdict({
    platform: PLATFORM,
    sourceFingerprint: computeSourceFingerprint({
      mobileDir: join(root, 'apps', 'mobile'),
      platform: PLATFORM,
    }),
    builds: readBuilds(join(root, BUILDS_FILE)),
  });
  console.log(`${verdict.title}\n${verdict.detail}`);
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${verdictMarkdown(PLATFORM, verdict)}\n`);
} catch (error) {
  console.error(`ota verdict failed: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}
