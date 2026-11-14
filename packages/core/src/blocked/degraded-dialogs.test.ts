// Every fall to a degraded card is a recorded decision: each screen capture reads as a named
// dialog, as no dialog, or as one of the known degraded dialogs listed with its reason in
// degraded-dialogs.testkit.ts, whose header holds them as a table.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { ChatPendingRequest } from '../chat/model/types';
import { allCaptures, cutTop, looksLikeDialog, readCard } from './card-outcome.testkit';
import { CUT_VARIANTS, degradedTable, KNOWN_DEGRADED } from './degraded-dialogs.testkit';
import { NO_REQUESTS, type RequestContext } from './request-match';

const captures = allCaptures();
const known = new Map(KNOWN_DEGRADED.map((entry) => [entry.id, entry]));

describe('degraded dialogs', () => {
  it('reads every capture in the repo', () => {
    expect(captures.length).toBeGreaterThan(200);
  });

  it('lists each known degraded capture once, and only captures that exist', () => {
    expect(known.size).toBe(KNOWN_DEGRADED.length);
    const ids = new Set(captures.map((capture) => capture.id));
    expect(KNOWN_DEGRADED.map((entry) => entry.id).filter((id) => !ids.has(id))).toEqual([]);
  });

  describe.each(captures.map((capture) => [capture.id, capture] as const))('%s', (id, capture) => {
    it('is a named dialog, no dialog, or a listed degraded one', () => {
      const reading = readCard(
        capture.screen,
        capture.program,
        NO_REQUESTS,
        looksLikeDialog(capture.screen),
      );
      const entry = known.get(id);
      const degraded = reading.outcome !== 'named' && reading.outcome !== 'none';
      if (!degraded) {
        expect(entry, 'it reads as a card now: take it off KNOWN_DEGRADED').toBeUndefined();
        return;
      }
      expect(
        entry && { outcome: entry.outcome, answers: entry.answers },
        'it degrades: list it in KNOWN_DEGRADED with why, or teach a reader',
      ).toEqual(reading);
    });
  });
});

const command = (summary: string): ChatPendingRequest => ({
  entryID: 'e1',
  callID: 'call_1',
  kind: 'command',
  toolName: 'Bash',
  summary,
  detail: null,
  questions: [],
  planFilePath: null,
});

describe('approval dialogs cut at the top by a short terminal', () => {
  const byId = new Map(captures.map((capture) => [capture.id, capture]));

  it('cover every program with an approval card', () => {
    const programs = new Set(CUT_VARIANTS.map((entry) => byId.get(entry.fixture)?.program));
    expect([...programs].sort()).toEqual(['claude', 'codex', 'grok', 'omp', 'opencode']);
  });

  it.each(CUT_VARIANTS.map((entry) => [entry.fixture, entry.cut, entry] as const))(
    '%s with its %s off screen reads as recorded',
    (_fixture, _cut, entry) => {
      const capture = byId.get(entry.fixture);
      if (!capture) throw new Error(`No capture ${entry.fixture}`);
      // The full capture is a named dialog: the cut alone makes the difference.
      expect(readCard(capture.screen, capture.program, NO_REQUESTS, true).outcome).toBe('named');
      const context: RequestContext = entry.command
        ? { requests: [command(entry.command)], subagentRunning: false }
        : NO_REQUESTS;
      const screen = cutTop(capture.screen, entry.keepFrom);
      expect(readCard(screen, capture.program, context, true)).toEqual({
        outcome: entry.outcome,
        answers: entry.answers,
      });
    },
  );
});

const TABLE_FILE = fileURLToPath(new URL('./degraded-dialogs.testkit.ts', import.meta.url));
const TABLE = /( \* <degraded-table>\n)[\s\S]*?( \* <\/degraded-table>)/;

describe('the degraded table', () => {
  it('in the list header matches the list', () => {
    const source = readFileSync(TABLE_FILE, 'utf8');
    const body = degradedTable()
      .map((line) => ` *${line === '' ? '' : ` ${line}`}\n`)
      .join('');
    const expected = source.replace(TABLE, (_all, open, close) => `${open}${body}${close}`);
    if (process.env.UPDATE_DEGRADED_TABLE === '1') writeFileSync(TABLE_FILE, expected);
    else expect(source, 'rerun with UPDATE_DEGRADED_TABLE=1').toBe(expected);
  });
});
