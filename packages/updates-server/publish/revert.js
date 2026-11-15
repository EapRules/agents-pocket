// `publish-update.mjs revert`: back to the previous production update for everyone, including the
// devices that already took the current one.
//
// Moving the pointer back is not enough: expo-updates SDK 58 loads an update only when its
// commitTime (a manifest's createdAt) is strictly newer than the one it runs, and launches the
// newest it has stored (LoaderSelectionPolicyFilterAware / LauncherSelectionPolicyFilterAware, iOS
// and Android). A device on the bad update would ignore the older one. So a revert publishes
// something newer and signed:
// - previous is a manifest: its content (same launch asset, assets, extra and commit) re-signed as
//   a new manifest with a new id and createdAt now. The assets are already in the bucket, read back
//   and checked against the old manifest's hashes; only the body, signature and pointer are new.
// - previous is a directive, or there is none: a new rollBackToEmbedded directive (the binary's own
//   bundle), newer than the current update.
// The new pointer is at 100% with `previous: null`, so no later rollout can bring back what was
// reverted. Then it goes through the normal production upload (runUpload) and the public log.
import { join } from 'node:path';

import { storageKeys } from '../src/protocol.js';
import { createRevertBundle, createRollbackBundle } from './create.js';
import { servedNow } from './log.js';
import { sha256Base64Url, sha256Hex } from './manifest.js';
import { checkAgainstLog, readOnly, readProductionPointer } from './pointers.js';
import { runUpload } from './publish-upload.js';
import { signatureProblem } from './signing.js';
import { describePointer } from './upload.js';

const decode = (bytes) => new TextDecoder().decode(bytes);

/** A published manifest from the bucket, checked: our signature, this runtime, in the log. */
async function readPublished(store, id, { certificate, keyId, runtimeVersion, log }) {
  const [bytes, signature] = await Promise.all([
    store.get(storageKeys.body(id)),
    store.get(storageKeys.signature(id)),
  ]);
  if (!bytes || !signature) throw new Error(`manifest ${id} is not complete in the bucket`);
  const header = decode(signature).trim();
  const bad = signatureProblem({ bytes, header, certificate, keyId });
  if (bad)
    throw new Error(`manifest ${id} in the bucket fails its signature (${bad}); not re-signing it`);
  const manifest = JSON.parse(decode(bytes));
  if (manifest.id !== id || manifest.runtimeVersion !== runtimeVersion)
    throw new Error(
      `manifest ${id} in the bucket is not that update for runtime ${runtimeVersion}`,
    );
  if (log && !log.some((e) => e.id === id && e.bodySha256 === sha256Hex(bytes)))
    throw new Error(`manifest ${id} in the bucket is not the one the public log records`);
  return manifest;
}

/** Its assets as the bucket holds them, each checked against the manifest's hash. */
async function readAssets(store, manifest) {
  const files = new Map();
  for (const asset of [manifest.launchAsset, ...manifest.assets]) {
    const sha256 = /\/assets\/([0-9a-f]{64})$/.exec(String(asset.url))?.[1];
    if (!sha256) throw new Error(`asset ${asset.url} is not content-addressed`);
    if (files.has(sha256)) continue;
    const bytes = await store.get(storageKeys.asset(sha256));
    if (!bytes || sha256Hex(bytes) !== sha256 || sha256Base64Url(bytes) !== asset.hash)
      throw new Error(`asset ${sha256} is missing from the bucket or does not match its hash`);
    files.set(sha256, { sha256, contentType: asset.contentType, bytes });
  }
  return [...files.values()];
}

/**
 * @param {{target: 'local' | 'r2', store: import('./stores.js').Store, platform: string,
 *   runtimeVersion: string, log: import('./log.js').LogEntry[], logFile: string,
 *   certificate: import('node:crypto').X509Certificate, keyId?: string, builds: object[],
 *   privateKey?: import('node:crypto').KeyObject, commit: string, outRoot: string,
 *   baseUrl?: string, dryRun?: boolean, fetchImpl?: typeof fetch, now?: () => Date,
 *   id?: string, print?: (line: string) => void}} options
 *   privateKey: not needed for a dry run, which signs nothing. commit: recorded for a directive.
 */
export async function runRevert(options) {
  const { platform, runtimeVersion, certificate, keyId, dryRun, print = console.log } = options;
  const real = options.target === 'r2';
  const log = real ? options.log : [];
  const store = dryRun ? readOnly(options.store) : options.store;
  const { key, pointer } = await readProductionPointer(store, { platform, runtimeVersion });
  if (!pointer) throw new Error(`${key}: nothing is published, there is nothing to revert`);
  if (!pointer.rollout)
    throw new Error(
      `${key} was written before rollouts and records no previous update; use \`rollback\` and --upload it`,
    );
  if (real) checkAgainstLog(key, pointer, servedNow(log, { platform, runtimeVersion }));
  const back = pointer.rollout.previous;
  const scope = { certificate, keyId, runtimeVersion, log: real ? log : null };
  const previous = back?.kind === 'manifest' ? await readPublished(store, back.id, scope) : null;
  const id = options.id ?? crypto.randomUUID();
  print(`${key}:`);
  print(`  before  ${describePointer(pointer)}`);
  print(
    previous
      ? `  after   manifest ${id}: the content of manifest ${back.id} (commit ${String(previous.extra?.commit).slice(0, 9)}), re-signed with createdAt now; 100%, else nothing`
      : `  after   directive ${id}: rollBackToEmbedded (${back ? `previous was directive ${back.id}` : 'there is no previous update'}); 100%, else nothing`,
  );
  if (dryRun) {
    print('Dry run: nothing was signed, and nothing was written in any bucket or the log.');
    return { dryRun: true, before: pointer, kind: previous ? 'manifest' : 'directive' };
  }
  if (!options.privateKey) throw new Error('revert needs --key <path>: it signs a new update');

  const now = options.now?.() ?? new Date();
  const common = {
    outDir: join(options.outRoot, id),
    platform,
    runtimeVersion,
    builds: options.builds,
    log,
    privateKey: options.privateKey,
    certificate,
    keyId,
    id,
    now,
    revertOf: pointer.id,
  };
  if (previous)
    await createRevertBundle({ ...common, previous, files: await readAssets(store, previous) });
  else await createRollbackBundle({ ...common, commit: options.commit });
  return runUpload({
    dir: common.outDir,
    target: options.target,
    channel: 'production',
    makeStore: () => options.store,
    log: options.log,
    logFile: options.logFile,
    certificate,
    keyId,
    builds: options.builds,
    baseUrl: options.baseUrl,
    fetchImpl: options.fetchImpl,
    now: options.now,
    print,
  });
}
