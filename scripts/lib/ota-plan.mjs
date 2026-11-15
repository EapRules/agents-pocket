// The plan behind `pnpm ota` (scripts/ota.mjs): argv in, an ordered list of steps out, every one a
// call of scripts/publish-update.mjs (or git for the log commit). Pure: no files, no network, no
// key. The step `{label, cmd, args}` runs from the repository root. A `{bundle}` argument is
// filled in once the build step has said where it wrote the bundle (bundleFromOutput, fillBundle).
import { join } from 'node:path';

import { parsePercent } from '../../packages/updates-server/publish/pointers.js';

export const DEFAULT_BASE_URL = 'https://updates.openagentspocket.com';
export const KEY_SUBPATH = '.config/openagentspocket/updates-signing/private-key.pem';
export const LOG_PATH = 'docs/releases/updates.jsonl';
const PUBLISH = 'scripts/publish-update.mjs';
const REACHES_STORE = 'This reaches store users (production), not only TestFlight.';
const COMMANDS = ['rollout', 'stop', 'revert', 'status'];
const VALUE_FLAGS = ['--key', '--base-url', '--rollout'];
const BOOL_FLAGS = ['--production', '--dry-run', '--yes', '--skip-tests', '--help'];

/** argv (without node and the script) as `{command, positional, flags}`, or `{problem}`. */
export function parseOta(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (VALUE_FLAGS.includes(a)) {
      const value = argv[++i];
      if (value === undefined || value.startsWith('--')) return { problem: `${a} needs a value` };
      flags[a] = value;
    } else if (BOOL_FLAGS.includes(a)) flags[a] = true;
    else if (a.startsWith('--')) return { problem: `unknown flag ${a}` };
    else positional.push(a);
  }
  const [first, ...rest] = positional;
  if (first && !COMMANDS.includes(first)) return { problem: `unknown command ${first}` };
  const command = first ?? (flags['--production'] ? 'production' : 'internal');
  return { command, positional: rest, flags };
}

const publish = (label, args) => ({ label, cmd: 'node', args: [PUBLISH, ...args] });

function percentOf(raw) {
  try {
    return { percent: parsePercent(raw) };
  } catch (error) {
    return { problem: error.message };
  }
}

/**
 * @param {ReturnType<typeof parseOta>} parsed
 * @param {{home: string, internal?: {id: string, dir: string, exists: boolean} | null}} ctx
 *   `internal` is what the internal channel serves now and where its bundle is (for --production).
 * @returns {{command?: string, steps: {label: string, cmd: string, args: string[]}[],
 *   warnings: string[], after: string[], needsBundleFromInternal?: boolean, problem?: string}}
 */
export function planOta(parsed, ctx) {
  const refuse = (problem) => ({ steps: [], warnings: [], after: [], problem });
  if (parsed.problem) return refuse(parsed.problem);
  const { command, flags, positional } = parsed;
  const dry = Boolean(flags['--dry-run']);
  const dryArg = dry ? ['--dry-run'] : [];
  const baseUrl = (flags['--base-url'] ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
  const key = flags['--key'] ?? join(ctx.home, KEY_SUBPATH);
  const manifest = `${baseUrl}/manifest`;
  const plan = { command, steps: [], warnings: [], after: [] };

  if (flags['--production'] && command !== 'production')
    return refuse(
      '--production goes alone, not with a command (it promotes internal to production)',
    );
  if (flags['--rollout'] !== undefined && command !== 'production')
    return refuse('--rollout only goes with --production');
  if (command === 'status') return plan;

  if (command === 'rollout' || command === 'stop') {
    const { percent, problem } = command === 'stop' ? { percent: 0 } : percentOf(positional[0]);
    if (problem) return refuse(problem);
    plan.steps.push(
      publish(`set the production rollout to ${percent}%`, [
        'rollout',
        String(percent),
        '--target',
        'r2',
        ...dryArg,
      ]),
    );
    return plan;
  }

  const needsYes = (what) =>
    dry || flags['--yes']
      ? null
      : `${what} reaches store users: pass --yes to proceed, or --dry-run`;

  if (command === 'revert') {
    const problem = needsYes('revert');
    if (problem) return refuse(problem);
    plan.warnings.push(`${REACHES_STORE} Revert serves the previous update to everyone.`);
    plan.steps.push(
      publish('revert production to the previous update', [
        'revert',
        '--target',
        'r2',
        '--key',
        key,
        '--base-url',
        baseUrl,
        ...dryArg,
      ]),
    );
    return plan;
  }

  if (command === 'production') {
    const { percent, problem: bad } = percentOf(flags['--rollout'] ?? 10);
    const problem = bad ?? needsYes('--production');
    if (problem) return refuse(problem);
    if (!ctx.internal?.exists)
      return refuse(
        ctx.internal
          ? `internal serves ${ctx.internal.id} but ${ctx.internal.dir} is missing: run pnpm ota first`
          : 'the internal channel serves nothing: run pnpm ota first',
      );
    const { id, dir } = ctx.internal;
    plan.needsBundleFromInternal = true;
    plan.warnings.push(`${REACHES_STORE} Promoting update ${id} at ${percent}%.`);
    plan.steps.push(
      publish(`upload ${id} to production at ${percent}%`, [
        '--upload',
        dir,
        '--target',
        'r2',
        '--channel',
        'production',
        '--rollout',
        String(percent),
        '--base-url',
        baseUrl,
        ...dryArg,
      ]),
    );
    if (!dry) {
      plan.steps.push(
        publish('check production live', ['verify', '--url', manifest]),
        { label: 'stage the public log', cmd: 'git', args: ['add', LOG_PATH] },
        {
          label: 'commit the public log',
          cmd: 'git',
          args: [
            'commit',
            '-m',
            `Log update ${id} at ${percent}% in the public log`,
            '--',
            LOG_PATH,
          ],
        },
      );
      plan.after.push('Publish the log line: git push');
    }
    return plan;
  }

  // The default: a fresh bundle of this commit, to the internal channel.
  plan.steps.push(
    publish('build, sign and verify the bundle', [
      '--key',
      key,
      '--base-url',
      baseUrl,
      ...(flags['--skip-tests'] ? ['--skip-tests'] : []),
    ]),
    publish('upload to the internal channel', [
      '--upload',
      '{bundle}',
      '--target',
      'r2',
      '--channel',
      'internal',
      '--base-url',
      baseUrl,
      ...dryArg,
    ]),
  );
  if (!dry)
    plan.steps.push(
      publish('check internal live', ['verify', '--url', manifest, '--channel', 'internal']),
    );
  return plan;
}

/** The bundle folder publish-update's summary names ("  bundle     build/updates/<id>"). */
export function bundleFromOutput(output) {
  return /^ {2}bundle\s+(\S+)/m.exec(output)?.[1] ?? null;
}

/** The steps with every `{bundle}` argument replaced by `dir`. */
export function fillBundle(steps, dir) {
  return steps.map((s) => ({ ...s, args: s.args.map((a) => (a === '{bundle}' ? dir : a)) }));
}
