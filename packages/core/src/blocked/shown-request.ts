// A dialog the parsers could not name (its top scrolled off the terminal, say) still shows the
// command it asks about. When the conversation waits on exactly one command and the screen shows
// that command whole, as its own block of rows, above permission answers, the generic card can
// present the request's tool, command and description instead of the raw rows. Presentation only:
// the card still presses the screen's numbered options, read again before each press.

import { genericAnswerRole } from './answer-layout';
import type { CardContent } from './card-support';
import { comparable } from './comparable';
import type { RequestContext } from './request-match';
import type { GenericDialogExcerpt } from './types';

/** What the generic card shows in place of the raw excerpt. */
export interface ShownRequest {
  readonly toolName: string;
  /** The request's command, exactly as the screen shows it (wrapping and gutters aside). */
  readonly command: string;
  /** The request's description, only when the screen shows it too. */
  readonly description: string | null;
}

/**
 * The one pending request the excerpt shows, or null unless every check holds: no subagent runs
 * (its requests are not this conversation's), exactly one request waits and it is a command, the
 * excerpt's numbered options are a permission's (a single-use approve and a decline among them,
 * nothing but yes/no answers), and one block of rows reads as the command, whole.
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
  if (!blocksOf(texts).some((block) => sameAcrossWraps(command, block))) return null;
  const detail = request.detail?.trim() ?? '';
  const screen = comparable(texts.join(''));
  const description = detail !== '' && screen.includes(comparable(detail)) ? detail : null;
  return { toolName: request.toolName, command, description };
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

/** A gutter or rule glyph: box drawing and block elements. */
const GLYPH = '[\\u2500-\\u259F]';
const SEPARATOR = new RegExp(`^[\\s${GLYPH.slice(1, -1)}_=-]*$`);
const LEADING = new RegExp(`^\\s*(?:${GLYPH} ?)?`);
const TRAILING = new RegExp(`\\s*(?:${GLYPH}\\s*)?$`);

/** Runs of rows between blank or rule rows, each row without its gutter and edge spaces. */
function blocksOf(texts: readonly string[]): string[][] {
  const blocks: string[][] = [];
  let current: string[] = [];
  for (const text of texts) {
    if (SEPARATOR.test(text)) {
      if (current.length > 0) blocks.push(current);
      current = [];
    } else {
      current.push(text.replace(LEADING, '').replace(TRAILING, ''));
    }
  }
  if (current.length > 0) blocks.push(current);
  return blocks;
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
