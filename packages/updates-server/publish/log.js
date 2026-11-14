// The public log of published updates: docs/releases/updates.jsonl, one JSON object per line,
// appended by the upload step and committed by the owner. Lines are only ever appended.
//
// Why a file in the repository and not one the Worker serves: the server is the party the log must
// hold to account, and a file it serves is a file it can rewrite. Git history on the public repo is
// outside the Worker's and the Cloudflare account's reach, and each entry carries the manifest's
// SHA-256 and its signature, so anyone can check what the server serves against the log and the
// committed certificate, and rebuild the update from the logged commit.
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const LOG_FILE = join('docs', 'releases', 'updates.jsonl');

/**
 * @typedef {{kind: 'manifest' | 'directive', id: string, platform: string, runtimeVersion: string,
 *   createdAt: string, commit: string, bodySha256: string, signature: string,
 *   channel?: string, uploadedAt?: string}} LogEntry
 *   channel: only on lines written before the one channel (see isRetiredChannelEntry).
 */

/** @returns {LogEntry[]} */
export function readLog(file) {
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line, i) => {
      try {
        return JSON.parse(line);
      } catch {
        throw new Error(`${file}:${i + 1} is not JSON`);
      }
    });
}

/**
 * Whether a log entry records an upload to the retired `beta` channel (there were two channels
 * until 2026-11-14; now there is one). Such a line stays in the log, which is never rewritten, but
 * it is not what the server serves and not a previous update of the one channel: its pointer sits
 * at a path the Worker no longer reads. An entry with `channel: "production"`, or with no `channel`
 * (every entry since), is an update of the one channel.
 */
export function isRetiredChannelEntry(entry) {
  return entry.channel === 'beta';
}

export function appendLog(file, entry) {
  if (!entry.uploadedAt) throw new Error('a log entry needs uploadedAt');
  if ('channel' in entry) throw new Error('a new log entry carries no channel: there is one');
  appendFileSync(file, `${JSON.stringify(entry)}\n`);
}

/**
 * What a new update must be newer than: the entries of the one channel for the same platform and
 * runtime version (retired-channel lines excluded, see isRetiredChannelEntry).
 */
export function previousEntries(entries, { platform, runtimeVersion }) {
  return entries.filter(
    (e) =>
      e.platform === platform && e.runtimeVersion === runtimeVersion && !isRetiredChannelEntry(e),
  );
}

/** What the log says the server serves now: the last entry for that platform and runtime, if any. */
export function servedNow(entries, { platform, runtimeVersion }) {
  return previousEntries(entries, { platform, runtimeVersion }).at(-1) ?? null;
}

/** The git commands that publish the log line; the upload never commits or pushes itself. */
export function logCommitCommands(entry) {
  return [
    `git add ${LOG_FILE}`,
    `git commit -m "Updates: ${entry.kind} ${entry.id} published"`,
    'git push origin main',
  ];
}
