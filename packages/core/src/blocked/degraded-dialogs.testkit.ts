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
 * buttons that press the option's number, `keys` the same key pad under the rows (no row is a
 * numbered answer), `none` leaves only Show terminal (a wait only the terminal answers).
 *
 * No capture holds a dialog taller than the terminal but `fixtures/claude-tall-bash`, so
 * `CUT_VARIANTS` derives them: each program's approval captures with the top of the screen cut
 * (`cutTop`), and what the card does with each today. A change in that column fails a test too.
 *
 * <degraded-table>
 * Known degraded captures:
 *
 * | Capture | Card | Answers | Why |
 * |---|---|---|---|
 * | claude-42-c8-phone-question-previews | generic | keys | Claude question with previews: no reader yet. User sees raw rows, the reason and the keys |
 * | codex-15-x6-mcp-tool-list | generic | digits | Codex MCP tool approval (Allow / for this session / Always / Cancel): no kind. User sees raw rows and the reason, the answers laid out as a permission |
 * | codex-19-x3-implement-plan | generic | digits | Codex "Implement this plan?": no kind. User sees raw rows and the reason, the answers laid out as a permission |
 * | lab/codex/hooks-review | generic | none | Codex hook review: by design only the terminal answers it. User sees the rows and what it waits for |
 * | omp-31-plan-review | generic | keys | Oh My Pi "Plan Review" panel: no reader. User sees raw rows, the reason and the keys |
 * | omp-34-ask-multi-62 | generic | keys | Oh My Pi multi-select ask: only single-select is answered. User sees raw rows, the reason and the keys |
 * | grok-23-rewind-confirm | generic | keys | Grok rewind confirmation: no reader. User sees raw rows, the reason and the keys |
 * | grok-39-fork-question-40 | generic | keys | Grok /fork at 40 columns hides two answers, so the card does not guess. User sees raw rows, the reason and the keys |
 * | opencode-25-reject-feedback-180 | generic | keys | OpenCode reject note: by design typed in the terminal. User sees raw rows, the reason and the keys |
 * | opencode-42-reject-feedback-62 | generic | keys | OpenCode reject note at 62 columns: as above. User sees raw rows, the reason and the keys |
 * | fixtures/claude-tall-bash | generic | digits | Claude Bash taller than the terminal: raw without a request; with the one waiting command it is `shown` (shown-request-tall.test.ts) |
 *
 * Approval dialogs cut at the top:
 *
 * | Capture | Cut | Card | Answers |
 * |---|---|---|---|
 * | claude-02-c1-bash-blocked | top | shown | digits |
 * | claude-02-c1-bash-blocked | title | shown | digits |
 * | claude-02-c1-bash-blocked | options | generic | digits |
 * | claude-22-c7-edit | top | generic | digits |
 * | claude-22-c7-edit | title | generic | digits |
 * | claude-22-c7-edit | options | generic | digits |
 * | codex-01-x1-exec | title | shown | digits |
 * | codex-01-x1-exec | options | generic | digits |
 * | codex-02-x2-patch | title | generic | digits |
 * | codex-02-x2-patch | options | generic | digits |
 * | opencode-10-permission-180 | top | named | - |
 * | opencode-10-permission-180 | title | generic | keys |
 * | opencode-10-permission-180 | options | generic | keys |
 * | opencode-27-permission-shell-180 | top | named | - |
 * | opencode-27-permission-shell-180 | title | generic | keys |
 * | opencode-27-permission-shell-180 | options | generic | keys |
 * | opencode-37-permission-long-62 | top | named | - |
 * | opencode-37-permission-long-62 | title | generic | keys |
 * | opencode-37-permission-long-62 | options | generic | keys |
 * | grok-12-permission-command | top | named | - |
 * | grok-12-permission-command | title | named | - |
 * | grok-12-permission-command | options | named | - |
 * | grok-14-permission-edit | top | named | - |
 * | grok-14-permission-edit | title | named | - |
 * | grok-14-permission-edit | options | named | - |
 * | omp-24-approval-a-dialog | title | generic | keys |
 * | omp-24-approval-a-dialog | options | generic | keys |
 * | omp-36-approval-edit-18-12 | title | generic | keys |
 * | omp-36-approval-edit-18-12 | options | generic | keys |
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
const KEYS = 'raw rows, the reason and the keys';

export const KNOWN_DEGRADED: readonly KnownDegraded[] = [
  {
    id: 'claude-42-c8-phone-question-previews',
    outcome: 'generic',
    answers: 'keys',
    why: `Claude question with previews: no reader yet. User sees ${KEYS}`,
  },
  {
    id: 'codex-15-x6-mcp-tool-list',
    outcome: 'generic',
    answers: 'digits',
    why: `Codex MCP tool approval (Allow / for this session / Always / Cancel): no kind. User sees ${RAW}, the answers laid out as a permission`,
  },
  {
    id: 'codex-19-x3-implement-plan',
    outcome: 'generic',
    answers: 'digits',
    why: `Codex "Implement this plan?": no kind. User sees ${RAW}, the answers laid out as a permission`,
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
    answers: 'keys',
    why: `Oh My Pi "Plan Review" panel: no reader. User sees ${KEYS}`,
  },
  {
    id: 'omp-34-ask-multi-62',
    outcome: 'generic',
    answers: 'keys',
    why: `Oh My Pi multi-select ask: only single-select is answered. User sees ${KEYS}`,
  },
  {
    id: 'grok-23-rewind-confirm',
    outcome: 'generic',
    answers: 'keys',
    why: `Grok rewind confirmation: no reader. User sees ${KEYS}`,
  },
  {
    id: 'grok-39-fork-question-40',
    outcome: 'generic',
    answers: 'keys',
    why: `Grok /fork at 40 columns hides two answers, so the card does not guess. User sees ${KEYS}`,
  },
  {
    id: 'opencode-25-reject-feedback-180',
    outcome: 'generic',
    answers: 'keys',
    why: `OpenCode reject note: by design typed in the terminal. User sees ${KEYS}`,
  },
  {
    id: 'opencode-42-reject-feedback-62',
    outcome: 'generic',
    answers: 'keys',
    why: `OpenCode reject note at 62 columns: as above. User sees ${KEYS}`,
  },
  {
    id: 'fixtures/claude-tall-bash',
    outcome: 'generic',
    answers: 'digits',
    why: 'Claude Bash taller than the terminal: raw without a request; with the one waiting command it is `shown` (shown-request-tall.test.ts)',
  },
];

/** Which part of the dialog a size variant cuts off the top of the screen. */
export type Cut = 'top' | 'title' | 'options';

export interface CutVariant {
  /** A golden stem (`allCaptures` id). */
  readonly fixture: string;
  /**
   * `top`: the dialog's first row (its rule, border or padding) is off screen; `title`: its
   * heading too; `options`: everything above the answers.
   */
  readonly cut: Cut;
  /** The first screen row kept (`cutTop`). */
  readonly keepFrom: number;
  /** The waiting request's command when the dialog asks to run one, for `shown`. */
  readonly command: string | null;
  readonly outcome: CardOutcome;
  readonly answers: GenericAnswers | null;
}

const variant = (
  fixture: string,
  command: string | null,
  cuts: readonly [Cut, number, CardOutcome, GenericAnswers | null][],
): CutVariant[] =>
  cuts.map(([cut, keepFrom, outcome, answers]) => ({
    fixture,
    cut,
    keepFrom,
    command,
    outcome,
    answers,
  }));

/** Each program's approval captures with their top cut by the terminal, and what the card does today. */
export const CUT_VARIANTS: readonly CutVariant[] = [
  ...variant('claude-02-c1-bash-blocked', 'touch c1.txt', [
    ['top', 12, 'shown', 'digits'],
    ['title', 13, 'shown', 'digits'],
    ['options', 19, 'generic', 'digits'],
  ]),
  ...variant('claude-22-c7-edit', null, [
    ['top', 28, 'generic', 'digits'],
    ['title', 29, 'generic', 'digits'],
    ['options', 35, 'generic', 'digits'],
  ]),
  ...variant('codex-01-x1-exec', 'touch x1.txt', [
    ['title', 27, 'shown', 'digits'],
    ['options', 35, 'generic', 'digits'],
  ]),
  ...variant('codex-02-x2-patch', null, [
    ['title', 30, 'generic', 'digits'],
    ['options', 35, 'generic', 'digits'],
  ]),
  ...variant('opencode-10-permission-180', null, [
    ['top', 38, 'named', null],
    ['title', 39, 'generic', 'keys'],
    ['options', 44, 'generic', 'keys'],
  ]),
  ...variant('opencode-27-permission-shell-180', 'git status', [
    ['top', 39, 'named', null],
    ['title', 40, 'generic', 'keys'],
    ['options', 44, 'generic', 'keys'],
  ]),
  ...variant('opencode-37-permission-long-62', null, [
    ['top', 26, 'named', null],
    ['title', 27, 'generic', 'keys'],
    ['options', 36, 'generic', 'keys'],
  ]),
  ...variant('grok-12-permission-command', 'chmod 644 README.md', [
    ['top', 34, 'named', null],
    ['title', 35, 'named', null],
    ['options', 38, 'named', null],
  ]),
  ...variant('grok-14-permission-edit', null, [
    ['top', 37, 'named', null],
    ['title', 38, 'named', null],
    ['options', 39, 'named', null],
  ]),
  ...variant('omp-24-approval-a-dialog', 'echo approved-2', [
    ['title', 34, 'generic', 'keys'],
    ['options', 36, 'generic', 'keys'],
  ]),
  ...variant('omp-36-approval-edit-18-12', null, [
    ['title', 31, 'generic', 'keys'],
    ['options', 32, 'generic', 'keys'],
  ]),
];

/** The header table: one row per known degraded capture, then one per cut variant. */
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
  lines.push('', 'Approval dialogs cut at the top:', '', '| Capture | Cut | Card | Answers |');
  lines.push('|---|---|---|---|');
  for (const entry of CUT_VARIANTS) {
    lines.push(`| ${entry.fixture} | ${entry.cut} | ${entry.outcome} | ${entry.answers ?? '-'} |`);
  }
  return lines;
}
