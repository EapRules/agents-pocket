import { describe, expect, it } from 'vitest';
import { renderText } from '../../errors/text';
import { backgroundWorkItem, notice, toolActivity, userMessage } from '../model/factories';
import { type ChatBackgroundWorkItem, emptyTranscript } from '../model/types';
import { type ChatRow, type ChatRowContent, chatRow, rowID } from '../timeline/row';
import { presentBackgroundWork } from './presentation';
import { backgroundSheetOf } from './sheet';
import {
  chatStatusLine,
  liveLine,
  liveTurnOf,
  sameLiveTurn,
  withLiveLine,
  withoutLiveTurn,
} from './status-line';
import { type ChatBackgroundWork, listedNotices } from './work';

const NOW = Date.parse('2026-11-13T15:20:00Z');
const ago = (seconds: number) => new Date(NOW - seconds * 1000).toISOString();
const row = (id: string, content: ChatRowContent): ChatRow => chatRow(rowID.entry(id), content, 0);
const header = (since: string): ChatRow =>
  chatRow(
    rowID.liveTurn,
    {
      type: 'turnHeader',
      header: { state: { kind: 'working', since }, isOpen: false, stepCount: 0 },
    },
    0,
  );
const call = (status: 'running' | 'succeeded' | 'awaitingApproval') =>
  row('t', {
    type: 'tool',
    tool: toolActivity({ kind: 'command', name: 'Bash', title: 'pnpm test', status }),
  });
const reasoning = row('r', {
  type: 'reasoning',
  reasoning: { text: 'Checking', durationMilliseconds: null },
});
const user = row('u', { type: 'user', message: userMessage('Go') });

type Item = Partial<ChatBackgroundWorkItem>;

function work(items: Item[]): ChatBackgroundWork {
  return {
    isLive: true,
    rows: items.map((item, index) => ({
      item: {
        id: `w${index}`,
        kind: 'subagent',
        title: `Work ${index}`,
        subtitle: 'general-purpose',
        state: 'running',
        journalPath: null,
        launchOffset: 0,
        endOffset: null,
        launchedAt: ago(30),
        agentID: null,
        resume: null,
        endedAt: null,
        usage: null,
        ...item,
      },
      progress: null,
      isStale: false,
      lastActivity: null,
    })),
  };
}

const line = (rows: ChatRow[], items: Item[] = [], isBlocked = false) =>
  chatStatusLine(
    liveTurnOf(rows),
    presentBackgroundWork(work(items), { isHostConnected: true, now: NOW, locale: 'en' }),
    { isBlocked },
  );
const text = (rows: ChatRow[], items: Item[] = []) => {
  const shown = line(rows, items);
  return shown === null ? null : renderText(shown.text);
};

describe('the status line over the Composer', () => {
  it('is absent with no turn running and nothing for the sheet to list', () => {
    expect(line([user])).toBeNull();
    expect(line([user], [], true)).toBeNull();
  });

  it('stays after the turn while the sheet lists finished work, with counts only', () => {
    const done = line([user], [{ state: 'completed', endedAt: ago(5) }, { state: 'failed' }], true);
    expect(renderText(done?.text ?? '')).toBe('1 done · 1 failed');
    expect(done?.state).toBe('failed');
    expect(done?.ticks).toBe(false);
  });

  it('counts what the sheet lists: a running background command runs, a stray notice is a row', () => {
    const command = backgroundWorkItem({
      id: 'c1',
      kind: 'command',
      title: 'Build',
      launchOffset: 20,
      launchedAt: ago(30),
    });
    const transcript = {
      ...emptyTranscript(),
      latestPromptOffset: 10,
      backgroundWork: [command],
      entries: [
        {
          id: 'n1',
          sourceOffset: 40,
          content: {
            type: 'notice' as const,
            value: notice('taskNotification', 'Background command "Lint" completed', {
              task: {
                callID: null,
                taskID: 'b9',
                kind: 'command',
                state: 'completed',
                label: 'Lint',
                exitCode: 0,
              },
            }),
          },
        },
      ],
    };
    const listed = presentBackgroundWork(backgroundSheetOf(transcript, {}, true, NOW), {
      isHostConnected: true,
      now: NOW,
      locale: 'en',
    });
    const shown = chatStatusLine(null, listed, { isBlocked: false });
    expect(renderText(shown?.text ?? '')).toBe('1 running · 1 done');
    // A notice that names no work is no row of the sheet, so the line has nothing to count.
    const stray = {
      ...emptyTranscript(),
      latestPromptOffset: 10,
      entries: [
        {
          id: 'n2',
          sourceOffset: 40,
          content: { type: 'notice' as const, value: notice('taskNotification', 'Done') },
        },
      ],
    };
    const empty = presentBackgroundWork(backgroundSheetOf(stray, {}, true, NOW), {
      isHostConnected: true,
      now: NOW,
      locale: 'en',
    });
    expect(chatStatusLine(null, empty, { isBlocked: false })).toBeNull();
  });

  it('leaves the turn itself to the live line: no time, nothing it does', () => {
    expect(line([user, header(ago(116))])).toBeNull();
    expect(line([user, header(ago(116)), reasoning])).toBeNull();
    expect(line([user, header(ago(5)), call('running')])).toBeNull();
  });

  it('says the Agent waits on the user for an approval or a Blocked report', () => {
    const waiting = line([user, header(ago(5)), call('awaitingApproval')]);
    expect(waiting?.state).toBe('waiting');
    expect(renderText(waiting?.text ?? '')).toBe('Needs you');
    expect(line([user, header(ago(5)), reasoning], [], true)?.state).toBe('waiting');
  });

  it('folds running and finished work into counts', () => {
    const items: Item[] = [{}, { state: 'completed' }, { state: 'completed' }, { state: 'failed' }];
    expect(text([user, header(ago(5))], items)).toBe('1 running · 2 done · 1 failed');
    const after = line([user], [{}, { state: 'completed' }]);
    expect(renderText(after?.text ?? '')).toBe('1 running · 1 done');
    expect(after?.state).toBe('running');
    expect(after?.ticks).toBe(true);
  });

  it('leaves the live header out of the rows, and tells a changed turn from the same one', () => {
    const rows = [user, header(ago(5)), reasoning];
    expect(withoutLiveTurn(rows).map((shown) => shown.id)).toEqual([user.id, reasoning.id]);
    expect(sameLiveTurn(liveTurnOf(rows), liveTurnOf([...rows]))).toBe(true);
    const running = liveTurnOf([user, header(ago(5)), call('running')]);
    expect(sameLiveTurn(liveTurnOf(rows), running)).toBe(false);
    expect(sameLiveTurn(null, liveTurnOf(rows))).toBe(false);
    expect(sameLiveTurn(null, null)).toBe(true);
  });
});

describe('the live line at the end of the transcript', () => {
  const said = (rows: ChatRow[]) => {
    const turn = liveTurnOf(rows);
    return turn === null ? null : renderText(liveLine(turn, NOW).text);
  };

  it('ends the rows while a turn runs, in place of the turn header, and is absent otherwise', () => {
    const rows = [user, header(ago(5)), reasoning];
    const shown = withLiveLine(rows);
    expect(shown.map((r) => r.id)).toEqual([user.id, reasoning.id, rowID.working]);
    expect(shown.at(-1)?.content).toEqual({ type: 'working', turn: liveTurnOf(rows) });
    expect(withLiveLine([user, reasoning]).map((r) => r.id)).toEqual([user.id, reasoning.id]);
  });

  it('keeps its revision while the turn does the same thing, and changes it when that changes', () => {
    const revision = (rows: ChatRow[]) => withLiveLine(rows).at(-1)?.revision;
    expect(revision([user, header(ago(5)), reasoning])).toBe(
      revision([user, header(ago(5)), reasoning]),
    );
    expect(revision([user, header(ago(5)), reasoning])).not.toBe(
      revision([user, header(ago(5)), call('running')]),
    );
  });

  it('says how long the turn has worked, then what the newest record shows', () => {
    expect(said([user, header(ago(116))])).toBe('Working… 1m 56s');
    expect(said([user, header(ago(116)), reasoning])).toBe('Working… 1m 56s · Thinking');
    expect(said([user, header(ago(5)), call('running')])).toBe('Working… 5s · pnpm test');
    expect(said([user, header(ago(5)), call('succeeded')])).toBe('Working… 5s');
  });

  it('says it waits for the user, not that it works, on a request or a Blocked report', () => {
    expect(said([user, header(ago(5)), call('awaitingApproval')])).toBe('Waiting for you… 5s');
    const turn = liveTurnOf([user, header(ago(116)), reasoning]);
    if (turn === null) throw new Error('no turn');
    const blocked = liveLine(turn, NOW, true);
    expect(renderText(blocked.text)).toBe('Waiting for you… 1m 56s · Thinking');
    expect(blocked.waiting).toBe(true);
    expect(liveLine(turn, NOW).waiting).toBe(false);
  });
});

describe('harness notices for the sheet', () => {
  it('lists the task notifications since the latest message, and nothing else', () => {
    const entry = (id: string, sourceOffset: number, value = notice('taskNotification', 'x')) => ({
      id,
      sourceOffset,
      content: { type: 'notice' as const, value },
    });
    const transcript = {
      ...emptyTranscript(),
      latestPromptOffset: 10,
      entries: [
        entry('old', 5),
        entry('new', 20),
        entry('other', 21, notice('interrupted', 'Interrupted')),
      ],
    };
    expect(listedNotices(transcript).map((listed) => listed.id)).toEqual(['new']);
  });
});
