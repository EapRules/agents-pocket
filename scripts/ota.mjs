// One command for the over-the-air flow (ADR 0028, docs/guides/updates.md). A thin runner: the
// plan (scripts/lib/ota-plan.mjs) turns the arguments into steps, each a call of
// scripts/publish-update.mjs, and this file prints them and runs them in order.
//
//   pnpm ota [--skip-tests] [--dry-run]
//       Build, sign and verify a bundle of this commit, upload it to the INTERNAL channel, check it
//       live. Never writes docs/releases/updates.jsonl, never commits.
//   pnpm ota --production [--rollout N] [--yes] [--dry-run]
//       Promote the bundle internal serves now (same update id) to production at N% (default 10),
//       check it live, commit the public log and print the push command. Reaches store users.
//   pnpm ota rollout <percent> | stop | revert [--yes] | status           (stop = rollout 0)
//
// --dry-run runs the local steps and passes --dry-run to every step that writes remotely.
// Defaults: --key ~/.config/openagentspocket/updates-signing/private-key.pem and --base-url
// https://updates.openagentspocket.com. The key path is only handed to publish-update, which reads
// it; this script never opens it and never takes it from the environment.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { readLog, servedNow } from '../packages/updates-server/publish/log.js';
import { loadCertificate } from '../packages/updates-server/publish/signing.js';
import { verifyRemote } from '../packages/updates-server/publish/verify.js';
import {
  bundleFromOutput,
  DEFAULT_BASE_URL,
  fillBundle,
  parseOta,
  planOta,
} from './lib/ota-plan.mjs';
import { BUILDS_FILE, readBuilds } from './lib/released-builds.mjs';
import { computeRuntimeVersion } from './lib/runtime-version.mjs';
import { runStep, shown } from './lib/steps.mjs';

const ROOT = join(import.meta.dirname, '..');
const MOBILE = join(ROOT, 'apps/mobile');
const PLATFORM = 'ios';

function fail(message) {
  console.error(`ota: ${message}`);
  process.exit(1);
}

const argv = process.argv.slice(2);
if (argv.includes('--help')) {
  console.log(helpText());
  process.exit(0);
}

function helpText() {
  return [
    'pnpm ota [--skip-tests] [--dry-run]                    build + upload to internal + check live',
    'pnpm ota --production [--rollout N] [--yes] [--dry-run]  promote internal to production (default 10%)',
    'pnpm ota rollout <percent> | stop | revert [--yes] | status',
    'Flags: --key <pem> --base-url <url> --dry-run --skip-tests --yes',
    `Defaults: base URL ${DEFAULT_BASE_URL}; key under ~/.config/openagentspocket/updates-signing/`,
  ].join('\n');
}

const parsed = parseOta(argv);
const baseUrl = (parsed.flags?.['--base-url'] ?? DEFAULT_BASE_URL).replace(/\/+$/, '');

/** What a channel serves now, asked as the app would. Read-only. */
async function served(channel, runtimeVersion) {
  const certificate = loadCertificate(join(MOBILE, 'certs/updates.pem')).certificate;
  const { problems, served: s } = await verifyRemote({
    manifestUrl: `${baseUrl}/manifest`,
    platform: PLATFORM,
    runtimeVersion,
    certificate,
    keyId: 'main',
    builds: readBuilds(join(ROOT, BUILDS_FILE)),
    log: readLog(join(ROOT, 'docs/releases/updates.jsonl')),
    requireLogged: false,
    channel,
  });
  return { problems, served: s };
}

async function status() {
  const newest = readBuilds(join(ROOT, BUILDS_FILE))
    .filter((b) => b.platform === PLATFORM)
    .at(-1);
  if (!newest) fail(`no released ${PLATFORM} build in ${BUILDS_FILE}`);
  console.log(
    `Newest released runtime ${newest.runtimeVersion} (${newest.version} (${newest.build}))`,
  );
  const logged = servedNow(readLog(join(ROOT, 'docs/releases/updates.jsonl')), {
    platform: PLATFORM,
    runtimeVersion: newest.runtimeVersion,
  });
  for (const channel of ['internal', 'production']) {
    const { problems, served: s } = await served(channel, newest.runtimeVersion);
    const what = s
      ? `${s.kind} ${s.id ?? '(no id)'} sha256 ${s.bodySha256.slice(0, 12)}${s.logged ? ', logged' : ''}${s.outsideRollout ? ', outside rollout' : ''}`
      : 'nothing (204)';
    console.log(
      `  ${channel.padEnd(10)} ${what}${problems.length ? `  [${problems.join('; ')}]` : ''}`,
    );
  }
  console.log(
    `  log says production serves ${logged ? `${logged.id} (${logged.commit.slice(0, 9)})` : 'nothing'}`,
  );
}

async function internalNow() {
  const runtimeVersion = computeRuntimeVersion({ mobileDir: MOBILE, platform: PLATFORM });
  const { served: s } = await served('internal', runtimeVersion);
  if (!s?.id) return null;
  const dir = join('build/updates', s.id);
  return { id: s.id, dir, exists: existsSync(join(ROOT, dir)) };
}

const wantsInternal = parsed.command === 'production' && !parsed.problem;
const plan = planOta(parsed, {
  home: homedir(),
  internal: wantsInternal ? await internalNow().catch((e) => fail(e.message)) : null,
});
if (plan.problem) fail(plan.problem);
if (plan.command === 'status') {
  await status().catch((e) => fail(e.message));
  process.exit(0);
}

// The plan first, then the run.
const dry = Boolean(parsed.flags['--dry-run']);
const asStep = (s) => ({ why: s.label, cmd: s.cmd, args: s.args, cwd: ROOT });
console.log(`Plan${dry ? ' (dry run: remote steps get --dry-run)' : ''}:`);
for (const [i, s] of plan.steps.entries())
  console.log(`  ${i + 1}. ${s.label}\n     ${shown(asStep(s), ROOT)}`);
for (const w of plan.warnings) console.log(`\n${w}`);

let steps = plan.steps;
for (let i = 0; i < steps.length; i++) {
  const step = steps[i];
  if (steps.some((s) => s.args.includes('{bundle}')) && i === 0) {
    // The build step: its summary names the bundle folder the upload step needs.
    console.log(`\n== ${step.label}\n${shown(asStep(step), ROOT)}`);
    const result = spawnSync(step.cmd, step.args, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['inherit', 'pipe', 'inherit'],
    });
    process.stdout.write(result.stdout);
    if (result.status !== 0) fail(`step failed (${step.label}, exit ${result.status})`);
    const dir = bundleFromOutput(result.stdout);
    if (!dir) fail('the build did not say where it wrote the bundle');
    steps = fillBundle(steps, dir);
    continue;
  }
  const problem = runStep(asStep(step), ROOT);
  if (problem) fail(`${step.label}: ${problem}`);
}
for (const line of plan.after) console.log(`\n${line}`);
