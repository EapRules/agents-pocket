// The rows of a dialog no parser names, read the same way for every program: without the gutters
// and rules that frame them (`cleanRow`, `SEPARATOR`), in blocks between blank or rule rows
// (`blocksOf`), and as the generic card shows them (`excerptReading`). Presentation only: words are
// never reordered or rewritten, only decoration and the rows the card draws as buttons dropped.

import type { GenericDialogExcerpt } from './types';

/** A gutter or rule glyph: box drawing and block elements. */
const GLYPHS = '\\u2500-\\u259F';

/** A blank row or a rule: only spaces, glyphs, `_`, `=` and `-`. */
export const SEPARATOR = new RegExp(`^[\\s${GLYPHS}_=-]*$`);

const GUTTER = new RegExp(`^\\s*[${GLYPHS}]+ ?`);
const LEADING = new RegExp(`^\\s*(?:[${GLYPHS}]+ ?)?`);
const TRAILING = new RegExp(`\\s*(?:[${GLYPHS}]+\\s*)?$`);

/**
 * A row without its gutter or frame and the spaces at its edges; behind a gutter, indentation past
 * the one space after it stays.
 */
export const cleanRow = (text: string): string => text.replace(LEADING, '').replace(TRAILING, '');

const RULE_HEAD = new RegExp(`^\\s*[${GLYPHS}]{2}`);

/** A row for the rows shown together: flush for a rule that heads a label (`╭─ Plan Review ──╮`). */
interface ShownRow {
  readonly text: string;
  readonly flush: boolean;
}

/** A one-glyph gutter turns to blanks, so every row keeps its column; a rule heading goes whole. */
function shownRow(text: string): ShownRow {
  if (RULE_HEAD.test(text)) return { text: cleanRow(text), flush: true };
  const blanked = text.replace(GUTTER, (gutter) => ' '.repeat(gutter.length));
  return { text: blanked.replace(TRAILING, ''), flush: false };
}

/** Runs of rows between blank or rule rows, each row cleaned (`cleanRow`). */
export function blocksOf(texts: readonly string[]): string[][] {
  const blocks: string[][] = [];
  let current: string[] = [];
  for (const text of texts) {
    if (SEPARATOR.test(text)) {
      if (current.length > 0) blocks.push(current);
      current = [];
    } else {
      current.push(cleanRow(text));
    }
  }
  if (current.length > 0) blocks.push(current);
  return blocks;
}

/** What the generic card shows of an excerpt. */
export interface ExcerptReading {
  /**
   * The dialog's own question, for the card's title: the one row directly above the numbered
   * options (blank rows between) when it ends in `?` and a blank or rule row sits above it, so the
   * row is the whole question. Null otherwise.
   */
  readonly question: string | null;
  /**
   * The rows without gutters, frames and rules, blank runs as one blank row and the common
   * indentation removed. When the excerpt has numbered options the card draws every one as a
   * button, so their rows (a numbered row and the deeper rows that continue it) are left out.
   */
  readonly body: readonly string[];
}

/** `3. Label` or `❯ 1. Label`, behind any gutter: the number's column, the number and the label. */
const OPTION_ROW = new RegExp(
  `^(\\s*(?:[${GLYPHS}]\\s*)?(?:[›❯>]\\s+)?)(\\d{1,2})[.)]\\s+(\\S.*)$`,
);
const INDENT = new RegExp(`^[\\s${GLYPHS}]*`);

export function excerptReading(excerpt: GenericDialogExcerpt): ExcerptReading {
  const texts = excerpt.rows.map((row) => row.text);
  const owned = optionRows(texts, excerpt.numbered);
  const first = owned.indexOf(true);
  let question: string | null = null;
  if (first >= 0) {
    let above = first - 1;
    while (above >= 0 && SEPARATOR.test(texts[above] ?? '')) above -= 1;
    const row = cleanRow(texts[above] ?? '');
    if (above > 0 && SEPARATOR.test(texts[above - 1] ?? '') && row.endsWith('?')) question = row;
  }
  const lines: ShownRow[] = [];
  for (const [index, text] of texts.entries()) {
    if (owned[index]) continue;
    const line = SEPARATOR.test(text) ? { text: '', flush: true } : shownRow(text);
    if (line.text === '' && (lines.length === 0 || lines.at(-1)?.text === '')) continue;
    lines.push(line);
  }
  if (lines.at(-1)?.text === '') lines.pop();
  const indents = lines
    .filter((line) => !line.flush && line.text !== '')
    .map((line) => /^ */.exec(line.text)?.[0].length ?? 0);
  const indent = indents.length > 0 ? Math.min(...indents) : 0;
  return {
    question,
    body: lines.map((line) => (line.flush ? line.text : line.text.slice(indent))),
  };
}

/**
 * Which rows draw a numbered option: its own row, whose label starts as the excerpt's does, the
 * rows right under it indented deeper than its number (a wrapped label, a detail column), and
 * blank rows between two such rows. Nothing when the excerpt has no numbered options.
 */
function optionRows(texts: readonly string[], numbered: ReadonlyMap<number, string>): boolean[] {
  const owned = texts.map(() => false);
  if (numbered.size === 0) return owned;
  let column: number | null = null;
  for (const [index, text] of texts.entries()) {
    const match = OPTION_ROW.exec(text);
    const label = match ? numbered.get(Number(match[2])) : undefined;
    const word = label?.split(' ')[0] ?? '';
    if (match && word !== '' && (match[3] ?? '').startsWith(word)) {
      owned[index] = true;
      column = (match[1] ?? '').length;
    } else if (
      !SEPARATOR.test(text) &&
      column !== null &&
      (INDENT.exec(text)?.[0].length ?? 0) > column
    ) {
      owned[index] = true;
    } else {
      column = null;
    }
  }
  for (const [index, text] of texts.entries()) {
    if (!SEPARATOR.test(text)) continue;
    const before = owned.slice(0, index).lastIndexOf(true);
    const after = owned.indexOf(true, index);
    const between = (from: number, to: number) =>
      texts.slice(from, to).every((t) => SEPARATOR.test(t));
    if (before >= 0 && after > index && between(before + 1, after)) owned[index] = true;
  }
  return owned;
}
