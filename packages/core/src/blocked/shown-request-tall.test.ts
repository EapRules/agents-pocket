import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import '../chat/programs';
import type { ChatPendingRequest } from '../chat/model/types';
import { decodeAnsiScreen } from './ansi-decoder';
import { parseClaudeDialog } from './claude-parser';
import { genericCardExcerpt, planGenericOption } from './programs';
import type { RequestContext } from './request-match';
import { MIN_CUT_ROWS, requestShownOnScreen } from './shown-request';
import type { GenericDialogExcerpt } from './types';

/**
 * Claude Code's Bash dialog for a 39-line command, taller than the terminal, as `herdr pane read`
 * returned it on 2026-11-14 (the option rows given Claude Code's colors, which the plain read
 * drops): its top rule is off screen and the command runs from row 5 to row 43.
 */
const SCREEN = readFileSync(
  fileURLToPath(new URL('./fixtures/claude-tall-bash.ansi', import.meta.url)),
  'utf8',
);
const LINES = SCREEN.split('\n');
const FIRST_COMMAND_ROW = 4;
const LAST_COMMAND_ROW = 42;
/** Rows 2 and 28 end in notices Claude Code draws at the right edge, over the dialog. */
const NOTICE = /\s+(?:✕|No changes this session)$/;
/** The command as the screen shows it: Claude Code leaves out the `cd` the request starts with. */
const SHOWN = LINES.slice(FIRST_COMMAND_ROW, LAST_COMMAND_ROW + 1)
  .map((line) => line.replace(NOTICE, '').replace(/^ │ /, '').trimEnd())
  .join('\n');
const PROJECT = 'cd /workspace/storefront && ';
const DESCRIPTION =
  'Run a long harmless command that ends in a push with nothing to send, to show the tall permission prompt';

/** The excerpt the card reads: the parser keeps the 12 rows above the options, the command cut. */
function cut(): GenericDialogExcerpt {
  const screen = decodeAnsiScreen(SCREEN);
  const result = parseClaudeDialog(screen);
  if (result.kind !== 'unrecognized') throw new Error(`expected generic, got ${result.kind}`);
  return genericCardExcerpt(result.excerpt, screen, 'claude');
}

/** `cut()` with other rows, written as the terminal shows them. */
function withRows(lines: readonly string[]): GenericDialogExcerpt {
  return { ...cut(), rows: decodeAnsiScreen(lines.join('\n')).rows };
}

/** The tail of the screen from row `from` (zero-based), through the footer. */
const from = (row: number) => LINES.slice(row, 53);

/** Every row of the screen, the right-edge notices on rows 2 and 28 cleared when `clean`. */
function whole(clean: boolean): GenericDialogExcerpt {
  const lines = LINES.slice(0, 54).map((line) => (clean ? line.replace(NOTICE, '') : line));
  return withRows(lines);
}

function request(summary = PROJECT + SHOWN, detail = DESCRIPTION): ChatPendingRequest {
  return {
    entryID: 'e1',
    callID: 'toolu_1',
    kind: 'command',
    toolName: 'Bash',
    summary,
    detail,
    questions: [],
    planFilePath: null,
  };
}

const only = (one: ChatPendingRequest = request()): RequestContext => ({
  requests: [one],
  subagentRunning: false,
});

describe('a tall command cut by the top of the screen', () => {
  it('reads as the excerpt the card got on the phone: the command cut at its top', () => {
    const excerpt = cut();
    expect(excerpt.rows[0]?.text.trim()).toBe('│ }');
    expect([...excerpt.numbered]).toEqual([
      [1, 'Yes'],
      [2, 'No'],
    ]);
  });

  it('shows the whole request from the conversation, its cd and its description', () => {
    expect(requestShownOnScreen(cut(), only())).toEqual({
      toolName: 'Bash',
      command: PROJECT + SHOWN,
      description: DESCRIPTION,
    });
  });

  it(`takes a cut from ${MIN_CUT_ROWS} rows on, at a line start, and stays raw below`, () => {
    const lastRow = LAST_COMMAND_ROW;
    expect(requestShownOnScreen(withRows(from(lastRow - MIN_CUT_ROWS + 1)), only())).not.toBeNull();
    expect(requestShownOnScreen(withRows(from(lastRow - MIN_CUT_ROWS + 2)), only())).toBeNull();
    expect(requestShownOnScreen(withRows(from(lastRow)), only())).toBeNull();
  });

  it('takes a cut at a wrap point after a space, and not one inside a word', () => {
    const line = 'python3 - <<EOF\nprint("a long line that wraps here and goes on")\nEOF\nls -la';
    const screen = (first: string) => withRows([` │ ${first}`, ' │ EOF', ' │ ls -la', ...from(43)]);
    const context = only(request(line));
    expect(requestShownOnScreen(screen('here and goes on")'), context)).not.toBeNull();
    expect(requestShownOnScreen(screen('ere and goes on")'), context)).toBeNull();
  });

  it('stays raw unless the cut runs through the command’s last character', () => {
    expect(requestShownOnScreen(cut(), only(request(`${PROJECT}${SHOWN}\necho done`)))).toBeNull();
    expect(requestShownOnScreen(cut(), only(request(PROJECT + SHOWN.slice(0, -1))))).toBeNull();
    const changed = SHOWN.replace('sorted(checks)', 'sorted(check)');
    expect(requestShownOnScreen(cut(), only(request(PROJECT + changed)))).toBeNull();
  });

  it('stays raw for a block the top did not cut: it must read as the whole command', () => {
    const rule = LINES[LAST_COMMAND_ROW + 1] ?? '';
    expect(requestShownOnScreen(withRows([rule, ...from(37)]), only())).toBeNull();
    expect(requestShownOnScreen(withRows(['', ...from(37)]), only())).toBeNull();
  });

  it('keeps every other condition', () => {
    const excerpt = cut();
    expect(requestShownOnScreen(excerpt, { requests: [request()], subagentRunning: true })).toBe(
      null,
    );
    expect(
      requestShownOnScreen(excerpt, {
        requests: [request(), { ...request(), callID: 'toolu_2' }],
        subagentRunning: false,
      }),
    ).toBeNull();
    expect(requestShownOnScreen(excerpt, only({ ...request(), kind: 'fileEdit' }))).toBeNull();
    const unknown = { ...excerpt, numbered: new Map([...excerpt.numbered, [3, 'Something']]) };
    expect(requestShownOnScreen(unknown, only())).toBeNull();
  });

  it('leaves what a press sends as it was', () => {
    const planned = planGenericOption(1, cut(), 'claude');
    expect(planned.ok && planned.plan.steps).toEqual([{ kind: 'keys', keys: ['1'] }]);
  });
});

describe('the whole tall dialog as one excerpt', () => {
  it('shows the command as the screen does, without the cd, and the description it shows', () => {
    expect(requestShownOnScreen(whole(true), only())).toEqual({
      toolName: 'Bash',
      command: SHOWN,
      description: DESCRIPTION,
    });
    expect(requestShownOnScreen(whole(true), only(request(SHOWN)))?.command).toBe(SHOWN);
  });

  it('stays raw while a notice shares a row of the command', () => {
    expect(requestShownOnScreen(whole(false), only())).toBeNull();
  });

  it('skips only a leading `cd <one path> && `', () => {
    for (const head of [
      'cd /workspace/storefront; ',
      'cd /workspace/storefront &&  ',
      'cd /workspace /storefront && ',
      'pushd /workspace/storefront && ',
      'FOO=1 cd /workspace/storefront && ',
      'cd $(pwd) && ',
      `${PROJECT}${PROJECT}`,
    ]) {
      expect(requestShownOnScreen(whole(true), only(request(head + SHOWN))), head).toBeNull();
    }
    for (const head of ["cd '/workspace/my store' && ", 'cd "/workspace/my store" && ']) {
      expect(requestShownOnScreen(whole(true), only(request(head + SHOWN)))?.command).toBe(SHOWN);
    }
  });
});
