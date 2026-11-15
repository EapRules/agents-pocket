// CI step: can this commit's JS ship over the air to a released store build, or does it need a new
// store build? Computes the iOS runtime version (scripts/lib/runtime-version.mjs), compares it with
// docs/releases/builds.json and prints one verdict, also appended to $GITHUB_STEP_SUMMARY.
//   node scripts/ci-ota-verdict.mjs
// Exit 0 for both verdicts; non-zero only when the computation itself fails. Run it on macOS: the
// released fingerprints were computed there.
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { otaVerdict, verdictMarkdown } from './lib/ota-verdict.mjs';
import { BUILDS_FILE, readBuilds } from './lib/released-builds.mjs';
import { computeRuntimeVersion } from './lib/runtime-version.mjs';

const PLATFORM = 'ios';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const mobileDir = join(root, 'apps', 'mobile');

// app.config.js reads the Apple team id from APPLE_TEAM_ID or the owner's untracked app.local.json.
function hasLocalTeamId(dir) {
  const file = join(dir, 'app.local.json');
  return existsSync(file) && Boolean(JSON.parse(readFileSync(file, 'utf8')).appleTeamId);
}

try {
  const runtimeVersion = computeRuntimeVersion({ mobileDir, platform: PLATFORM });
  const verdict = otaVerdict({
    platform: PLATFORM,
    runtimeVersion,
    builds: readBuilds(join(root, BUILDS_FILE)),
    teamIdKnown: Boolean(process.env.APPLE_TEAM_ID) || hasLocalTeamId(mobileDir),
  });
  console.log(`${verdict.title}\n${verdict.detail}`);
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${verdictMarkdown(PLATFORM, verdict)}\n`);
} catch (error) {
  console.error(`ota verdict failed: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}
