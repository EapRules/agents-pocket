// Scripted Background Work for the atlas: the conversations behind the strip, the sheet (a short
// list, a long Finished list) and the Subagent detail with a long prompt.

import {
  type BackgroundWorkUsage,
  type ChatBackgroundWorkItem,
  type ChatEntry,
  type ChatNoticeTask,
  type ConversationState,
  notice,
  toolActivity,
} from '@openagentspocket/core';
import { ATLAS_NOW } from './atlasClock';

const at = (secondsAgo: number) => new Date(ATLAS_NOW - secondsAgo * 1000).toISOString();

export const work = (
  id: string,
  title: string,
  options: Partial<ChatBackgroundWorkItem> & { launchedAgo: number },
): ChatBackgroundWorkItem => ({
  id,
  kind: 'subagent',
  title,
  subtitle: null,
  state: 'running',
  journalPath: null,
  launchOffset: 100,
  endOffset: null,
  launchedAt: at(options.launchedAgo),
  agentID: options.kind === 'subagent' || options.kind === undefined ? `a-${id}` : null,
  resume: null,
  endedAt: null,
  usage: null,
  ...options,
});

const usage = (fields: Partial<BackgroundWorkUsage>): BackgroundWorkUsage => ({
  tokens: null,
  toolUses: null,
  durationMilliseconds: null,
  agents: null,
  agentsDone: null,
  agentsFailed: null,
  ...fields,
});

/** The Agent's call row for a Subagent, which its transcript opens from. */
const subagentCall = (
  id: string,
  title: string,
  kind: string,
  offset: number,
  status: 'started' | 'succeeded' = 'succeeded',
): ChatEntry => ({
  id,
  sourceOffset: offset,
  content: {
    type: 'tool',
    value: toolActivity({
      kind: 'agent',
      name: 'Task',
      title,
      subtitle: kind,
      status,
      subagentAgentID: `a-${id}`,
    }),
  },
});

/** A harness notice announcing the end of a task. */
const taskNotice = (
  id: string,
  offset: number,
  title: string,
  task: ChatNoticeTask,
): ChatEntry => ({
  id,
  sourceOffset: offset,
  content: { type: 'notice', value: notice('taskNotification', title, { task }) },
});

/** Mid-session: a Subagent, a Workflow and a command running; Subagents and commands finished. */
export function workStateOf(base: ConversationState): ConversationState {
  const transcript = base.snapshot.transcript;
  return {
    ...base,
    snapshot: {
      ...base.snapshot,
      transcript: {
        ...transcript,
        latestPromptOffset: 50,
        entries: [
          ...transcript.entries,
          subagentCall('w1', 'Find old pairing steps', 'Explore', 100, 'started'),
          subagentCall('w3', 'Check screenshots', 'general-purpose', 101),
          subagentCall('w4', 'Check link anchors', 'Explore', 102),
          // Announces c2, which its row already shows: no row of its own.
          taskNotice('n2', 135, 'Background command "Run the toolbar snapshots" failed', {
            callID: 'c2',
            taskID: 'b2',
            kind: 'command',
            state: 'failed',
            label: 'Run the toolbar snapshots',
            exitCode: 1,
          }),
          // A command launched above the loaded lines: the notice stands in as its row.
          taskNotice('n1', 140, 'Background command "Install the pods" completed (exit code 0)', {
            callID: null,
            taskID: 'b9',
            kind: 'command',
            state: 'completed',
            label: 'Install the pods',
            exitCode: 0,
          }),
        ],
        backgroundWork: [
          work('w1', 'Find old pairing steps', { subtitle: 'Explore', launchedAgo: 246 }),
          work('w2', 'docs-audit', {
            kind: 'workflow',
            subtitle: 'Check every guide page against the QR code flow',
            launchedAgo: 237,
          }),
          work('c1', 'Build the simulator app with over-the-air updates turned on', {
            kind: 'command',
            subtitle: 'npx expo run:ios --configuration Release --device "iPhone 17"',
            launchedAgo: 95,
            taskID: 'b1',
          }),
          work('w3', 'Check screenshots', {
            subtitle: 'general-purpose',
            state: 'completed',
            launchedAgo: 200,
            endOffset: 120,
            endedAt: at(76),
            usage: usage({ tokens: 41_200, toolUses: 14, durationMilliseconds: 124_000 }),
          }),
          work('c2', 'Run the toolbar snapshots', {
            kind: 'command',
            subtitle: 'swift test --filter AttachToolbarSnapshotTests',
            state: 'failed',
            launchedAgo: 180,
            endOffset: 125,
            endedAt: at(90),
            exitCode: 1,
            taskID: 'b2',
          }),
          work('w4', 'Check link anchors', {
            subtitle: 'Explore',
            state: 'completed',
            launchedAgo: 150,
            endOffset: 130,
            endedAt: at(79),
            usage: usage({ durationMilliseconds: 71_000 }),
          }),
        ],
      },
    },
    workflowProgress: {
      w2: {
        updatedAt: at(5),
        agents: [
          { id: 'k1', label: 'audit:setup', phase: 'Audit', state: 'done' },
          { id: 'k2', label: 'audit:index', phase: 'Audit', state: 'done' },
          { id: 'k3', label: null, phase: 'Verify', state: 'running' },
        ],
      },
    },
  };
}

const FINISHED: readonly [string, 'subagent' | 'command', string | null][] = [
  ['Audit the pairing guide', 'subagent', 'Explore'],
  ['Lint the workspace', 'command', 'pnpm exec biome check .'],
  ['Find every caller of readSubagent', 'subagent', 'Explore'],
  ['Type-check the app', 'command', 'pnpm exec tsc -b'],
  ['Review the release notes', 'subagent', 'general-purpose'],
  ['Export the web bundle', 'command', 'npx expo export --platform web'],
  ['Compare the store screenshots', 'subagent', 'general-purpose'],
  ['git log --oneline -20', 'command', null],
  ['Check the privacy policy wording', 'subagent', 'Explore'],
  ['Run the core tests', 'command', 'pnpm --filter @openagentspocket/core test'],
  ['Summarize open issues', 'subagent', 'general-purpose'],
  ['Upload the update bundle', 'command', 'node scripts/upload-update.mjs --channel preview'],
];

/** A long autonomous turn: one Subagent running, a dozen pieces of work finished. */
export function longWorkStateOf(base: ConversationState): ConversationState {
  const transcript = base.snapshot.transcript;
  const finished = FINISHED.map(([title, kind, subtitle], index) =>
    work(`l${index}`, title, {
      kind,
      subtitle,
      state: index === 3 ? 'failed' : 'completed',
      exitCode: kind === 'command' ? (index === 3 ? 2 : 0) : null,
      launchedAgo: 900 - index * 60,
      endOffset: 200 + index,
      endedAt: at(860 - index * 60),
    }),
  );
  return {
    ...base,
    snapshot: {
      ...base.snapshot,
      transcript: {
        ...transcript,
        latestPromptOffset: 50,
        entries: [
          ...transcript.entries,
          subagentCall('r1', 'Draft the release checklist', 'general-purpose', 100, 'started'),
          ...finished
            .filter((item) => item.kind === 'subagent')
            .map((item, index) =>
              subagentCall(item.id, item.title, item.subtitle ?? '', 101 + index),
            ),
        ],
        backgroundWork: [
          work('r1', 'Draft the release checklist', {
            subtitle: 'general-purpose',
            launchedAgo: 140,
          }),
          ...finished,
        ],
      },
    },
  };
}

/** What the long state's Subagents were asked: long enough to fold behind "Show More". */
export const LONG_PROMPT = [
  '## Goal',
  'Read every page under `docs/guide/` and list the ones that still describe the old pairing flow.',
  '',
  '## What to check',
  '- The steps mention a **QR code**, not a typed address.',
  '- Screenshots show the current Pair screen (`setup-2.png`, `setup-3.png`).',
  '- Links to `#pairing` anchors still resolve.',
  '',
  '## Output',
  'A table with the page, what is stale, and the fix. Do not edit any file.',
  '',
  '## Constraints',
  'Stay read-only. Skip `docs/archive/`. Report pages you could not open.',
].join('\n');
