// A shell command Claude Code runs in the background is Background Work of its own kind, ended by
// the task notification that names its call or only its task id; a background Subagent carries the
// prompt its launch gave it. Synthetic records in the shapes Claude Code writes.

import { describe, expect, it } from 'vitest';
import { encodeUtf8 } from '../../events/utf8';
import { backgroundSheetOf } from '../background-work/sheet';
import { backgroundWorkOf } from '../background-work/work';
import { goldenImage } from '../golden-image';
import { frameLines } from '../model/lines';
import type { ChatTranscript } from '../model/types';
import { projectionContext } from '../model/types';
import { ClaudeTranscriptReducer } from './reducer';

type Record = (uuid: string, parent: string | null) => object;

const NOW = Date.UTC(2026, 9, 6, 6, 0);
const at = (minute: number) => new Date(Date.UTC(2026, 9, 6, 5, minute)).toISOString();

const prompt =
  (minute: number): Record =>
  (uuid, parentUuid) => ({
    type: 'user',
    uuid,
    parentUuid,
    timestamp: at(minute),
    message: { role: 'user', content: 'Build it' },
    promptSource: 'typed',
    origin: { kind: 'human' },
  });

const use =
  (call: string, name: string, input: object, minute: number): Record =>
  (uuid, parentUuid) => ({
    type: 'assistant',
    uuid,
    parentUuid,
    timestamp: at(minute),
    message: {
      id: `m-${uuid}`,
      role: 'assistant',
      content: [{ type: 'tool_use', id: call, name, input }],
    },
    apiBlockIndex: 0,
  });

const result =
  (call: string, toolUseResult: object, minute: number): Record =>
  (uuid, parentUuid) => ({
    type: 'user',
    uuid,
    parentUuid,
    timestamp: at(minute),
    message: {
      role: 'user',
      content: [{ type: 'tool_result', tool_use_id: call, content: 'ok', is_error: false }],
    },
    toolUseResult,
  });

const notification =
  (fields: string, minute: number): Record =>
  (uuid, parentUuid) => ({
    type: 'user',
    uuid,
    parentUuid,
    timestamp: at(minute),
    message: { role: 'user', content: `<task-notification>${fields}</task-notification>` },
  });

const runInBackground = (call: string, task: string, input: object, minute: number) => [
  use(call, 'Bash', { run_in_background: true, ...input }, minute),
  result(
    call,
    { stdout: '', stderr: '', interrupted: false, isImage: false, backgroundTaskId: task },
    minute,
  ),
];

function read(records: Record[]): ChatTranscript {
  const text = `${records
    .map((record, index) =>
      JSON.stringify(record(`u${index}`, index === 0 ? null : `u${index - 1}`)),
    )
    .join('\n')}\n`;
  const reducer = new ClaudeTranscriptReducer();
  reducer.append(frameLines(encodeUtf8(text)));
  return reducer.transcript(projectionContext({ activity: 'working' }));
}

describe('a background shell command', () => {
  const launch = runInBackground(
    'toolu_build',
    'b1',
    { command: 'npx expo run:ios --configuration Release', description: 'Build the app' },
    1,
  );

  it('runs, titled by its description, with the command line under it', () => {
    const [item] = read([prompt(0), ...launch]).backgroundWork;
    expect(item).toMatchObject({
      kind: 'command',
      title: 'Build the app',
      subtitle: 'npx expo run:ios --configuration Release',
      state: 'running',
      taskID: 'b1',
    });
  });

  it('is titled by its command line when it states no purpose', () => {
    const records = [prompt(0), ...runInBackground('toolu_t', 'b2', { command: 'make test' }, 1)];
    expect(read(records).backgroundWork[0]).toMatchObject({ title: 'make test', subtitle: null });
  });

  it('ends with the notification naming its call, with the exit code it states', () => {
    const transcript = read([
      prompt(0),
      ...launch,
      notification(
        '<task-id>b1</task-id><tool-use-id>toolu_build</tool-use-id><status>failed</status><summary>Background command "Build the app" failed with exit code 65</summary>',
        3,
      ),
    ]);
    expect(transcript.backgroundWork[0]).toMatchObject({ state: 'failed', exitCode: 65 });
  });

  it('ends with a notification naming only its task id', () => {
    const transcript = read([
      prompt(0),
      ...launch,
      notification(
        '<task-id>b1</task-id><status>completed</status><summary>Background command "Build the app" completed (exit code 0)</summary>',
        3,
      ),
    ]);
    expect(transcript.backgroundWork[0]).toMatchObject({ state: 'completed', exitCode: 0 });
  });

  it('is the sheet’s, not the strip’s, and the Swift goldens never see it', () => {
    const transcript = read([prompt(0), ...launch]);
    expect(backgroundWorkOf(transcript, {}, true, NOW).rows).toEqual([]);
    expect(backgroundSheetOf(transcript, {}, true, NOW).rows.map((row) => row.item.id)).toEqual([
      'toolu_build',
    ]);
    expect((goldenImage(transcript) as { backgroundWork: unknown[] }).backgroundWork).toEqual([]);
  });
});

describe('a background Subagent', () => {
  it('carries the prompt its launch gave it', () => {
    const transcript = read([
      prompt(0),
      use(
        'toolu_ag',
        'Agent',
        {
          description: 'Audit the docs',
          subagent_type: 'Explore',
          prompt: '## Goal\nRead `docs/` and list stale pages.',
        },
        1,
      ),
      result('toolu_ag', { agentId: 'a1', status: 'async_launched' }, 1),
    ]);
    expect(transcript.backgroundWork[0]).toMatchObject({
      kind: 'subagent',
      prompt: '## Goal\nRead `docs/` and list stale pages.',
    });
    const [work] = (goldenImage(transcript) as { backgroundWork: object[] }).backgroundWork;
    expect(work).not.toHaveProperty('prompt');
  });
});
