/**
 * The known degraded dialogs: every screen capture whose dialog the Blocked card does not show as
 * a card of its kind, each a decision with its reason and what the owner of the phone sees.
 * `degraded-dialogs.test.ts` fails when a capture degrades and is not listed here, when a listed
 * one reads otherwise (it started parsing: take it off the list), and when the table below no
 * longer matches the list (rewrite it with `UPDATE_DEGRADED_TABLE=1 pnpm exec vitest run
 * src/blocked/degraded-dialogs.test.ts` in packages/core).
 *
 * Outcomes (`card-outcome.testkit.ts`): `generic` is the "Needs you" card with the dialog's rows
 * verbatim and the reason, `shown` the generic card presenting the waiting request's command,
 * `unreadable` the "Keys" card (↑ ↓ Enter Escape, no row of the dialog). Answers: `digits` are
 * buttons that press the option's number, `none` leaves only Show terminal.
 *
 * <degraded-table>
 * Known degraded captures:
 *
 * | Capture | Card | Answers | Why |
 * |---|---|---|---|
 * | claude-42-c8-phone-question-previews | generic | none | Claude question with previews: no reader yet. User sees raw rows and the reason, no answer buttons |
 * | codex-15-x6-mcp-tool-list | generic | digits | Codex MCP tool approval (Allow / for this session / Always / Cancel): no kind. User sees raw rows and the reason, buttons 1-4 |
 * | codex-19-x3-implement-plan | generic | digits | Codex "Implement this plan?": no kind. User sees raw rows and the reason, buttons 1-3 |
 * | lab/codex/hooks-review | generic | none | Codex hook review: by design only the terminal answers it. User sees the rows and what it waits for |
 * | omp-31-plan-review | generic | none | Oh My Pi "Plan Review" panel: no reader. User sees raw rows and the reason |
 * | omp-34-ask-multi-62 | generic | none | Oh My Pi multi-select ask: only single-select is answered. User sees raw rows and the reason |
 * | grok-23-rewind-confirm | generic | none | Grok rewind confirmation: no reader. User sees raw rows and the reason |
 * | grok-39-fork-question-40 | generic | none | Grok /fork at 40 columns hides two answers, so the card does not guess. User sees raw rows and the reason |
 * | opencode-25-reject-feedback-180 | generic | none | OpenCode reject note: by design typed in the terminal. User sees raw rows and the reason |
 * | opencode-42-reject-feedback-62 | generic | none | OpenCode reject note at 62 columns: as above. User sees raw rows and the reason |
 * | fixtures/claude-tall-bash | generic | digits | Claude Bash taller than the terminal: raw without a request; with the one waiting command it is `shown` (shown-request-tall.test.ts) |
 * </degraded-table>
 */
import type { CardOutcome, GenericAnswers } from './card-outcome.testkit';

export interface KnownDegraded {
  /** The capture's id (`allCaptures`). */
  readonly id: string;
  readonly outcome: Exclude<CardOutcome, 'named' | 'none'>;
  readonly answers: GenericAnswers | null;
  /** Why no card of its kind: the missing reader, or the decision to leave it to the terminal. */
  readonly why: string;
}

const RAW = 'raw rows and the reason';

export const KNOWN_DEGRADED: readonly KnownDegraded[] = [
  {
    id: 'claude-42-c8-phone-question-previews',
    outcome: 'generic',
    answers: 'none',
    why: `Claude question with previews: no reader yet. User sees ${RAW}, no answer buttons`,
  },
  {
    id: 'codex-15-x6-mcp-tool-list',
    outcome: 'generic',
    answers: 'digits',
    why: `Codex MCP tool approval (Allow / for this session / Always / Cancel): no kind. User sees ${RAW}, buttons 1-4`,
  },
  {
    id: 'codex-19-x3-implement-plan',
    outcome: 'generic',
    answers: 'digits',
    why: `Codex "Implement this plan?": no kind. User sees ${RAW}, buttons 1-3`,
  },
  {
    id: 'lab/codex/hooks-review',
    outcome: 'generic',
    answers: 'none',
    why: 'Codex hook review: by design only the terminal answers it. User sees the rows and what it waits for',
  },
  {
    id: 'omp-31-plan-review',
    outcome: 'generic',
    answers: 'none',
    why: `Oh My Pi "Plan Review" panel: no reader. User sees ${RAW}`,
  },
  {
    id: 'omp-34-ask-multi-62',
    outcome: 'generic',
    answers: 'none',
    why: `Oh My Pi multi-select ask: only single-select is answered. User sees ${RAW}`,
  },
  {
    id: 'grok-23-rewind-confirm',
    outcome: 'generic',
    answers: 'none',
    why: `Grok rewind confirmation: no reader. User sees ${RAW}`,
  },
  {
    id: 'grok-39-fork-question-40',
    outcome: 'generic',
    answers: 'none',
    why: `Grok /fork at 40 columns hides two answers, so the card does not guess. User sees ${RAW}`,
  },
  {
    id: 'opencode-25-reject-feedback-180',
    outcome: 'generic',
    answers: 'none',
    why: `OpenCode reject note: by design typed in the terminal. User sees ${RAW}`,
  },
  {
    id: 'opencode-42-reject-feedback-62',
    outcome: 'generic',
    answers: 'none',
    why: `OpenCode reject note at 62 columns: as above. User sees ${RAW}`,
  },
  {
    id: 'fixtures/claude-tall-bash',
    outcome: 'generic',
    answers: 'digits',
    why: 'Claude Bash taller than the terminal: raw without a request; with the one waiting command it is `shown` (shown-request-tall.test.ts)',
  },
];

/** The header table: one row per known degraded capture. */
export function degradedTable(): string[] {
  const lines = [
    'Known degraded captures:',
    '',
    '| Capture | Card | Answers | Why |',
    '|---|---|---|---|',
  ];
  for (const entry of KNOWN_DEGRADED) {
    lines.push(`| ${entry.id} | ${entry.outcome} | ${entry.answers ?? '-'} | ${entry.why} |`);
  }
  return lines;
}
