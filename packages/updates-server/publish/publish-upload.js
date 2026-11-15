// The upload step of `publish-update.mjs --upload`, with every refusal before anything is written:
// a --local-test bundle to r2, a bundle that fails verification, asset URLs that do not point at
// --base-url, a bucket the public log disagrees with, a production rollout still below 100%.
//
// Two channels. `production` (the default) is what store installs get; its pointer records the
// rollout percent and the pointer it replaces (pointers.js), and a real upload appends the public
// log line and prints the git commands that publish it (it never commits or pushes). `internal` is
// what TestFlight installs get; it has no rollout and is never logged (it moves on every push).
// A dry run prints the plan and touches nothing remote.

import { CHANNELS } from '../src/protocol.js';
import { readBundle } from './bundle.js';
import { appendLog, logCommitCommands, servedNow } from './log.js';
import { normalizeBaseUrl } from './manifest.js';
import { productionPointer, syntheticClientId } from './pointers.js';
import { describeUpload, planUpload, uploadBundle } from './upload.js';
import { verifyBundle, verifyRemote } from './verify.js';

export const TARGETS = ['local', 'r2'];
const plain = (p) => (p ? { kind: p.kind, id: p.id } : null);

function assetUrlProblem(bundle, base) {
  if (bundle.entry.kind !== 'manifest') return null;
  const manifest = JSON.parse(new TextDecoder().decode(bundle.bytes));
  const wrong = [manifest.launchAsset, ...manifest.assets].find(
    (a) => !String(a?.url).startsWith(`${base}/assets/`),
  );
  return wrong
    ? `the bundle's asset URLs point at ${wrong.url}, not ${base}: it was built for another server`
    : null;
}

/**
 * @param {{dir: string, target: 'local' | 'r2', channel?: 'production' | 'internal',
 *   rollout?: number, makeStore: () => import('./stores.js').Store,
 *   log: import('./log.js').LogEntry[], logFile: string,
 *   certificate: import('node:crypto').X509Certificate, keyId?: string, builds: object[],
 *   baseUrl?: string, dryRun?: boolean, fetchImpl?: typeof fetch,
 *   now?: () => Date, print?: (line: string) => void}} options
 *   log: the public log (ignored for the local target, which never logs); makeStore: called only
 *   for a real upload, so a dry run cannot reach a store. rollout: the production percent (100).
 */
export async function runUpload(options) {
  const { dir, target, certificate, keyId, builds, print = console.log } = options;
  const { fetchImpl = fetch, now = () => new Date(), channel = 'production' } = options;
  if (!TARGETS.includes(target)) throw new Error('--target local|r2 is required');
  if (!CHANNELS.includes(channel)) throw new Error('--channel is internal or production');
  const production = channel === 'production';
  if (options.rollout !== undefined && !production)
    throw new Error('--rollout is for production only: the internal channel has no rollout');
  const percent = options.rollout ?? 100;
  const real = target === 'r2';
  const log = real ? options.log : [];
  const bundle = readBundle(dir);
  if (real && bundle.entry.localTest)
    throw new Error('a --local-test bundle never goes to r2; publish from a clean main');
  const { revertOf } = bundle.entry;
  if (revertOf && (!production || percent !== 100))
    throw new Error(
      'a revert goes to production, for everyone (no --channel internal, no --rollout)',
    );
  const { problems, entry } = await verifyBundle(dir, { certificate, keyId, builds, log });
  if (problems.length)
    throw new Error(
      `the bundle failed verification; nothing was uploaded:\n${problems.map((p) => `  FAIL ${p}`).join('\n')}`,
    );
  const base = options.baseUrl ? normalizeBaseUrl(options.baseUrl) : null;
  const wrongUrl = base && assetUrlProblem(bundle, base);
  if (wrongUrl) throw new Error(`${wrongUrl}; nothing was uploaded`);

  const previous = servedNow(log, entry);
  const pointerFor = production
    ? productionPointer({ kind: entry.kind, id: entry.id, percent, revertOf })
    : () => ({ kind: entry.kind, id: entry.id });
  if (options.dryRun) {
    const known = real && production;
    const before = known ? previous && plain(previous) : '(not read in a dry run)';
    const after =
      revertOf && !known
        ? { kind: entry.kind, id: entry.id, rollout: { percent: 100, previous: null } }
        : pointerFor(known ? before : null);
    const plan = planUpload(bundle, { channel });
    for (const line of describeUpload(plan, { before, after })) print(line);
    if (production && !revertOf)
      print('  (rollout.previous is whatever the pointer names when the upload runs)');
    if (base) print(`Then check ${base}/manifest as the app would.`);
    print(
      `Dry run (${target}, ${channel}): nothing was read or written in any bucket, and the log is unchanged.`,
    );
    return { dryRun: true, entry };
  }

  let pointer;
  const uploadedAt = now().toISOString();
  const logged = () => ({ ...entry, uploadedAt, previous: pointer.rollout.previous });
  const readAsset = base
    ? async (sha256) => {
        const res = await fetchImpl(`${base}/assets/${sha256}`);
        if (!res.ok) return null;
        const contentType = res.headers.get('content-type') ?? '';
        return { bytes: new Uint8Array(await res.arrayBuffer()), contentType };
      }
    : undefined;
  // Ask the deployed Worker as a device would: on internal, as a TestFlight install; on a partial
  // rollout, as a synthetic install inside it (or, at 0%, outside it, which must not get it).
  const afterPointer = base
    ? async () => {
        const inside = percent > 0;
        const clientId =
          production && percent < 100
            ? await syntheticClientId(entry.id, { inside, percent })
            : undefined;
        const remote = await verifyRemote({
          manifestUrl: `${base}/manifest`,
          platform: entry.platform,
          runtimeVersion: entry.runtimeVersion,
          certificate,
          keyId,
          builds,
          log: production ? [...log, logged()] : log,
          requireLogged: production,
          channel,
          clientId,
          fetchImpl,
        });
        const found = remote.problems;
        const ours = remote.served?.bodySha256 === entry.bodySha256;
        if (inside && !remote.served) found.push(`${base}/manifest serves nothing`);
        else if (inside && !ours)
          found.push(`${base}/manifest serves sha256 ${remote.served.bodySha256}, not this update`);
        else if (!inside && ours) found.push(`${base}/manifest serves it outside a 0% rollout`);
        return found;
      }
    : undefined;
  await uploadBundle(bundle, {
    store: options.makeStore(),
    channel,
    expectedPointer: real && production ? plain(previous) : undefined,
    pointerFor: (current) => {
      pointer = pointerFor(current);
      return pointer;
    },
    readAsset,
    afterPointer,
    onProgress: print,
  });
  if (base) print(`${base}/manifest serves it, and it passes the app's checks.`);
  print(`Uploaded ${entry.kind} ${entry.id} (${target}, ${channel}).`);
  if (real && production) {
    appendLog(options.logFile, logged());
    print('Appended to docs/releases/updates.jsonl. Publish the log line (the upload does not):');
    for (const command of logCommitCommands(entry)) print(`  ${command}`);
  } else if (real)
    print('Internal uploads are not logged: the public log is what store installs get.');
  return { dryRun: false, entry, pointer };
}
