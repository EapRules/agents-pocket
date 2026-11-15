import assert from 'node:assert/strict';
import { test } from 'node:test';

import { otaVerdict, verdictMarkdown } from './ota-verdict.mjs';

const A = 'a'.repeat(40);
const B = 'b'.repeat(40);
const build = (over = {}) => ({
  platform: 'ios',
  version: '1.0.1',
  build: '4',
  runtimeVersion: 'r'.repeat(40),
  sourceFingerprint: A,
  commit: 'c'.repeat(40),
  archivedAt: '2026-11-14T12:00:00.000Z',
  ...over,
});

test('can ship, naming the newest released build that runs the native inputs', () => {
  const builds = [
    build({ build: '4' }),
    build({ build: '5' }),
    build({ build: '6', sourceFingerprint: B }),
  ];
  const verdict = otaVerdict({ platform: 'ios', sourceFingerprint: A, builds });
  assert.equal(verdict.canShip, true);
  assert.equal(verdict.title, 'Can ship over the air');
  assert.equal(verdict.newest?.build, '5');
  assert.match(verdict.detail, /1\.0\.1 \(5\)/);
});

test('needs a store build when no released build has these native inputs', () => {
  const verdict = otaVerdict({ platform: 'ios', sourceFingerprint: B, builds: [build()] });
  assert.equal(verdict.canShip, false);
  assert.equal(verdict.title, 'Needs a store build');
  assert.match(verdict.detail, new RegExp(B));
  assert.match(verdict.detail, new RegExp(A));
});

test('a build recorded without a source fingerprint cannot be matched', () => {
  const verdict = otaVerdict({
    platform: 'ios',
    sourceFingerprint: A,
    builds: [build({ sourceFingerprint: undefined })],
  });
  assert.equal(verdict.canShip, false);
  assert.match(verdict.detail, /none/);
});

test('a build of another platform does not count', () => {
  const verdict = otaVerdict({
    platform: 'ios',
    sourceFingerprint: A,
    builds: [build({ platform: 'android' })],
  });
  assert.equal(verdict.canShip, false);
});

test('markdown carries the title', () => {
  const verdict = otaVerdict({ platform: 'ios', sourceFingerprint: A, builds: [build()] });
  assert.match(verdictMarkdown('ios', verdict), /\*\*Can ship over the air\*\*/);
});
