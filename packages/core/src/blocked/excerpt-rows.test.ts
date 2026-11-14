import { describe, expect, it } from 'vitest';
import { allCaptures, cutTop } from './card-outcome.testkit';
import { CUT_VARIANTS, KNOWN_DEGRADED } from './degraded-dialogs.testkit';
import { excerptReading } from './excerpt-rows';
import { genericCardExcerpt, parseBlockedDialog } from './programs';
import type { AnsiScreen } from './screen';
import type { GenericDialogExcerpt } from './types';

const captures = new Map(allCaptures().map((capture) => [capture.id, capture]));

function excerptOf(id: string, keepFrom?: number): GenericDialogExcerpt {
  const capture = captures.get(id);
  if (!capture) throw new Error(`No capture ${id}`);
  const screen: AnsiScreen = keepFrom ? cutTop(capture.screen, keepFrom) : capture.screen;
  const result = parseBlockedDialog(screen, capture.program);
  if (result.kind !== 'unrecognized') throw new Error(`${id} should stay generic`);
  return genericCardExcerpt(result.excerpt, screen, capture.program);
}

const GLYPH = /[─-▟]/;

describe('excerptReading', () => {
  const degraded = [
    ...KNOWN_DEGRADED.map((entry) => [entry.id, excerptOf(entry.id)] as const),
    ...CUT_VARIANTS.filter((entry) => entry.outcome !== 'named').map(
      (entry) =>
        [`${entry.fixture} ${entry.cut}`, excerptOf(entry.fixture, entry.keepFrom)] as const,
    ),
  ];

  it.each(degraded)(
    '%s: keeps the words, drops only decoration and the answer rows',
    (_, excerpt) => {
      const { question, body } = excerptReading(excerpt);
      const rows = excerpt.rows.map((row) => row.text);
      for (const line of body) {
        if (line === '') continue;
        expect(
          rows.some((row) => row.includes(line.trim())),
          line,
        ).toBe(true);
        expect(line.startsWith(' ') && GLYPH.test(line.trim()[0] ?? '')).toBe(false);
      }
      if (question) expect(body).toContain(question);
      const labels = [...excerpt.numbered.values()];
      // No row the card draws as a button reads again in the body.
      for (const line of body) {
        expect(
          labels.some((label) => line.includes(`. ${label}`)),
          line,
        ).toBe(false);
      }
    },
  );

  it('takes the question right above the answers as the title', () => {
    expect(excerptReading(excerptOf('fixtures/claude-tall-bash')).question).toBe(
      'Do you want to proceed?',
    );
    expect(excerptReading(excerptOf('claude-22-c7-edit', 28)).question).toMatch(/\?$/);
  });

  it('keeps the title when the row above the answers is not one whole question', () => {
    // Codex's MCP approval asks over two rows, with its arguments between it and the answers.
    expect(excerptReading(excerptOf('codex-15-x6-mcp-tool-list')).question).toBeNull();
    // Only the answers remain on screen.
    expect(excerptReading(excerptOf('claude-02-c1-bash-blocked', 19)).question).toBeNull();
  });

  it('drops the answers with their detail column, and nothing else', () => {
    const excerpt = excerptOf('codex-15-x6-mcp-tool-list');
    const { body } = excerptReading(excerpt);
    expect(body.some((line) => line.includes('Run the tool'))).toBe(false);
    expect(body.some((line) => line.includes('probe MCP server'))).toBe(true);
    expect(body.at(-1)).toBe('enter to submit | esc to cancel');
  });

  it('keeps every row of an excerpt with no numbered answer, gutters and frames off', () => {
    const excerpt = excerptOf('grok-23-rewind-confirm');
    const { question, body } = excerptReading(excerpt);
    expect(question).toBeNull();
    expect(body.filter((line) => line !== '')).toHaveLength(4);
    expect(body.every((line) => !GLYPH.test(line))).toBe(true);
  });
});
