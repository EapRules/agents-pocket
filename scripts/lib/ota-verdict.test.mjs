import assert from 'node:assert/strict';
import { test } from 'node:test';

import { otaVerdict, verdictMarkdown } from './ota-verdict.mjs';

const build = (over = {}) => ({
  platform: 'ios',
  version: '1.0.1',
  build: '4',
  runtimeVersion: 'a'.repeat(40),
  commit: 'c'.repeat(40),
  archivedAt: '2026-11-14T12:00:00.000Z',
  ...over,
});

test('can ship, naming the newest released build that runs the runtime', () => {
  const builds = [
    build({ build: '4' }),
    build({ build: '5' }),
    build({ build: '6', runtimeVersion: 'b'.repeat(40) }),
  ];
  const verdict = otaVerdict({ platform: 'ios', runtimeVersion: 'a'.repeat(40), builds });
  assert.equal(verdict.canShip, true);
  assert.equal(verdict.title, 'Can ship over the air');
  assert.equal(verdict.newest?.build, '5');
  assert.match(verdict.detail, /1\.0\.1 \(5\)/);
});

test('needs a store build when no released build runs the runtime', () => {
  const verdict = otaVerdict({
    platform: 'ios',
    runtimeVersion: 'b'.repeat(40),
    builds: [build()],
  });
  assert.equal(verdict.canShip, false);
  assert.equal(verdict.title, 'Needs a store build');
  assert.match(verdict.detail, new RegExp('b'.repeat(40)));
  assert.match(verdict.detail, new RegExp('a'.repeat(40)));
});

test('a store verdict without the team id says it may be a false alarm', () => {
  const input = { platform: 'ios', runtimeVersion: 'b'.repeat(40), builds: [build()] };
  assert.match(otaVerdict({ ...input, teamIdKnown: false }).detail, /false alarm/);
  assert.doesNotMatch(otaVerdict(input).detail, /false alarm/);
});

test('a build of another platform does not count', () => {
  const verdict = otaVerdict({
    platform: 'ios',
    runtimeVersion: 'a'.repeat(40),
    builds: [build({ platform: 'android' })],
  });
  assert.equal(verdict.canShip, false);
  assert.match(verdict.detail, /none/);
});

test('markdown carries the title', () => {
  const verdict = otaVerdict({
    platform: 'ios',
    runtimeVersion: 'a'.repeat(40),
    builds: [build()],
  });
  assert.match(verdictMarkdown('ios', verdict), /\*\*Can ship over the air\*\*/);
});
