import { describe, expect, it } from 'vitest';
import { message } from '../../errors/text';
import { backgroundWorkItem, notice } from '../model/factories';
import {
  type ChatBackgroundWorkItem,
  type ChatEntry,
  type ChatNoticeTask,
  emptyTranscript,
} from '../model/types';
import { presentBackgroundWork } from './presentation';
import { announces, backgroundSheetOf, noticeWork } from './sheet';

const NOW = Date.parse('2026-10-06T15:20:00Z');

const task = (partial: Partial<ChatNoticeTask>): ChatNoticeTask => ({
  callID: null,
  taskID: null,
  kind: null,
  state: 'completed',
  label: null,
  exitCode: null,
  ...partial,
});

const noticeEntry = (
  id: string,
  offset: number,
  value: Partial<ChatNoticeTask> | null,
): ChatEntry => ({
  id,
  sourceOffset: offset,
  content: {
    type: 'notice',
    value: notice('taskNotification', `Notice ${id}`, value === null ? {} : { task: task(value) }),
  },
});

const command = (id: string, partial: Partial<ChatBackgroundWorkItem> = {}) =>
  backgroundWorkItem({
    id,
    kind: 'command',
    title: id,
    launchOffset: 10,
    taskID: `t-${id}`,
    ...partial,
  });

const transcriptOf = (backgroundWork: ChatBackgroundWorkItem[], entries: ChatEntry[]) => ({
  ...emptyTranscript(),
  backgroundWork,
  entries,
  latestPromptOffset: 5,
});

describe('announces', () => {
  const subagent = backgroundWorkItem({
    id: 'call-1',
    kind: 'subagent',
    title: 'Audit',
    launchOffset: 1,
    agentID: 'agent-1',
    resume: { callID: 'call-2', offset: 50, resumedAt: null },
  });

  it('matches the launching call, the resuming call, or the task', () => {
    expect(announces(task({ callID: 'call-1' }), subagent)).toBe(true);
    expect(announces(task({ callID: 'call-2' }), subagent)).toBe(true);
    expect(announces(task({ taskID: 'agent-1' }), subagent)).toBe(true);
    expect(announces(task({ taskID: 't-x' }), command('x'))).toBe(true);
  });

  it('matches nothing else', () => {
    expect(announces(task({ callID: 'other', taskID: 'other' }), subagent)).toBe(false);
    expect(announces(task({}), subagent)).toBe(false);
  });
});

describe('noticeWork', () => {
  it('drops a notice about work the transcript holds', () => {
    const transcript = transcriptOf(
      [command('a')],
      [noticeEntry('n1', 20, { taskID: 't-a', kind: 'command' })],
    );
    expect(noticeWork(transcript)).toEqual([]);
  });

  it('stands a notice about unheld work in as its finished row', () => {
    const transcript = transcriptOf(
      [],
      [
        noticeEntry('n1', 20, {
          taskID: 't-z',
          kind: 'command',
          state: 'failed',
          label: 'Lint',
          exitCode: 2,
        }),
      ],
    );
    expect(noticeWork(transcript)).toEqual([
      expect.objectContaining({
        kind: 'command',
        title: 'Lint',
        state: 'failed',
        exitCode: 2,
        endOffset: 20,
      }),
    ]);
  });

  it('leaves out a notice that names no kind of work, one with no task, and one before the latest message', () => {
    const transcript = transcriptOf(
      [],
      [
        noticeEntry('n1', 20, { taskID: 'q', kind: null }),
        noticeEntry('n2', 30, null),
        noticeEntry('n3', 2, { taskID: 'r', kind: 'command' }),
      ],
    );
    expect(noticeWork(transcript)).toEqual([]);
  });
});

describe('backgroundSheetOf', () => {
  it('lists running work first, then what finished, newest end first, notices included', () => {
    const transcript = transcriptOf(
      [
        command('old', { state: 'completed', endOffset: 30 }),
        command('live'),
        command('new', { state: 'completed', endOffset: 60 }),
      ],
      [noticeEntry('n1', 45, { taskID: 'gone', kind: 'subagent', label: 'Earlier' })],
    );
    const ids = backgroundSheetOf(transcript, {}, true, NOW).rows.map((row) => row.item.id);
    expect(ids).toEqual(['live', 'new', 'notice:n1', 'old']);
  });

  it('ends running work a later notice announces', () => {
    const transcript = transcriptOf(
      [command('a')],
      [noticeEntry('n1', 40, { taskID: 't-a', kind: 'command', state: 'stopped' })],
    );
    const [row] = backgroundSheetOf(transcript, {}, true, NOW).rows;
    expect(row?.item).toMatchObject({ state: 'stopped', endOffset: 40 });
  });
});

describe('a sheet row’s second line', () => {
  const present = (item: ChatBackgroundWorkItem) =>
    presentBackgroundWork(backgroundSheetOf(transcriptOf([item], []), {}, true, NOW), {
      isHostConnected: true,
      now: NOW,
      locale: 'en',
      timeZone: 'UTC',
    }).rows[0];

  it('names the kind', () => {
    expect(present(command('a'))?.kindLabel).toEqual(message('Shell command'));
    const typed = backgroundWorkItem({
      id: 's',
      kind: 'subagent',
      title: 's',
      subtitle: 'Explore',
      launchOffset: 1,
    });
    expect(present(typed)?.kindLabel).toBe('Explore');
  });

  it('says a failure with its exit code, and nothing of a zero one', () => {
    const failed = present(command('a', { state: 'failed', endOffset: 20, exitCode: 1 }));
    expect(failed?.stateLabel).toEqual({
      join: [message('Failed'), message('Exit code %@', '1')],
      separator: ' · ',
    });
    const done = present(command('b', { state: 'completed', endOffset: 20, exitCode: 0 }));
    expect(done?.stateLabel).toEqual(message('Completed'));
  });

  it('shows the running time while it runs', () => {
    const running = present(command('a', { launchedAt: new Date(NOW - 75_000).toISOString() }));
    expect(running?.stateLabel).toBe(running?.time);
    expect(running?.time).not.toBeNull();
  });

  it('marks a command line title monospaced, a described one not', () => {
    expect(present(command('a'))?.monospaced).toBe(true);
    expect(present(command('b', { subtitle: 'make b' }))?.monospaced).toBe(false);
  });
});
