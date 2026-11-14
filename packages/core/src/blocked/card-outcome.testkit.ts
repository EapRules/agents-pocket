/**
 * Test support: what the Blocked card shows for a screen, read the way `BlockedCardStore` reads it,
 * for every screen capture in the repo and for size variants derived from them. Node only.
 */
import '../chat/programs';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { ChatProgram } from '../chat/model/types';
import { decodeAnsiScreen } from './ansi-decoder';
import { blockedSupportFor, genericCardExcerpt, parseBlockedDialog } from './programs';
import type { RequestContext } from './request-match';
import { type AnsiScreen, makeRow, makeScreen, type ScreenRow } from './screen';
import { requestShownOnScreen } from './shown-request';

const GOLDENS = fileURLToPath(new URL('../../goldens/', import.meta.url));
const FIXTURES = fileURLToPath(new URL('./fixtures/', import.meta.url));

const PROGRAMS = ['claude', 'codex', 'pi', 'omp', 'grok', 'opencode'] as const;
type CaptureProgram = (typeof PROGRAMS)[number];

/** One screen capture: a Swift golden's input, an agent-lab capture or a core fixture. */
export interface Capture {
  /** The golden stem (`codex-15-x6-mcp-tool-list`), `lab/<program>/<name>` or `fixtures/<name>`. */
  readonly id: string;
  readonly program: CaptureProgram;
  readonly screen: AnsiScreen;
}

const ansiIn = (directory: string) =>
  readdirSync(directory)
    .filter((file) => file.endsWith('.ansi'))
    .sort()
    .map((file) => ({
      name: file.slice(0, -'.ansi'.length),
      screen: decodeAnsiScreen(readFileSync(`${directory}${file}`, 'utf8')),
    }));

const programOf = (name: string): CaptureProgram => {
  const program = PROGRAMS.find((candidate) => name.startsWith(`${candidate}-`));
  if (!program) throw new Error(`No program prefix in ${name}`);
  return program;
};

/** Every screen capture: goldens/<program>/screens, goldens/<program>/lab and blocked/fixtures. */
export function allCaptures(): Capture[] {
  const captures: Capture[] = [];
  for (const program of PROGRAMS) {
    for (const { name, screen } of ansiIn(`${GOLDENS}${program}/screens/`)) {
      captures.push({ id: name, program, screen });
    }
    const lab = `${GOLDENS}${program}/lab/`;
    if (!readdirSync(`${GOLDENS}${program}`).includes('lab')) continue;
    for (const { name, screen } of ansiIn(lab)) {
      captures.push({ id: `lab/${program}/${name}`, program, screen });
    }
  }
  for (const { name, screen } of ansiIn(FIXTURES)) {
    captures.push({ id: `fixtures/${name}`, program: programOf(name), screen });
  }
  return captures;
}

/**
 * `screen` as a shorter terminal shows it when the dialog is taller than the terminal: the rows
 * from `keepFrom` on, renumbered from 0, so whatever was above (the dialog's top) is off screen.
 */
export function cutTop(screen: AnsiScreen, keepFrom: number): AnsiScreen {
  if (keepFrom <= 0 || keepFrom >= screen.rows.length) {
    throw new Error(`cutTop: ${keepFrom} is outside the screen's ${screen.rows.length} rows`);
  }
  return makeScreen(screen.rows.slice(keepFrom).map((row, index) => makeRow(index, row.runs)));
}

/**
 * What the card shows, by the store's rules (`card-store.ts` `contentFor`, `noDialogContent`):
 * - `named`: a parser named the dialog, the card of its kind;
 * - `shown`: the generic card presenting the waiting request (`requestShownOnScreen`);
 * - `generic`: the generic card, the excerpt's rows verbatim and the reason;
 * - `unreadable`: no parser saw a dialog, so a Blocked Agent gets the key pad card ("Keys");
 * - `none`: no dialog, no card.
 * `unreadable` and `none` are the same parse (`NO_DIALOG`); the caller tells them apart by
 * whether the screen holds a dialog.
 */
export type CardOutcome = 'named' | 'shown' | 'generic' | 'unreadable' | 'none';

/** The generic card's buttons: digits it presses (`planGenericOption`), or none at all. */
export type GenericAnswers = 'digits' | 'none';

export interface CardReading {
  readonly outcome: CardOutcome;
  /** For `shown` and `generic`; null otherwise. */
  readonly answers: GenericAnswers | null;
}

export function readCard(
  screen: AnsiScreen,
  program: ChatProgram,
  context: RequestContext,
  holdsDialog: boolean,
): CardReading {
  const result = parseBlockedDialog(screen, program);
  if (result.kind === 'dialog') return { outcome: 'named', answers: null };
  if (result.kind === 'none') {
    return { outcome: holdsDialog ? 'unreadable' : 'none', answers: null };
  }
  const excerpt = genericCardExcerpt(result.excerpt, screen, program);
  const presses = excerpt.numbered.size > 0 && blockedSupportFor(program)?.genericOptions;
  const answers: GenericAnswers = presses ? 'digits' : 'none';
  const shown = requestShownOnScreen(excerpt, context);
  return { outcome: shown ? 'shown' : 'generic', answers };
}

/**
 * Signs that the bottom of a screen holds a prompt waiting on the user: answer rows (`1. Yes`,
 * `3 (●) Yes, proceed`), a permission's words, or a numbered list from 1. A heuristic, so it
 * may miss a prompt (Oh My Pi's unnumbered asks); it exists to catch a `NO_DIALOG` read of a
 * screen that does hold one. None of today's captures that read as no dialog shows any sign.
 */
const SIGNS = [
  /^[\s│┃❯›>]*(?:\d+[.)]?\s+)?(?:\([○●]\)\s+)?(?:Yes|No)\b/,
  /\b(?:Allow once|Always allow|Allow tool:|Permission required|Do you want to|Would you like to)\b/,
  /\bapprove\b.*\bdeny\b/i,
  /\b(?:Type something|Type your own answer|Chat about this|Esc to cancel|esc to cancel)\b/,
];
const NUMBERED = /^[\s│┃❯›>]*(\d+)[.)]\s/;
const BOTTOM_ROWS = 14;

export function looksLikeDialog(screen: AnsiScreen): boolean {
  const bottom = screen.rows.filter((row: ScreenRow) => row.text.trim() !== '').slice(-BOTTOM_ROWS);
  if (bottom.some((row) => SIGNS.some((sign) => sign.test(row.text)))) return true;
  const numbers = new Set(bottom.map((row) => NUMBERED.exec(row.text)?.[1]));
  return numbers.has('1') && numbers.has('2');
}
