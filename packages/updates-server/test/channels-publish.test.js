// The publish side of the internal channel, the production rollout and revert: what each command
// writes in the bucket and the public log, what it refuses, and that every dry run writes nothing.
// In-memory bucket served by the real Worker; throwaway keys made at test time.

import assert from 'node:assert/strict';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { after, before, beforeEach, suite, test } from 'node:test';

import { readBundle } from '../publish/bundle.js';
import { createUpdateBundle } from '../publish/create.js';
import { readLog } from '../publish/log.js';
import { readExport } from '../publish/manifest.js';
import {
  parsePercent,
  productionPointer,
  runRollout,
  syntheticClientId,
} from '../publish/pointers.js';
import { runUpload } from '../publish/publish-upload.js';
import { runRevert } from '../publish/revert.js';
import { loadCertificate, loadPrivateKey } from '../publish/signing.js';
import { memoryStore } from '../publish/stores.js';
import { verifyRemote } from '../publish/verify.js';
import { createMemoryBucket } from '../src/memory-bucket.js';
import { parseMultipart, partName, storageKeys } from '../src/protocol.js';
import { createUpdatesServer } from '../src/worker.js';
import { BUILDS, makeExport, makeKeyPair, RUNTIME, tempDir } from './support.js';

const BASE = 'https://updates.example.com';
const PROD = storageKeys.pointer('ios', RUNTIME);
const INTERNAL = storageKeys.pointer('ios', RUNTIME, 'internal');
let dir;
let certificate;
let privateKey;
let exported;
let n = 0;
let bucket;
let logFile;
let lines;

before(() => {
  dir = tempDir();
  mkdirSync(join(dir, 'repo'));
  const keys = makeKeyPair(dir);
  certificate = loadCertificate(keys.cert).certificate;
  privateKey = loadPrivateKey(keys.key, { repoRoot: join(dir, 'repo') });
  exported = readExport(makeExport(dir), 'ios');
});
after(() => rmSync(dir, { recursive: true, force: true }));
beforeEach(() => {
  n += 1;
  bucket = createMemoryBucket();
  logFile = join(dir, `updates-${n}.jsonl`);
  lines = [];
});

const log = () => readLog(logFile);
const pointer = async (key = PROD) => {
  const object = await bucket.get(key);
  return object && JSON.parse(await object.text());
};
const worker = createUpdatesServer();
const fetchImpl = (url, init) => worker.fetch(new Request(url, init), { UPDATES: bucket });

let minute = 0;
async function makeUpdate() {
  minute += 1;
  const outDir = join(dir, `update-${n}-${minute}`);
  await createUpdateBundle({
    outDir,
    exported,
    platform: 'ios',
    runtimeVersion: RUNTIME,
    builds: BUILDS,
    log: log(),
    baseUrl: BASE,
    expoClient: { name: 'Agents Pocket' },
    commit: String(minute % 10).repeat(40),
    privateKey,
    certificate,
    now: new Date(Date.UTC(2026, 10, 15, 10, minute)),
  });
  return outDir;
}

const common = () => ({
  target: 'r2',
  makeStore: () => memoryStore(bucket),
  log: log(),
  logFile,
  certificate,
  builds: BUILDS,
  baseUrl: BASE,
  fetchImpl,
  print: (line) => lines.push(line),
});
const upload = async (bundleDir, over = {}) => runUpload({ ...common(), dir: bundleDir, ...over });
const idOf = (bundleDir) => readBundle(bundleDir).entry.id;
const rollout = (percent, over = {}) =>
  runRollout({
    percent,
    store: memoryStore(bucket),
    platform: 'ios',
    runtimeVersion: RUNTIME,
    logged: log().at(-1) ?? null,
    print: (line) => lines.push(line),
    ...over,
  });
const revert = (over = {}) =>
  runRevert({
    ...common(),
    store: memoryStore(bucket),
    platform: 'ios',
    runtimeVersion: RUNTIME,
    privateKey,
    commit: 'f'.repeat(40),
    outRoot: join(dir, `reverts-${n}`),
    now: () => new Date(Date.UTC(2026, 10, 15, 12, minute)),
    ...over,
  });

/** What a device gets: `manifest <id>`, `directive <id>` (by the stored body) or the status. */
async function served(headers = {}) {
  const res = await fetchImpl(`${BASE}/manifest`, {
    headers: {
      'expo-protocol-version': '1',
      'expo-platform': 'ios',
      'expo-runtime-version': RUNTIME,
      ...headers,
    },
  });
  if (res.status !== 200) return res.status;
  const boundary = /boundary=([^;]+)/.exec(res.headers.get('content-type'))[1];
  const [part] = parseMultipart(new Uint8Array(await res.arrayBuffer()), boundary);
  const body = JSON.parse(new TextDecoder().decode(part.body));
  return { kind: partName(part.headers), body };
}

/** Bucket writes during `run`. */
async function writesDuring(run) {
  const keys = [...bucket.objects.keys()];
  const values = keys.map((k) => bucket.objects.get(k).bytes.join());
  await run();
  const now = [...bucket.objects.keys()];
  return now.filter(
    (k, i) => !keys.includes(k) || bucket.objects.get(k).bytes.join() !== values[i],
  );
}

suite('internal channel', () => {
  test('writes only the internal pointer, is never logged, and is what TestFlight installs get', async () => {
    const first = await makeUpdate();
    await upload(first);
    const internal = await makeUpdate();
    await upload(internal, { channel: 'internal' });
    assert.deepEqual(await pointer(INTERNAL), { kind: 'manifest', id: idOf(internal) });
    assert.equal((await pointer()).id, idOf(first), 'production untouched');
    assert.deepEqual(
      log().map((e) => e.id),
      [idOf(first)],
    );
    assert.ok(lines.some((l) => /Internal uploads are not logged/.test(l)));
    const asked = await served({ 'expo-extra-params': 'channel="internal"' });
    assert.equal(asked.body.id, idOf(internal));
    assert.equal((await served()).body.id, idOf(first));
  });

  test('has no rollout; an unknown channel is refused', async () => {
    const bundleDir = await makeUpdate();
    await assert.rejects(
      upload(bundleDir, { channel: 'internal', rollout: 50 }),
      /production only/,
    );
    await assert.rejects(upload(bundleDir, { channel: 'beta' }), /internal or production/);
    assert.equal(bucket.objects.size, 0);
  });

  test('a dry run names the internal pointer and writes nothing', async () => {
    const bundleDir = await makeUpdate();
    let made = 0;
    await upload(bundleDir, { channel: 'internal', dryRun: true, makeStore: () => made++ });
    assert.equal(made, 0);
    assert.match(
      lines.join('\n'),
      new RegExp(`${INTERNAL}: \\(not read in a dry run\\) -> manifest`),
    );
  });
});

suite('production rollout', () => {
  test('every production upload records the pointer it replaces, in the pointer and the log', async () => {
    const a = await makeUpdate();
    await upload(a);
    assert.deepEqual(await pointer(), {
      kind: 'manifest',
      id: idOf(a),
      rollout: { percent: 100, previous: null },
    });
    const b = await makeUpdate();
    await upload(b, { rollout: 30 });
    const previous = { kind: 'manifest', id: idOf(a) };
    assert.deepEqual((await pointer()).rollout, { percent: 30, previous });
    assert.deepEqual(log()[1].previous, previous);
    assert.equal(log()[0].previous, null);
  });

  test('the Worker check runs as an install inside the rollout, or outside it at 0%', async () => {
    const a = await makeUpdate();
    await upload(a);
    await upload(await makeUpdate(), { rollout: 30 });
    assert.ok(lines.some((l) => /passes the app's checks/.test(l)));
    await rollout(100);
    await upload(await makeUpdate(), { rollout: 0 });
    assert.equal((await pointer()).rollout.percent, 0);
  });

  test('a new upload is refused while production is below 100%', async () => {
    await upload(await makeUpdate());
    await upload(await makeUpdate(), { rollout: 10 });
    const before = await pointer();
    await assert.rejects(upload(await makeUpdate()), /finish it \(rollout 100\) or revert first/);
    assert.deepEqual(await pointer(), before);
    assert.equal(log().length, 2);
  });

  test('verify --url during a rollout accepts what outside installs get, and nothing older', async () => {
    const a = await makeUpdate();
    await upload(a);
    const b = await makeUpdate();
    await upload(b, { rollout: 30 });
    const check = (clientId, entries = log()) =>
      verifyRemote({
        manifestUrl: `${BASE}/manifest`,
        platform: 'ios',
        runtimeVersion: RUNTIME,
        certificate,
        builds: BUILDS,
        log: entries,
        clientId,
        fetchImpl,
      });
    const outside = await check();
    assert.deepEqual([outside.problems, outside.served.outsideRollout], [[], true]);
    const inside = await check(await syntheticClientId(idOf(b), { inside: true, percent: 30 }));
    assert.deepEqual([inside.problems, inside.served.outsideRollout], [[], false]);
    // Without the newest entry's `previous`, serving the older update is a replay.
    const { previous: _, ...bare } = log()[1];
    assert.match((await check(undefined, [log()[0], bare])).problems.join(), /not newer than/);
  });

  test('rollout <percent> changes only the percent; a dry run writes nothing', async () => {
    const a = await makeUpdate();
    await upload(a);
    await upload(await makeUpdate(), { rollout: 5 });
    const before = await pointer();
    assert.deepEqual(await writesDuring(() => rollout(50, { dryRun: true })), []);
    assert.match(lines.join('\n'), /before .*\(5% rollout.*\n.*after .*\(50% rollout/);
    assert.deepEqual(await writesDuring(() => rollout(50)), [PROD]);
    assert.deepEqual(await pointer(), { ...before, rollout: { ...before.rollout, percent: 50 } });
    await rollout(0);
    const anyone = '5B1F2C3D-0000-4000-8000-000000000000';
    assert.equal((await served({ 'eas-client-id': anyone })).body.id, idOf(a));
  });

  test('rollout refuses nothing published, a pointer from before rollouts, a log mismatch, bad percents', async () => {
    await assert.rejects(rollout(10), /nothing is published/);
    await bucket.put(PROD, JSON.stringify({ kind: 'manifest', id: crypto.randomUUID() }));
    await assert.rejects(rollout(10, { logged: undefined }), /written before rollouts/);
    await bucket.put(
      PROD,
      JSON.stringify({
        kind: 'manifest',
        id: crypto.randomUUID(),
        rollout: { percent: 100, previous: null },
      }),
    );
    await assert.rejects(rollout(10, { logged: null }), /public log says nothing/);
    for (const bad of ['-1', '101', '2.5', 'ten', '', undefined])
      assert.throws(() => parsePercent(bad));
    assert.equal(parsePercent('0'), 0);
  });
});

suite('revert', () => {
  test('re-signs the previous content as a newer update, which a device on the bad one takes', async () => {
    const good = await makeUpdate();
    await upload(good);
    const bad = await makeUpdate();
    await upload(bad, { rollout: 20 });
    const badEntry = readBundle(bad).entry;
    const goodManifest = JSON.parse(new TextDecoder().decode(readBundle(good).bytes));
    await revert();

    const entry = log().at(-1);
    assert.equal(entry.revertOf, badEntry.id);
    assert.equal(entry.previous, null);
    assert.equal(entry.commit, readBundle(good).entry.commit);
    assert.deepEqual(await pointer(), {
      kind: 'manifest',
      id: entry.id,
      rollout: { percent: 100, previous: null },
    });
    // What a device that runs the bad update is offered: newer, the good code.
    const got = await served({ 'expo-current-update-id': badEntry.id });
    assert.equal(got.body.id, entry.id);
    assert.ok(Date.parse(got.body.createdAt) > Date.parse(badEntry.createdAt));
    for (const field of ['launchAsset', 'assets', 'metadata', 'extra', 'runtimeVersion'])
      assert.deepEqual(got.body[field], goodManifest[field], field);
  });

  test('with no previous update it publishes a rollBackToEmbedded directive', async () => {
    const only = await makeUpdate();
    await upload(only);
    await revert();
    const entry = log().at(-1);
    assert.deepEqual([entry.kind, entry.revertOf], ['directive', idOf(only)]);
    const got = await served({ 'expo-current-update-id': idOf(only) });
    assert.equal(got.kind, 'directive');
    assert.equal(got.body.type, 'rollBackToEmbedded');
  });

  test('a dry run needs no key and writes nothing anywhere', async () => {
    await upload(await makeUpdate());
    await upload(await makeUpdate(), { rollout: 50 });
    const out = join(dir, `dry-${n}`);
    const writes = await writesDuring(() =>
      revert({ dryRun: true, privateKey: undefined, outRoot: out }),
    );
    assert.deepEqual([writes, existsSync(out), log().length], [[], false, 2]);
    assert.match(lines.join('\n'), /after +manifest .*re-signed/);
  });

  test('refuses a pointer from before rollouts and a bucket the log disagrees with', async () => {
    await assert.rejects(revert(), /nothing is published/);
    await bucket.put(PROD, JSON.stringify({ kind: 'manifest', id: crypto.randomUUID() }));
    await assert.rejects(revert(), /written before rollouts/);
    await bucket.put(
      PROD,
      JSON.stringify({
        kind: 'manifest',
        id: crypto.randomUUID(),
        rollout: { percent: 100, previous: null },
      }),
    );
    await assert.rejects(revert(), /public log says nothing/);
  });

  test('a revert bundle goes only over the update it reverts, to production, at 100%', async () => {
    const id = crypto.randomUUID();
    const write = productionPointer({ kind: 'manifest', id, revertOf: 'bad' });
    assert.throws(() => write({ kind: 'manifest', id: 'other' }), /made for bad/);
    assert.throws(() => write(null), /made for bad/);
    assert.deepEqual(
      write({ kind: 'manifest', id: 'bad', rollout: { percent: 5, previous: null } }),
      {
        kind: 'manifest',
        id,
        rollout: { percent: 100, previous: null },
      },
    );
    await upload(await makeUpdate());
    await revert();
    const revertDir = join(dir, `reverts-${n}`, log().at(-1).id);
    for (const over of [{ channel: 'internal' }, { rollout: 50 }])
      await assert.rejects(upload(revertDir, over), /a revert goes to production, for everyone/);
  });
});
