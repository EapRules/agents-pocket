import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import '../chat/programs';
import type { ChatPendingRequest } from '../chat/model/types';
import { decodeAnsiScreen } from './ansi-decoder';
import { allCaptures, cutTop } from './card-outcome.testkit';
import { parseClaudeDialog } from './claude-parser';
import { parseCodexDialog } from './codex-parser';
import { genericCardExcerpt, planGenericOption } from './programs';
import { NO_REQUESTS, type RequestContext } from './request-match';
import { requestShownOnScreen, sameAcrossWraps } from './shown-request';
import type { GenericDialogExcerpt } from './types';

/** Claude Code's Bash dialog with its description above the command and dashed rules around it. */
const SCREEN = readFileSync(
  fileURLToPath(new URL('./fixtures/claude-side-panel-bash.ansi', import.meta.url)),
  'utf8',
);
const LINES = SCREEN.split('\n');
const TITLE_ROW = LINES.findIndex((line) => line.includes('Bash command'));

/** The command the dialog shows, as its recognized parse reads it. */
function fullCommand(): string {
  const result = parseClaudeDialog(decodeAnsiScreen(SCREEN));
  if (result.kind !== 'dialog' || !result.dialog.subject.command) throw new Error('no dialog');
  return result.dialog.subject.command;
}

/** The same dialog with its top rule scrolled off: the parsers cannot name it. */
function clipped(dropRows = TITLE_ROW): GenericDialogExcerpt {
  const screen = decodeAnsiScreen(LINES.slice(dropRows).join('\n'));
  const result = parseClaudeDialog(screen);
  if (result.kind !== 'unrecognized') throw new Error(`expected generic, got ${result.kind}`);
  return genericCardExcerpt(result.excerpt, screen, 'claude');
}

function request(fields: Partial<ChatPendingRequest> = {}): ChatPendingRequest {
  return {
    entryID: 'e1',
    callID: 'toolu_1',
    kind: 'command',
    toolName: 'Bash',
    summary: fullCommand(),
    detail: 'Stage and commit the review fixes',
    questions: [],
    planFilePath: null,
    ...fields,
  };
}

const only = (one: ChatPendingRequest): RequestContext => ({
  requests: [one],
  subagentRunning: false,
});

describe('a clipped dialog shown from its request', () => {
  it('shows the one waiting command, its tool and its description', () => {
    expect(requestShownOnScreen(clipped(), only(request()))).toEqual({
      toolName: 'Bash',
      command: fullCommand(),
      description: 'Stage and commit the review fixes',
    });
  });

  it('reads a line break in the command as the row it starts', () => {
    const lines = fullCommand().replace('/your/project F=', '/your/project\nF=');
    expect(requestShownOnScreen(clipped(), only(request({ summary: lines })))?.command).toBe(lines);
  });

  it('also once the title and description scrolled off, the description above the cut', () => {
    const shown = requestShownOnScreen(clipped(TITLE_ROW + 2), only(request()));
    expect(shown?.command).toBe(fullCommand());
    expect(shown?.description).toBe('Stage and commit the review fixes');
  });

  it('leaves out a description the rows above the command could show but do not', () => {
    const shown = requestShownOnScreen(clipped(), only(request({ detail: 'Something else' })));
    expect(shown?.command).toBe(fullCommand());
    expect(shown?.description).toBeNull();
  });

  it('falls back when the command differs by one character anywhere', () => {
    const command = fullCommand();
    for (const index of [0, 5, Math.floor(command.length / 2), command.length - 1]) {
      const changed = `${command.slice(0, index)}#${command.slice(index + 1)}`;
      expect(requestShownOnScreen(clipped(), only(request({ summary: changed }))), changed).toBe(
        null,
      );
    }
  });

  it('falls back for a command that is only part of what the screen shows', () => {
    const command = fullCommand();
    for (const part of [command.slice(0, -1), command.slice(1), command.split('\n')[1] ?? '']) {
      expect(requestShownOnScreen(clipped(), only(request({ summary: part })))).toBeNull();
    }
    expect(
      requestShownOnScreen(clipped(), only(request({ summary: `${command} && rm -rf x` }))),
    ).toBeNull();
  });

  it('falls back when a space the screen shows is missing from the request, or added', () => {
    const command = fullCommand();
    expect(
      requestShownOnScreen(
        clipped(),
        only(request({ summary: command.replace('git add', 'gitadd') })),
      ),
    ).toBeNull();
    expect(
      requestShownOnScreen(
        clipped(),
        only(request({ summary: command.replace('git add', 'git  add') })),
      ),
    ).toBeNull();
  });

  it('falls back once the command itself is cut off at the top', () => {
    const commandRow = LINES.findIndex((line) => line.trimStart().startsWith('│ cd /your/project'));
    expect(commandRow).toBeGreaterThan(TITLE_ROW);
    const shown = requestShownOnScreen(clipped(commandRow + 1), only(request()));
    expect(shown).toBeNull();
  });

  it('falls back unless exactly one command waits and no subagent runs', () => {
    const excerpt = clipped();
    expect(requestShownOnScreen(excerpt, NO_REQUESTS)).toBeNull();
    expect(
      requestShownOnScreen(excerpt, {
        requests: [request(), request({ callID: 'toolu_2' })],
        subagentRunning: false,
      }),
    ).toBeNull();
    expect(
      requestShownOnScreen(excerpt, { requests: [request()], subagentRunning: true }),
    ).toBeNull();
    expect(requestShownOnScreen(excerpt, only(request({ kind: 'fileEdit' })))).toBeNull();
  });

  it('falls back when the options are not a single-use approve and a decline', () => {
    const excerpt = clipped();
    const with_ = (entries: [number, string][]) => ({ ...excerpt, numbered: new Map(entries) });
    for (const numbered of [
      [],
      [[1, 'Yes']],
      [
        [1, 'Yes, and don’t ask again for git commands'],
        [2, 'No'],
      ],
      [
        [1, 'Yes'],
        [2, 'Something else'],
      ],
      [
        [1, 'Red'],
        [2, 'No'],
      ],
    ] as [number, string][][]) {
      expect(
        requestShownOnScreen(with_(numbered), only(request())),
        JSON.stringify(numbered),
      ).toBeNull();
    }
  });

  it('leaves what a press sends as it was', () => {
    const excerpt = clipped();
    expect(planGenericOption(1, excerpt, 'claude')).toEqual(
      planGenericOption(1, clipped(), 'claude'),
    );
    const planned = planGenericOption(1, excerpt, 'claude');
    expect(planned.ok && planned.plan.steps).toEqual([{ kind: 'keys', keys: ['1'] }]);
  });
});

describe('sameAcrossWraps', () => {
  it('takes a wrap that cut a word or ate one space, and a line break', () => {
    expect(sameAcrossWraps('git status', ['git sta', 'tus'])).toBe(true);
    expect(sameAcrossWraps('git status', ['git', 'status'])).toBe(true);
    expect(sameAcrossWraps('cd x\nls', ['cd x', 'ls'])).toBe(true);
  });

  it('refuses anything else', () => {
    expect(sameAcrossWraps('git status', ['git status', 'x'])).toBe(false);
    expect(sameAcrossWraps('git status x', ['git status'])).toBe(false);
    expect(sameAcrossWraps('gitstatus', ['git status'])).toBe(false);
    expect(sameAcrossWraps('cd x\nls', ['cd x ls'])).toBe(false);
  });
});

// Codex feeds the conversation's waiting command as Claude does (its projector's pending
// requests), and draws the command behind a `$ ` prompt.
describe('a Codex approval cut at its title, shown from its request', () => {
  const capture = allCaptures().find((candidate) => candidate.id === 'codex-01-x1-exec');
  if (!capture) throw new Error('no codex-01-x1-exec');
  const screen = cutTop(capture.screen, 27);
  const result = parseCodexDialog(screen);
  if (result.kind !== 'unrecognized') throw new Error(`expected generic, got ${result.kind}`);
  const excerpt = genericCardExcerpt(result.excerpt, screen, 'codex');
  const codex = (summary: string) =>
    only(request({ toolName: 'exec_command', summary, detail: null, callID: 'call_1' }));

  it('shows the one waiting command behind the prompt', () => {
    expect(requestShownOnScreen(excerpt, codex('touch x1.txt'))).toEqual({
      toolName: 'exec_command',
      command: 'touch x1.txt',
      description: null,
    });
  });

  it('stays raw for another command or a part of it', () => {
    expect(requestShownOnScreen(excerpt, codex('touch x2.txt'))).toBeNull();
    expect(requestShownOnScreen(excerpt, codex('x1.txt'))).toBeNull();
  });
});
