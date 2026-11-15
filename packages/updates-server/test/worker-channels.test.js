// The internal channel and the production rollout, at the Worker's boundary. A request that does not
// ask for internal, against a pointer with no `rollout`, must get exactly what it got before both
// existed (worker.test.js pins that answer); everything here falls back to it when in doubt.

import assert from 'node:assert/strict';
import { afterEach, beforeEach, suite, test } from 'node:test';

import { createMemoryBucket } from '../src/memory-bucket.js';
import {
  parseMultipart,
  parsePointer,
  partName,
  requestsInternalChannel,
  rolloutBucket,
  storageKeys,
} from '../src/protocol.js';
import { createUpdatesServer } from '../src/worker.js';

const RUNTIME = '33b4fd11e404248c9e547c24307f3114b342e1b3';
const ID_OLD = '0f6c5b0e-1111-4c5e-9d55-2b1f3e0a0001';
const ID_NEW = '0f6c5b0e-2222-4c5e-9d55-2b1f3e0a0002';
const ID_INTERNAL = '0f6c5b0e-3333-4c5e-9d55-2b1f3e0a0003';
const BODIES = {
  [ID_OLD]: '{"id":"old"}',
  [ID_NEW]: '{"id":"new"}',
  [ID_INTERNAL]: '{"id":"int"}',
};
const sig = (id) =>
  `sig="${Buffer.from(id).toString('base64')}", keyid="main", alg="rsa-v1_5-sha256"`;
const INTERNAL = 'channel="internal"';

let bucket;
const server = createUpdatesServer();
const pointerKey = (channel) => storageKeys.pointer('ios', RUNTIME, channel);
const putPointer = (value, channel) =>
  bucket.put(pointerKey(channel), typeof value === 'string' ? value : JSON.stringify(value));
const manifest = (id) => ({ kind: 'manifest', id });

beforeEach(async () => {
  bucket = createMemoryBucket();
  for (const [id, body] of Object.entries(BODIES)) {
    await bucket.put(storageKeys.body(id), body);
    await bucket.put(storageKeys.signature(id), `${sig(id)}\n`);
  }
  await putPointer(manifest(ID_NEW));
});

function headers(overrides = {}) {
  const all = {
    accept: 'multipart/mixed,application/expo+json,application/json',
    'expo-platform': 'ios',
    'expo-protocol-version': '1',
    'expo-runtime-version': RUNTIME,
    ...overrides,
  };
  return Object.fromEntries(Object.entries(all).filter(([, v]) => v !== undefined));
}

/** What the client gets: the status and, for a 200, which update (by its stored body). */
async function served(overrides) {
  const res = await server.fetch(
    new Request('https://updates.example/manifest', { headers: headers(overrides) }),
    { UPDATES: bucket },
  );
  if (res.status !== 200) return res.status;
  const boundary = /boundary=([^;]+)/.exec(res.headers.get('content-type'))[1];
  const [part] = parseMultipart(new Uint8Array(await res.arrayBuffer()), boundary);
  const body = new TextDecoder().decode(part.body);
  const id = Object.keys(BODIES).find((k) => BODIES[k] === body);
  assert.equal(part.headers['expo-signature'], sig(id), 'the signature stored with that body');
  return `${partName(part.headers)} ${id}`;
}

// Client ids whose bucket for ID_NEW is known, found by search (the bucket is stable).
async function clientIdIn(test) {
  for (let i = 0; ; i += 1) {
    const id = `5B1F2C3D-0000-4000-8000-${String(i).padStart(12, '0')}`;
    if (test(await rolloutBucket(id, ID_NEW))) return id;
  }
}

suite('internal channel', () => {
  test('exactly channel="internal" gets the internal pointer when it exists', async () => {
    await putPointer(manifest(ID_INTERNAL), 'internal');
    assert.equal(await served({ 'expo-extra-params': INTERNAL }), `manifest ${ID_INTERNAL}`);
    assert.equal(
      await served({ 'expo-extra-params': `other="x", ${INTERNAL}` }),
      `manifest ${ID_INTERNAL}`,
    );
  });

  test('every other value gets production, byte for byte', async () => {
    await putPointer(manifest(ID_INTERNAL), 'internal');
    const values = [
      undefined,
      'channel="beta"',
      'channel="production"',
      'channel=internal',
      'channel="Internal"',
      `${INTERNAL}, ${INTERNAL}`,
      `${INTERNAL}, channel="beta"`,
      `${INTERNAL};x=1`,
      '"not a dictionary',
      `${INTERNAL}, ${'x'.repeat(600)}="y"`,
      'channel',
    ];
    for (const value of values)
      assert.equal(await served({ 'expo-extra-params': value }), `manifest ${ID_NEW}`, value);
  });

  test('falls through to production when the internal pointer is missing, malformed or incomplete', async () => {
    assert.equal(await served({ 'expo-extra-params': INTERNAL }), `manifest ${ID_NEW}`);
    await putPointer('not json', 'internal');
    assert.equal(await served({ 'expo-extra-params': INTERNAL }), `manifest ${ID_NEW}`);
    await putPointer(manifest('0f6c5b0e-9999-4c5e-9d55-2b1f3e0a0009'), 'internal');
    assert.equal(await served({ 'expo-extra-params': INTERNAL }), `manifest ${ID_NEW}`);
  });

  test('an internal device that runs the internal update gets a 204', async () => {
    await putPointer(manifest(ID_INTERNAL), 'internal');
    const current = { 'expo-extra-params': INTERNAL, 'expo-current-update-id': ID_INTERNAL };
    assert.equal(await served(current), 204);
  });

  test('an internal request that falls through to production ignores the rollout percent', async () => {
    await putPointer({ ...manifest(ID_NEW), rollout: { percent: 0, previous: manifest(ID_OLD) } });
    assert.equal(await served({ 'expo-extra-params': INTERNAL }), `manifest ${ID_NEW}`);
    assert.equal(await served({}), `manifest ${ID_OLD}`);
  });

  test('the request header parser', () => {
    assert.equal(requestsInternalChannel(INTERNAL), true);
    for (const value of [null, '', 'channel="beta"', `${INTERNAL},${INTERNAL}`, 'channel=?1'])
      assert.equal(requestsInternalChannel(value), false, String(value));
  });
});

suite('production rollout', () => {
  const at = (percent, previous = manifest(ID_OLD)) =>
    putPointer({ ...manifest(ID_NEW), rollout: { percent, previous } });

  test('no rollout field, and 100%, serve everyone, with or without a client id', async () => {
    for (const setup of [() => {}, () => at(100)]) {
      await setup();
      for (const id of [undefined, 'not-a-uuid', '5B1F2C3D-0000-4000-8000-000000000000'])
        assert.equal(await served({ 'eas-client-id': id }), `manifest ${ID_NEW}`);
    }
  });

  test('inside the bucket gets the new update, outside gets previous', async () => {
    await at(30);
    const inside = await clientIdIn((b) => b < 30);
    const outside = await clientIdIn((b) => b >= 30);
    assert.equal(await served({ 'eas-client-id': inside }), `manifest ${ID_NEW}`);
    assert.equal(await served({ 'eas-client-id': outside }), `manifest ${ID_OLD}`);
  });

  test('a missing or malformed client id is outside', async () => {
    await at(99);
    for (const id of [
      undefined,
      '',
      'x',
      `${'A'.repeat(36)}`,
      '5B1F2C3D-0000-4000-8000-00000000000',
    ])
      assert.equal(await served({ 'eas-client-id': id }), `manifest ${ID_OLD}`, String(id));
  });

  test('0% serves nobody new; previous null outside is a 204', async () => {
    await at(0);
    const anyone = await clientIdIn(() => true);
    assert.equal(await served({ 'eas-client-id': anyone }), `manifest ${ID_OLD}`);
    await at(50, null);
    assert.equal(await served({ 'eas-client-id': await clientIdIn((b) => b >= 50) }), 204);
    assert.equal(
      await served({ 'eas-client-id': await clientIdIn((b) => b < 50) }),
      `manifest ${ID_NEW}`,
    );
  });

  test('a device outside that already runs previous gets a 204', async () => {
    await at(10);
    assert.equal(await served({ 'expo-current-update-id': ID_OLD }), 204);
  });

  test('the bucket is stable: SHA-256(client id + update id), first four bytes mod 100', async () => {
    const id = '5B1F2C3D-0000-4000-8000-000000000000';
    const digest = new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${id}${ID_NEW}`)),
    );
    const expected = new DataView(digest.buffer).getUint32(0) % 100;
    assert.equal(await rolloutBucket(id, ID_NEW), expected);
    assert.equal(await rolloutBucket(id, ID_NEW), expected);
  });

  test('a malformed rollout is a malformed pointer (500), never "everyone"', async () => {
    const bad = [
      { percent: 101, previous: null },
      { percent: 50.5, previous: null },
      { percent: '50', previous: null },
      { percent: 50 },
      { percent: 50, previous: { kind: 'manifest', id: 'x' } },
      null,
    ];
    for (const rollout of bad) {
      await putPointer({ ...manifest(ID_NEW), rollout });
      assert.equal(parsePointer(JSON.stringify({ ...manifest(ID_NEW), rollout })), null);
      assert.equal(await served({}), 500, JSON.stringify(rollout));
    }
  });
});

suite('privacy', () => {
  let calls;
  beforeEach((t) => {
    calls = [];
    for (const m of ['log', 'info', 'warn', 'error', 'debug', 'trace'])
      t.mock.method(console, m, (...args) => calls.push([m, args]));
  });
  afterEach(() => assert.deepEqual(calls, []));

  test('the client id is never logged, stored or echoed', async (t) => {
    await putPointer({ ...manifest(ID_NEW), rollout: { percent: 40, previous: manifest(ID_OLD) } });
    const put = t.mock.method(bucket, 'put');
    const id = '5B1F2C3D-ABCD-4000-8000-0000000000EE';
    const res = await server.fetch(
      new Request('https://updates.example/manifest', {
        headers: headers({ 'eas-client-id': id, 'expo-extra-params': INTERNAL }),
      }),
      { UPDATES: bucket },
    );
    const text = `${[...res.headers].join('\n')}\n${new TextDecoder().decode(await res.arrayBuffer())}`;
    assert.equal(text.toLowerCase().includes(id.toLowerCase()), false);
    assert.equal(put.mock.callCount(), 0);
  });
});
