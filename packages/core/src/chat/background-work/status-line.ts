// The running turn and the line over Chat's Composer. The turn shows as the live line that ends
// the transcript: how long it has worked and what the Agent is doing as its records show it. The
// line over the Composer holds only what is not the turn itself: that it needs the user, and how
// much Background Work runs, with what finished folded into counts. Built from the projected rows
// and the Background Work presentation, so it reads the same for every program: a program that
// records no reasoning or running calls shows only the time.

import { message, type Text } from '../../errors/text';
import { formatDuration } from '../../format/duration';
import {
  type ChatLiveTurn,
  type ChatRow,
  type ChatTurnDoing,
  chatRow,
  hashRevision,
  rowID,
  topSpacing,
} from '../timeline/row';
import { toolLine } from '../timeline/tool-line';
import type { BackgroundWorkPresentation, BackgroundWorkStatus } from './presentation';

export type { ChatLiveTurn, ChatTurnDoing } from '../timeline/row';

export type ChatStatusLineState = BackgroundWorkStatus | 'waiting';

export interface ChatStatusLine {
  state: ChatStatusLineState;
  text: Text;
  accessibilityValue: Text;
  /** The line holds a moving time. */
  ticks: boolean;
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

/** The transcript's rows without the running turn's header. */
export const withoutLiveTurn = (rows: readonly ChatRow[]): ChatRow[] =>
  rows.filter((row) => row.id !== rowID.liveTurn);

/**
 * The transcript's rows with the running turn as its last row, the live line, in place of the
 * header that opens it; the rows unchanged but for the header when no turn runs.
 */
export function withLiveLine(rows: readonly ChatRow[]): ChatRow[] {
  const turn = liveTurnOf(rows);
  const shown = withoutLiveTurn(rows);
  if (turn === null) return shown;
  const content = { type: 'working' as const, turn };
  const title = turn.doing?.kind === 'tool' ? turn.doing.title : '';
  const revision = hashRevision(turn.since, turn.doing?.kind ?? '', title);
  const previous = shown.at(-1)?.content ?? null;
  shown.push(chatRow(rowID.working, content, revision, topSpacing(content, previous)));
  return shown;
}

/** What the live line says the Agent does, null when its records say nothing. */
export function doingText(doing: ChatTurnDoing | null): Text | null {
  if (doing?.kind === 'waiting') return message('Needs you');
  if (doing?.kind === 'thinking') return message('Thinking');
  if (doing?.kind === 'tool') return doing.title;
  return null;
}

export interface ChatLiveLine {
  text: Text;
  accessibilityLabel: Text;
  /** The turn waits on the user: the line wears the needs-you look, not the working one. */
  waiting: boolean;
}

/**
 * The live line: "Working… 1m 56s · pnpm test", or "Waiting for you… 1m 56s" while the turn waits
 * on the user (a request in its records, or `isBlocked`: herdr reports the Agent Blocked).
 */
export function liveLine(turn: ChatLiveTurn, now: number, isBlocked = false): ChatLiveLine {
  const seconds = Math.max(0, (now - Date.parse(turn.since)) / 1000);
  const waiting = isBlocked || turn.doing?.kind === 'waiting';
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
  return {
    text: { join: shown, separator: ' · ' },
    accessibilityLabel: { join: spoken, separator: ', ' },
    waiting,
  };
}

export function sameLiveTurn(a: ChatLiveTurn | null, b: ChatLiveTurn | null): boolean {
  if (a === null || b === null) return a === b;
  const title = (turn: ChatLiveTurn) => (turn.doing?.kind === 'tool' ? turn.doing.title : null);
  return a.since === b.since && a.doing?.kind === b.doing?.kind && title(a) === title(b);
}

export interface ChatStatusLineOptions {
  /** herdr reports the Agent Blocked: it waits on the user. */
  isBlocked: boolean;
}

const n = (value: number) => String(value);

/**
 * The line over the Composer: what is not the turn itself (the live line at the transcript's end
 * shows that). It says the running turn needs the user, and counts the Background Work the sheet
 * lists (`backgroundSheetOf`: every kind, notices folded in), so it never promises a row the sheet
 * lacks. Null with none of it.
 */
export function chatStatusLine(
  turn: ChatLiveTurn | null,
  work: BackgroundWorkPresentation,
  { isBlocked }: ChatStatusLineOptions,
): ChatStatusLine | null {
  // Waiting on the user belongs to a running turn.
  const waiting = turn !== null && (isBlocked || turn.doing?.kind === 'waiting');
  if (!waiting && work.rows.length === 0) return null;
  const shown: Text[] = [];
  const spoken: Text[] = [];
  const both = (text: Text) => {
    shown.push(text);
    spoken.push(text);
  };
  if (waiting) both(message('Needs you'));
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
    if (value > 0) both(message(key, n(value)));
  }
  const failed = count('failed') > 0;
  const state: ChatStatusLineState = waiting
    ? 'waiting'
    : running > 0
      ? 'running'
      : notUpdating > 0
        ? 'unconfirmed'
        : failed
          ? 'failed'
          : count('completed') > 0
            ? 'completed'
            : 'stopped';
  return {
    state,
    text: { join: shown, separator: ' · ' },
    accessibilityValue: { join: spoken, separator: ', ' },
    ticks: work.ticks,
  };
}
