import assert from 'node:assert/strict';
import { test } from 'node:test';

import { bundleFromOutput, fillBundle, parseOta, planOta } from './ota-plan.mjs';

const HOME = '/home/me';
const KEY = '/home/me/.config/openagentspocket/updates-signing/private-key.pem';
const URL = 'https://updates.openagentspocket.com';
const ID = '11111111-2222-4333-8444-555555555555';
const ctx = { home: HOME, internal: { id: ID, dir: `build/updates/${ID}`, exists: true } };

const plan = (argv, over = {}) => planOta(parseOta(argv), { ...ctx, ...over });
const lines = (p) => p.steps.map((s) => [s.cmd, ...s.args].join(' '));

test('default: build, upload to internal, verify live; never touches the log or git', () => {
  const p = plan([]);
  assert.equal(p.problem, undefined);
  assert.deepEqual(lines(p), [
    `node scripts/publish-update.mjs --key ${KEY} --base-url ${URL}`,
    `node scripts/publish-update.mjs --upload {bundle} --target r2 --channel internal --base-url ${URL}`,
    `node scripts/publish-update.mjs verify --url ${URL}/manifest --channel internal`,
  ]);
  assert.ok(p.steps.every((s) => s.cmd === 'node'));
  assert.equal(p.needsBundleFromInternal, undefined);
});

test('--skip-tests, --key and --base-url pass through; a trailing slash is dropped', () => {
  const p = plan(['--skip-tests', '--key', '/k.pem', '--base-url', 'https://x.test/']);
  assert.match(lines(p)[0], /--key \/k\.pem --base-url https:\/\/x\.test --skip-tests$/);
  assert.match(lines(p)[2], /--url https:\/\/x\.test\/manifest/);
});

test('--dry-run: the build still runs, remote steps get --dry-run, live verify is dropped', () => {
  const p = plan(['--dry-run']);
  assert.equal(p.steps.length, 2);
  assert.match(lines(p)[0], /^node scripts\/publish-update\.mjs --key/);
  assert.doesNotMatch(lines(p)[0], /dry-run/);
  assert.match(lines(p)[1], /--channel internal .*--dry-run$/);
});

test('production promotes the exact internal bundle at 10% by default, logs it, stops at push', () => {
  const p = plan(['--production', '--yes']);
  assert.equal(p.needsBundleFromInternal, true);
  assert.deepEqual(lines(p), [
    `node scripts/publish-update.mjs --upload build/updates/${ID} --target r2 --channel production --rollout 10 --base-url ${URL}`,
    `node scripts/publish-update.mjs verify --url ${URL}/manifest`,
    'git add docs/releases/updates.jsonl',
    `git commit -m Log update ${ID} at 10% in the public log -- docs/releases/updates.jsonl`,
  ]);
  assert.match(p.warnings[0], /store users/);
  assert.match(p.after.join('\n'), /git push/);
});

test('production --rollout N, and the percent is validated', () => {
  assert.match(lines(plan(['--production', '--yes', '--rollout', '50']))[0], /--rollout 50 /);
  for (const bad of ['101', '-1', 'x', '1.5'])
    assert.match(plan(['--production', '--yes', '--rollout', bad]).problem, /percent|value/);
});

test('production refuses without --yes, unless --dry-run; dry run neither verifies nor commits', () => {
  assert.match(plan(['--production']).problem, /--yes/);
  const p = plan(['--production', '--dry-run']);
  assert.equal(p.problem, undefined);
  assert.equal(p.steps.length, 1);
  assert.match(lines(p)[0], /--dry-run$/);
});

test('production refuses when internal serves nothing or the bundle is missing', () => {
  assert.match(plan(['--production', '--yes'], { internal: null }).problem, /run pnpm ota first/);
  const missing = { internal: { id: ID, dir: `build/updates/${ID}`, exists: false } };
  assert.match(plan(['--production', '--yes'], missing).problem, /run pnpm ota first/);
});

test('rollout, stop, status', () => {
  assert.deepEqual(lines(plan(['rollout', '50'])), [
    'node scripts/publish-update.mjs rollout 50 --target r2',
  ]);
  assert.deepEqual(lines(plan(['stop', '--dry-run'])), [
    'node scripts/publish-update.mjs rollout 0 --target r2 --dry-run',
  ]);
  assert.match(plan(['rollout']).problem, /percent/);
  assert.match(plan(['rollout', '200']).problem, /percent/);
  const s = plan(['status']);
  assert.equal(s.command, 'status');
  assert.deepEqual(s.steps, []);
});

test('revert needs --yes, passes the key, and --dry-run passes through', () => {
  assert.match(plan(['revert']).problem, /--yes/);
  const p = plan(['revert', '--yes']);
  assert.equal(
    lines(p)[0],
    `node scripts/publish-update.mjs revert --target r2 --key ${KEY} --base-url ${URL}`,
  );
  assert.match(p.warnings[0], /store users/);
  assert.match(lines(plan(['revert', '--dry-run']))[0], /--dry-run$/);
});

test('bad input is refused', () => {
  assert.match(plan(['--nope']).problem, /unknown flag/);
  assert.match(plan(['bogus']).problem, /unknown command/);
  assert.match(plan(['--rollout', '5']).problem, /--production/);
  assert.match(plan(['--production', 'revert']).problem, /--production/);
  assert.match(plan(['--key']).problem, /--key/);
});

test('the bundle folder is read from the build output and filled into the steps', () => {
  const out = `ok\n  runtime    abc\n  bundle     build/updates/${ID}\nNothing was uploaded.`;
  assert.equal(bundleFromOutput(out), `build/updates/${ID}`);
  assert.equal(bundleFromOutput('nothing'), null);
  const steps = plan([]).steps;
  assert.equal(fillBundle(steps, 'build/updates/z')[1].args[2], 'build/updates/z');
  assert.equal(steps[1].args[2], '{bundle}');
});
