// The production pointer's rollout, as the publish tooling writes it (README "Storage layout"):
//
//   { "kind", "id", "rollout": { "percent": 0..100, "previous": { "kind", "id" } | null } }
//
// - Every production upload writes it: `previous` is the pointer it replaces (its kind and id), so a
//   revert always knows where to go back to, and a percent below 100 serves `previous` to the rest.
// - A new production upload is refused while the current one is below 100%: its `previous` would
//   become the half-rolled-out update, and installs outside the new rollout would get that instead
//   of what they run. Finish it (`rollout 100`) or `revert` first.
// - A revert's pointer has `previous: null`: no rollout can bring back the update it reverted.
// - `rollout <percent>` changes only the percent of the pointer in the bucket.

import { parsePointer, rolloutBucket, storageKeys } from '../src/protocol.js';
import { encodeJson } from './manifest.js';
import { describePointer } from './upload.js';

const decode = (bytes) => new TextDecoder().decode(bytes);
const plain = (p) => (p ? { kind: p.kind, id: p.id } : null);

/** An integer percent 0..100 from the command line; throws otherwise. */
export function parsePercent(raw) {
  const text = String(raw ?? '');
  if (!/^\d{1,3}$/.test(text) || Number(text) > 100)
    throw new Error(`the rollout percent must be a whole number from 0 to 100, not "${text}"`);
  return Number(text);
}

/**
 * The pointer function for a production upload (uploadBundle's `pointerFor`). `revertOf`: the id
 * the bundle reverts; then the current pointer must name exactly it, and any percent is allowed.
 */
export function productionPointer({ kind, id, percent = 100, revertOf }) {
  return (current) => {
    if (revertOf) {
      if (current?.id !== revertOf)
        throw new Error(
          `this revert was made for ${revertOf}, but production now names ${current ? current.id : 'nothing'}; nothing was written`,
        );
      return { kind, id, rollout: { percent: 100, previous: null } };
    }
    if (current?.rollout && current.rollout.percent < 100)
      throw new Error(
        `production is at ${current.rollout.percent}% of ${current.kind} ${current.id}: finish it (rollout 100) or revert first; nothing was written`,
      );
    return { kind, id, rollout: { percent, previous: plain(current) } };
  };
}

/** A store that can only read: what every dry run gets, so it cannot write by mistake. */
export function readOnly(store) {
  const refuse = () => {
    throw new Error('dry run: refusing to write');
  };
  return { ...store, put: refuse, remove: refuse };
}

/** The production pointer in a store, parsed; throws when the object exists but is malformed. */
export async function readProductionPointer(store, { platform, runtimeVersion }) {
  const key = storageKeys.pointer(platform, runtimeVersion);
  const bytes = await store.get(key);
  if (!bytes) return { key, pointer: null };
  const pointer = parsePointer(decode(bytes));
  if (!pointer) throw new Error(`${key} is malformed; fix it by hand before changing it`);
  return { key, pointer };
}

/** The public log must name what the bucket names (the same rule an upload applies). */
export function checkAgainstLog(key, pointer, logged) {
  if ((pointer?.id ?? null) !== (logged?.id ?? null))
    throw new Error(
      `${key} names ${pointer ? pointer.id : 'nothing'}, the public log says ${logged ? logged.id : 'nothing'}: reconcile docs/releases/updates.jsonl first; nothing was written`,
    );
}

/**
 * A client id inside (or outside) a rollout of `percent` for `updateId`, for checking the deployed
 * Worker as a device would. Synthetic, never a real install's.
 */
export async function syntheticClientId(updateId, { inside, percent }) {
  if ((inside && percent === 0) || (!inside && percent === 100))
    throw new Error(`no client id is ${inside ? 'inside' : 'outside'} a ${percent}% rollout`);
  for (let i = 0; ; i += 1) {
    const id = `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
    if ((await rolloutBucket(id, updateId)) < percent === inside) return id;
  }
}

/**
 * `publish-update.mjs rollout <percent>`: rewrite only the percent of the production pointer.
 * 0 stops it (nobody new gets it), 100 finishes it. No key: nothing is signed.
 *
 * @param {{percent: number, store: import('./stores.js').Store, platform: string,
 *   runtimeVersion: string, logged?: {id: string} | null, dryRun?: boolean,
 *   print?: (line: string) => void}} options
 *   logged: what the public log says production serves (real bucket only; undefined skips the check).
 */
export async function runRollout(options) {
  const { percent, platform, runtimeVersion, dryRun, print = console.log } = options;
  const store = dryRun ? readOnly(options.store) : options.store;
  const { key, pointer } = await readProductionPointer(store, { platform, runtimeVersion });
  if (!pointer) throw new Error(`${key}: nothing is published, there is nothing to roll out`);
  if (!pointer.rollout)
    throw new Error(
      `${key} was written before rollouts and records no previous update; the next --upload starts one`,
    );
  if (options.logged !== undefined) checkAgainstLog(key, pointer, options.logged);
  const next = { ...plain(pointer), rollout: { ...pointer.rollout, percent } };
  print(`${key}:`);
  print(`  before  ${describePointer(pointer)}`);
  print(`  after   ${describePointer(next)}`);
  if (dryRun) {
    print('Dry run: nothing was written.');
    return { dryRun: true, before: pointer, after: next };
  }
  if (pointer.rollout.percent === percent) {
    print('Already at that percent; nothing was written.');
    return { dryRun: false, before: pointer, after: pointer };
  }
  const bytes = encodeJson(next);
  await store.put(key, { bytes }, 'application/json');
  const back = await store.get(key);
  if (!back || decode(back) !== decode(bytes))
    throw new Error(`${key} did not read back as written; check it by hand`);
  print(`Moved ${key} to ${percent}%.`);
  return { dryRun: false, before: pointer, after: next };
}
