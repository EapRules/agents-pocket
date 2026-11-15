import { describe, expect, it } from 'vitest';
import { renderText } from '../../errors/text';
import { backgroundWorkItem, notice, toolActivity, userMessage } from '../model/factories';
import { type ChatBackgroundWorkItem, emptyTranscript } from '../model/types';
import { type ChatRow, type ChatRowContent, chatRow, rowID } from '../timeline/row';
import { type BackgroundWorkPresentation, presentBackgroundWork } from './presentation';
import { backgroundSheetOf } from './sheet';
import {
  type ChatStatusLineInput,
  chatStatusLine,
  liveTurnOf,
  sameLiveTurn,
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

const present = (listed: ChatBackgroundWork): BackgroundWorkPresentation =>
  presentBackgroundWork(listed, { isHostConnected: true, now: NOW, locale: 'en' });

const line = (rows: ChatRow[], items: Item[] = [], agent: ChatStatusLineInput['agent'] = 'idle') =>
  chatStatusLine({ turn: liveTurnOf(rows), work: present(work(items)), agent, now: NOW });
const text = (rows: ChatRow[], items: Item[] = [], agent: ChatStatusLineInput['agent'] = 'idle') =>
  renderText(line(rows, items, agent).text);

describe('the status line over the Composer', () => {
  it('says Idle with nothing happening, and is no control then', () => {
    const idle = line([user]);
    expect(renderText(idle.text)).toBe('Idle');
    expect(idle.state).toBe('idle');
    expect(idle.opensWork).toBe(false);
    expect(idle.ticks).toBe(false);
  });

  it('says how long the turn has worked, then what the newest record shows', () => {
    expect(text([user, header(ago(116))])).toBe('Working… 1m 56s');
    expect(text([user, header(ago(116)), reasoning])).toBe('Working… 1m 56s · Thinking');
    expect(text([user, header(ago(5)), call('running')])).toBe('Working… 5s · pnpm test');
    expect(text([user, header(ago(5)), call('succeeded')])).toBe('Working… 5s');
    const working = line([user, header(ago(5))]);
    expect(working.state).toBe('working');
    expect(working.ticks).toBe(true);
    expect(renderText(working.accessibilityValue)).toBe('Working for 5 seconds');
  });

  it('says Working with no turn read yet while herdr reports the Agent working', () => {
    const working = line([user], [], 'working');
    expect(renderText(working.text)).toBe('Working');
    expect(working.state).toBe('working');
  });

  it('says the Agent waits on the user for an approval or a Blocked report', () => {
    const asked = line([user, header(ago(5)), call('awaitingApproval')]);
    expect(asked.state).toBe('waiting');
    expect(renderText(asked.text)).toBe('Waiting for you… 5s');
    expect(text([user, header(ago(116)), reasoning], [], 'blocked')).toBe(
      'Waiting for you… 1m 56s · Thinking',
    );
    const blocked = line([user], [], 'blocked');
    expect(blocked.state).toBe('waiting');
    expect(renderText(blocked.text)).toBe('Needs you');
  });

  it('adds the Background Work as counts to whatever the Agent does', () => {
    const items: Item[] = [{}, { state: 'completed' }, { state: 'completed' }, { state: 'failed' }];
    expect(text([user, header(ago(5))], items)).toBe('Working… 5s · 1 running · 2 done · 1 failed');
    expect(text([user], [{}], 'blocked')).toBe('Needs you · 1 running');
    const idle = line([user], [{}, { state: 'completed' }]);
    expect(renderText(idle.text)).toBe('Idle · 1 running · 1 done');
    expect(idle.opensWork).toBe(true);
    expect(idle.ticks).toBe(true);
  });

  it("wears the work's mark while the Agent is idle, its own otherwise", () => {
    expect(line([user], [{}]).state).toBe('running');
    const done = line([user], [{ state: 'completed', endedAt: ago(5) }, { state: 'failed' }]);
    expect(done.state).toBe('failed');
    expect(done.ticks).toBe(false);
    expect(line([user], [{ state: 'completed' }]).state).toBe('completed');
    expect(line([user, header(ago(5))], [{}]).state).toBe('working');
    expect(line([user], [{}], 'blocked').state).toBe('waiting');
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
    const listed = present(backgroundSheetOf(transcript, {}, true, NOW));
    const shown = chatStatusLine({ turn: null, work: listed, agent: 'idle', now: NOW });
    expect(renderText(shown.text)).toBe('Idle · 1 running · 1 done');
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
    const empty = present(backgroundSheetOf(stray, {}, true, NOW));
    const idle = chatStatusLine({ turn: null, work: empty, agent: 'idle', now: NOW });
    expect(renderText(idle.text)).toBe('Idle');
    expect(idle.opensWork).toBe(false);
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
