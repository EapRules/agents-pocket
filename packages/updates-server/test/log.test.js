// The public log's reading rules (publish/log.js). Until 2026-11-14 there were two channels; the
// log keeps its lines from then, and a `beta` line is not an update of the one channel.

import assert from 'node:assert/strict';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { after, test } from 'node:test';

import {
  appendLog,
  isRetiredChannelEntry,
  logCommitCommands,
  previousEntries,
  readLog,
  servedNow,
} from '../publish/log.js';
import { tempDir } from './support.js';

// The one line docs/releases/updates.jsonl held when the beta channel was retired, verbatim.
const RETIRED_LINE =
  '{"kind":"manifest","id":"80207f58-9230-4087-b285-e0f7f6a5ed82","platform":"ios","runtimeVersion":"84ef6352d68c95d22f0ed62dd5d844957187620c","createdAt":"2026-11-14T16:51:57.987Z","commit":"0c6914b0c7fc5ca0eab6367acec95e5019e62aca","bodySha256":"4c32bd8401a5bcb5151062f96fb4af348965b673207ece7c9f28519076d298e5","signature":"sig=\\"p7mb4gBTeOItAv1P39/u63rU/bSIP18XKVSF6oug5aMEJ6vbk1z1kyUWsmKFtYMeHROrykCKH/IeeDHkpkHFOO5uKVF93eEaeyzppc52ixvWzepu443qafwza/1o7jCuDKKFYN4KpW3pfvYzR8PC+Cb8/Qugy2KlsHuzos6otGfPW+gYgkCVayJ9wmMgPiVll8hlO9rRjGxK2+0QSafrtt3/CqwD2d01hs0ZI/w7g2+is8mho+DooVmFyhJr+eqHJ8MDuXQDQgawUw2EyxkuE/XVZVL/c8ElMkmMNXr1LOv6EcCm8XWJuW+eeU/o7qWhCLn+QGZefyBtUkyZezOmqg==\\", keyid=\\"main\\", alg=\\"rsa-v1_5-sha256\\"","channel":"beta","uploadedAt":"2026-11-14T16:52:11.961Z"}';
const SCOPE = { platform: 'ios', runtimeVersion: '84ef6352d68c95d22f0ed62dd5d844957187620c' };

const dir = tempDir();
after(() => rmSync(dir, { recursive: true, force: true }));

let n = 0;
function logWith(...lines) {
  n += 1;
  const file = join(dir, `updates-${n}.jsonl`);
  writeFileSync(file, lines.map((l) => `${l}\n`).join(''));
  return file;
}

test('the repository log still starts with that line, unchanged', () => {
  const real = join(import.meta.dirname, '..', '..', '..', 'docs', 'releases', 'updates.jsonl');
  assert.equal(readFileSync(real, 'utf8').split('\n')[0], RETIRED_LINE);
});

test('the retired beta line is not a previous update and not what is served', () => {
  const entries = readLog(logWith(RETIRED_LINE));
  assert.equal(isRetiredChannelEntry(entries[0]), true);
  assert.deepEqual(previousEntries(entries, SCOPE), []);
  assert.equal(servedNow(entries, SCOPE), null);
});

test('a line without channel, or with production, counts', () => {
  const retired = JSON.parse(RETIRED_LINE);
  const { channel: _, ...unlabelled } = { ...retired, id: '00000000-0000-4000-8000-000000000001' };
  const production = { ...retired, id: '00000000-0000-4000-8000-000000000002' };
  production.channel = 'production';
  for (const entry of [unlabelled, production]) {
    assert.equal(isRetiredChannelEntry(entry), false);
    assert.equal(servedNow([retired, entry], SCOPE), entry);
  }
  assert.deepEqual(previousEntries([retired, unlabelled, production], SCOPE), [
    unlabelled,
    production,
  ]);
});

test('appending never touches existing lines, and a new entry carries no channel', () => {
  const file = logWith(RETIRED_LINE);
  const { channel: _, ...next } = { ...JSON.parse(RETIRED_LINE), id: 'x' };
  assert.throws(() => appendLog(file, { ...next, channel: 'beta' }), /carries no channel/);
  assert.throws(() => appendLog(file, { ...next, uploadedAt: undefined }), /needs uploadedAt/);
  appendLog(file, next);
  const lines = readFileSync(file, 'utf8').split('\n');
  assert.equal(lines[0], RETIRED_LINE);
  assert.deepEqual(JSON.parse(lines[1]), next);
});

test('the commit message names no channel', () => {
  const [, commit] = logCommitCommands({ kind: 'manifest', id: 'abc' });
  assert.match(commit, /Updates: manifest abc published/);
});
