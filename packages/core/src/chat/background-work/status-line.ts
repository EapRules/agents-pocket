// Chat's one status line, pinned over the Composer: what the Agent does (its running turn, that it
// needs the user, or that it is idle) and its Background Work as counts. Built from the projected
// rows, herdr's status and the Background Work presentation, so it reads the same for every
// program: a program that records no reasoning or running calls shows only the time.

import { message, renderText, type Text } from '../../errors/text';
import { formatDuration } from '../../format/duration';
import { type ChatLiveTurn, type ChatRow, type ChatTurnDoing, rowID } from '../timeline/row';
import { toolLine } from '../timeline/tool-line';
import type { BackgroundWorkPresentation, BackgroundWorkStatus } from './presentation';

export type { ChatLiveTurn, ChatTurnDoing } from '../timeline/row';

/**
 * What the line's mark shows: the Agent working or waiting on the user, or, while it is idle, the
 * state of its Background Work (`idle` with none).
 */
export type ChatStatusLineState = BackgroundWorkStatus | 'working' | 'waiting' | 'idle';

export interface ChatStatusLine {
  state: ChatStatusLineState;
  /** "Working… 1m 56s · Thinking · 2 running · 1 done". */
  text: Text;
  /** The same, as VoiceOver reads it. */
  accessibilityValue: Text;
  /** The line holds a moving time. */
  ticks: boolean;
  /** The Background Work sheet has rows to show, so a tap opens it. */
  opensWork: boolean;
}

const RUNNING_CALL: ReadonlySet<string> = new Set(['running', 'started']);

function doingOf(live: readonly ChatRow[]): ChatTurnDoing | null {
  if (
    live.some(
      (row) => row.content.type === 'tool' && row.content.tool.status === 'awaitingApproval',
    )
  )
    return { kind: 'waiting' };
  const last = live.at(-1)?.content;
  if (last?.type === 'reasoning') return { kind: 'thinking' };
  if (last?.type === 'tool' && RUNNING_CALL.has(last.tool.status))
    return { kind: 'tool', title: toolLine(last.tool).title };
  return null;
}

/** The running turn of projected rows; null when none runs. */
export function liveTurnOf(rows: readonly ChatRow[]): ChatLiveTurn | null {
  const start = rows.findIndex((row) => row.id === rowID.liveTurn);
  const head = rows[start]?.content;
  if (head?.type !== 'turnHeader' || head.header.state.kind !== 'working') return null;
  // Calls inside an open group are earlier ones (a running group keeps its newest call outside),
  // and Chat's own echoes are not what the Agent does.
  const live = rows
    .slice(start + 1)
    .filter((row) => !row.isNested && row.content.type !== 'pending');
  return { since: head.header.state.since, doing: doingOf(live) };
}

/** The transcript's rows without the running turn's header: the status line shows the turn. */
export const withoutLiveTurn = (rows: readonly ChatRow[]): ChatRow[] =>
  rows.filter((row) => row.id !== rowID.liveTurn);

/** What the line says the Agent does, null when its records say nothing. */
export function doingText(doing: ChatTurnDoing | null): Text | null {
  if (doing?.kind === 'waiting') return message('Needs you');
  if (doing?.kind === 'thinking') return message('Thinking');
  if (doing?.kind === 'tool') return doing.title;
  return null;
}

export function sameLiveTurn(a: ChatLiveTurn | null, b: ChatLiveTurn | null): boolean {
  if (a === null || b === null) return a === b;
  const title = (turn: ChatLiveTurn) =>
    turn.doing?.kind === 'tool' ? renderText(turn.doing.title) : null;
  return a.since === b.since && a.doing?.kind === b.doing?.kind && title(a) === title(b);
}

export interface ChatStatusLineInput {
  /** The running turn of the transcript; null with none. */
  turn: ChatLiveTurn | null;
  /** What the Background Work sheet lists (`backgroundSheetOf`: every kind, notices folded in). */
  work: BackgroundWorkPresentation;
  /** herdr's status for the Agent: Blocked waits on the user; working runs with no turn read yet. */
  agent: 'blocked' | 'working' | 'idle';
  /** Epoch milliseconds the turn's time is counted to. */
  now: number;
}

interface Said {
  shown: Text[];
  spoken: Text[];
}

/** The Agent's own part: its turn with time and what it does, that it needs you, or Idle. */
function agentPart(
  turn: ChatLiveTurn | null,
  agent: ChatStatusLineInput['agent'],
  now: number,
): Said & { state: 'working' | 'waiting' | 'idle' } {
  if (turn === null) {
    const key = agent === 'blocked' ? 'Needs you' : agent === 'working' ? 'Working' : 'Idle';
    const state = agent === 'blocked' ? 'waiting' : agent === 'working' ? 'working' : 'idle';
    return { state, shown: [message(key)], spoken: [message(key)] };
  }
  const seconds = Math.max(0, (now - Date.parse(turn.since)) / 1000);
  const waiting = agent === 'blocked' || turn.doing?.kind === 'waiting';
  // "Needs you" would repeat the line's own words.
  const doing = turn.doing?.kind === 'waiting' ? null : doingText(turn.doing);
  const key = waiting ? 'Waiting for you… %@' : 'Working… %@';
  const shown: Text[] = [message(key, formatDuration(seconds))];
  const spoken: Text[] = [
    waiting
      ? message(key, formatDuration(seconds, 'wide'))
      : message('Working for %@', formatDuration(seconds, 'wide')),
  ];
  if (doing !== null) {
    shown.push(doing);
    spoken.push(doing);
  }
  return { state: waiting ? 'waiting' : 'working', shown, spoken };
}

const n = (value: number) => String(value);

/**
 * The status line over Chat's Composer, the one place Chat says what goes on. It always says
 * something: "Working… 5s · Thinking", "Waiting for you… 5s", "Needs you" or "Idle", then the
 * Background Work the sheet lists as counts ("· 1 running · 2 done"), so it never promises a row
 * the sheet lacks.
 */
export function chatStatusLine({ turn, work, agent, now }: ChatStatusLineInput): ChatStatusLine {
  const own = agentPart(turn, agent, now);
  const shown = [...own.shown];
  const spoken = [...own.spoken];
  const count = (...statuses: BackgroundWorkStatus[]) =>
    work.rows.filter((row) => statuses.includes(row.status)).length;
  const running = count('running');
  const notUpdating = count('unconfirmed', 'quiet');
  for (const [value, key] of [
    [running, '%lld running'],
    [notUpdating, '%lld not updating'],
    [count('completed'), '%lld done'],
    [count('failed'), '%lld failed'],
    [count('stopped'), '%lld stopped'],
  ] as const) {
    if (value > 0) {
      shown.push(message(key, n(value)));
      spoken.push(message(key, n(value)));
    }
  }
  const opensWork = work.rows.length > 0;
  // An idle Agent's mark is its work's.
  const state: ChatStatusLineState =
    own.state !== 'idle' || !opensWork
      ? own.state
      : running > 0
        ? 'running'
        : notUpdating > 0
          ? 'unconfirmed'
          : count('failed') > 0
            ? 'failed'
            : count('completed') > 0
              ? 'completed'
              : 'stopped';
  return {
    state,
    text: { join: shown, separator: ' · ' },
    accessibilityValue: { join: spoken, separator: ', ' },
    ticks: turn !== null || work.ticks,
    opensWork,
  };
}
