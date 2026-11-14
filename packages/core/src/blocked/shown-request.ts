// A dialog the parsers could not name (its top scrolled off the terminal, say) still shows the
// command it asks about. When the conversation waits on exactly one command and the screen shows
// that command as its own block of rows above permission answers, the generic card can present
// the request's tool, command and description instead of the raw rows. The block reads as the
// command whole, or whole but for a leading `cd <path> && ` the program hides (Claude Code shows a
// command run in its project without it), behind the `$ ` prompt Codex and OpenCode draw before a
// command, or, when the top of the screen cut the block, as the command's last rows. Presentation only: the card still presses the screen's numbered options,
// read again before each press.

import { genericAnswerRole } from './answer-layout';
import type { CardContent } from './card-support';
import { comparable } from './comparable';
import { blocksOf, SEPARATOR } from './excerpt-rows';
import type { RequestContext } from './request-match';
import type { GenericDialogExcerpt } from './types';

/** What the generic card shows in place of the raw excerpt. */
export interface ShownRequest {
  readonly toolName: string;
  /**
   * The request's command, from the conversation. Wrapping and gutters aside, the screen shows
   * every character of it; or every character but a leading `cd <path> && `, and then the prefix
   * is left out here too, as a dialog that fits shows it; or, in a block the top of the screen
   * cut, at least its last `MIN_CUT_ROWS` rows through its last character, and then this is the
   * request's whole command, its head unseen on screen and any `cd` prefix kept.
   */
  readonly command: string;
  /**
   * The request's description when the screen shows it too, or when it cannot: Claude Code draws
   * the description above the command, and the excerpt holds nothing above the command's block.
   */
  readonly description: string | null;
}

/**
 * The fewest rows a block cut by the top of the screen needs to read as the request's command.
 * One or two rows are often just a heredoc's `EOF`, a `fi` or the last piece of one wrapped line,
 * endings many commands share; three rows that match through the last character, every line break
 * and space in place, are evidence, on top of the one waiting request and the permission answers.
 */
export const MIN_CUT_ROWS = 3;

/** A leading `cd` to one path, the prefix Claude Code leaves out of a command run there. */
const HIDDEN_CD = /^cd (?:'[^'\n]*'|"[^"\n]*"|[^\s'"`$&|;<>()\\]+) && (?=\S)/;

/** The shell prompt a program draws before the command it asks to run (Codex `$ touch x1.txt`). */
const PROMPT = /^\$ (?=\S)/;

/** `block` without the prompt on its first row, or the block itself when it has none. */
const withoutPrompt = (block: readonly string[]): readonly string[] => {
  const [first, ...rest] = block;
  return first !== undefined && PROMPT.test(first) ? [first.replace(PROMPT, ''), ...rest] : block;
};

/**
 * The one pending request the excerpt shows, or null unless every check holds: no subagent runs
 * (its requests are not this conversation's), exactly one request waits and it is a command, the
 * excerpt's numbered options are a permission's (a single-use approve and a decline among them,
 * nothing but yes/no answers), and one block of rows reads as the command (`commandOnScreen`).
 */
export function requestShownOnScreen(
  excerpt: GenericDialogExcerpt,
  context: RequestContext,
): ShownRequest | null {
  if (context.subagentRunning || context.requests.length !== 1) return null;
  const [request] = context.requests;
  if (!request || request.kind !== 'command') return null;
  const command = request.summary.replaceAll('\r\n', '\n').trim();
  if (command === '' || !permissionAnswers(excerpt)) return null;
  const texts = excerpt.rows.map((row) => row.text);
  const cutAtTop = texts.length > 0 && !SEPARATOR.test(texts[0] ?? '');
  const blocks = blocksOf(texts);
  const found = commandOnScreen(command, blocks, cutAtTop);
  if (!found) return null;
  const detail = request.detail?.trim() ?? '';
  // Without gutters: Claude Code draws a long description with the command's `│ ` gutter.
  const screen = comparable(blocks.flat().join(''));
  const visible = found.block === 0 || screen.includes(comparable(detail));
  const description = detail !== '' && visible ? detail : null;
  return { toolName: request.toolName, command: found.command, description };
}

/**
 * Which block shows `command`, and the command the card presents for it. Any block may read as the
 * command whole, or whole without a leading `cd <one path> && `, behind a `$ ` prompt or not
 * (nothing else is skipped). Only the first block, and only when the top of the screen cut it
 * (`cutAtTop`: it starts at the excerpt's first row), may read as a tail: from the start of a
 * command line or a wrap point (after a space the wrap took; a word cut in two stays raw) through
 * the command's last character, in at least `MIN_CUT_ROWS` rows.
 */
function commandOnScreen(
  command: string,
  blocks: readonly (readonly string[])[],
  cutAtTop: boolean,
): { readonly block: number; readonly command: string } | null {
  const bare = command.replace(HIDDEN_CD, '');
  for (const [index, rows] of blocks.entries()) {
    for (const block of new Set([rows, withoutPrompt(rows)])) {
      if (sameAcrossWraps(command, block)) return { block: index, command };
      if (bare !== command && sameAcrossWraps(bare, block)) return { block: index, command: bare };
    }
  }
  const [first] = blocks;
  if (!cutAtTop || !first || first.length < MIN_CUT_ROWS) return null;
  for (let start = 1; start < command.length; start += 1) {
    const before = command[start - 1];
    if (before !== '\n' && before !== ' ') continue;
    if (sameAcrossWraps(command.slice(start), first)) return { block: 0, command };
  }
  return null;
}

/**
 * `content` with its shown request read again against `context`: a generic card drawn from a
 * request follows the requests at once. A generic card from a stopped answer (no `shown`) stays raw.
 */
export function withShownRequest(content: CardContent, context: RequestContext): CardContent {
  if (content.kind !== 'generic' || content.shown === undefined) return content;
  return { ...content, shown: requestShownOnScreen(content.excerpt, context) };
}

function permissionAnswers(excerpt: GenericDialogExcerpt): boolean {
  const roles = [...excerpt.numbered.values()].map(genericAnswerRole);
  return (
    roles.length >= 2 &&
    roles.every((role) => role !== null) &&
    roles.includes('approve') &&
    roles.includes('decline')
  );
}

/**
 * Whether `lines` (one wrapped block) read exactly as `command`. Between two lines the command may
 * have a line break, the one space the wrap took, or nothing (a word cut in two); everywhere else
 * every character must be the same, spaces included.
 */
export function sameAcrossWraps(command: string, lines: readonly string[]): boolean {
  const BREAK = '\u0000';
  const screen = lines.join(BREAK);
  let at = 0;
  for (let index = 0; index < command.length; index += 1) {
    const character = command[index];
    if (screen[at] === BREAK) {
      at += 1;
      if (character === ' ' || character === '\n') continue;
    }
    if (screen[at] !== character) return false;
    at += 1;
  }
  return at === screen.length;
}
