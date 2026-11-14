// The upload step of `publish-update.mjs --upload`, with every refusal before anything is written:
// a --local-test bundle to r2, a bundle that fails verification, asset URLs that do not point at
// --base-url, a bucket the public log disagrees with. There is one channel: every official build
// gets what this uploads.
// A dry run prints the plan and touches nothing remote. A real upload appends the public log line
// and prints the git commands that publish it (it never commits or pushes).

import { readBundle } from './bundle.js';
import { appendLog, logCommitCommands, servedNow } from './log.js';
import { normalizeBaseUrl } from './manifest.js';
import { describeUpload, planUpload, uploadBundle } from './upload.js';
import { verifyBundle, verifyRemote } from './verify.js';

export const TARGETS = ['local', 'r2'];

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
 * @param {{dir: string, target: 'local' | 'r2',
 *   makeStore: () => import('./stores.js').Store, log: import('./log.js').LogEntry[], logFile: string,
 *   certificate: import('node:crypto').X509Certificate, keyId?: string, builds: object[],
 *   baseUrl?: string, dryRun?: boolean, fetchImpl?: typeof fetch,
 *   now?: () => Date, print?: (line: string) => void}} options
 *   log: the public log (ignored for the local target, which never logs); makeStore: called only
 *   for a real upload, so a dry run cannot reach a store.
 */
export async function runUpload(options) {
  const { dir, target, certificate, keyId, builds, print = console.log } = options;
  const { fetchImpl = fetch, now = () => new Date() } = options;
  if (!TARGETS.includes(target)) throw new Error('--target local|r2 is required');
  const real = target === 'r2';
  const log = real ? options.log : [];
  const bundle = readBundle(dir);
  if (real && bundle.entry.localTest)
    throw new Error('a --local-test bundle never goes to r2; publish from a clean main');
  const { problems, entry } = await verifyBundle(dir, { certificate, keyId, builds, log });
  if (problems.length)
    throw new Error(
      `the bundle failed verification; nothing was uploaded:\n${problems.map((p) => `  FAIL ${p}`).join('\n')}`,
    );
  const base = options.baseUrl ? normalizeBaseUrl(options.baseUrl) : null;
  const wrongUrl = base && assetUrlProblem(bundle, base);
  if (wrongUrl) throw new Error(`${wrongUrl}; nothing was uploaded`);

  const previous = servedNow(log, entry);
  if (options.dryRun) {
    for (const line of describeUpload(planUpload(bundle), { previous })) print(line);
    if (base) print(`Then check ${base}/manifest as the app would.`);
    print(
      `Dry run (${target}): nothing was read or written in any bucket, and the log is unchanged.`,
    );
    return { dryRun: true, entry };
  }

  const logged = { ...entry, uploadedAt: now().toISOString() };
  const readAsset = base
    ? async (sha256) => {
        const res = await fetchImpl(`${base}/assets/${sha256}`);
        if (!res.ok) return null;
        const contentType = res.headers.get('content-type') ?? '';
        return { bytes: new Uint8Array(await res.arrayBuffer()), contentType };
      }
    : undefined;
  const afterPointer = base
    ? async () => {
        const remote = await verifyRemote({
          manifestUrl: `${base}/manifest`,
          platform: entry.platform,
          runtimeVersion: entry.runtimeVersion,
          certificate,
          keyId,
          builds,
          log: [...log, logged],
          fetchImpl,
        });
        const found = remote.problems;
        if (!remote.served) found.push(`${base}/manifest serves nothing`);
        else if (remote.served.bodySha256 !== entry.bodySha256)
          found.push(`${base}/manifest serves sha256 ${remote.served.bodySha256}, not this update`);
        return found;
      }
    : undefined;
  await uploadBundle(bundle, {
    store: options.makeStore(),
    expectedPointer: real ? previous && { kind: previous.kind, id: previous.id } : undefined,
    readAsset,
    afterPointer,
    onProgress: print,
  });
  if (base) print(`${base}/manifest serves it, and it passes the app's checks.`);
  print(`Uploaded ${entry.kind} ${entry.id} (${target}).`);
  if (real) {
    appendLog(options.logFile, logged);
    print('Appended to docs/releases/updates.jsonl. Publish the log line (the upload does not):');
    for (const command of logCommitCommands(entry)) print(`  ${command}`);
  }
  return { dryRun: false, entry };
}
