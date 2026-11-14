import {
  type CardContent,
  decodeAnsiScreen,
  type GenericDialogExcerpt,
  message,
  requestShownOnScreen,
} from '@openagentspocket/core';

/** The command's lines after the `cd`, a heredoc long enough to make the dialog taller than the screen. */
const LINES = [
  "python3 - <<'EOF'",
  '# A long command on purpose: its permission dialog is taller than the terminal.',
  '# Nothing here changes anything.',
  'lines = [',
  ...[0, 5, 10, 15].map(
    (start) =>
      `    ${[1, 2, 3, 4, 5].map((at) => `"line ${String(start + at).padStart(2, '0')}"`).join(', ')},`,
  ),
  ']',
  'total = 0',
  'for item in lines:',
  '    total += len(item)',
  'checks = {',
  ...'abcdefghijklmnopqrst'.split('').map((key, at) => `    "${key}": ${at + 1},`),
  '}',
  'for key in sorted(checks):',
  '    total += checks[key]',
  'print("nothing changed", total)',
  'EOF',
  'git status -sb | head -1 && git push origin main 2>&1 | tail -1',
];
const COMMAND = `cd /workspace/storefront && ${LINES.join('\n')}`;
const DESCRIPTION =
  'Run a long harmless command that ends in a push with nothing to send, to show the tall permission prompt';

/**
 * What the card reads of Claude Code's dialog for that command: the 12 rows above the options, so
 * the command's block starts cut by the top of the screen.
 */
const ROWS = [
  ...LINES.slice(-6).map((line) => ` │ ${line}`),
  '╌'.repeat(60),
  ' Contains brace with quote character (expansion obfuscation)',
  ' Ask rule Bash(git push *) overrides auto mode for this command.',
  ' /permissions to let auto mode decide',
  '',
  ' Do you want to proceed?',
  ' ❯ 1. Yes',
  '   2. No',
  '',
  ' Esc to cancel · Tab to amend',
];

const excerpt: GenericDialogExcerpt = {
  rows: decodeAnsiScreen(ROWS.join('\n')).rows,
  numbered: new Map([
    [1, 'Yes'],
    [2, 'No'],
  ]),
  reason: message('The top of the dialog is off screen.'),
  fingerprint: { value: 'atlas-tall', requestLines: null, ruleLines: null },
  displayLines: null,
};

/** A dialog taller than the terminal, read as the store reads it: shown from its one request. */
export const TALL_CONTENT: CardContent = {
  kind: 'generic',
  excerpt,
  shown: requestShownOnScreen(excerpt, {
    requests: [
      {
        entryID: 'atlas',
        callID: 'toolu_atlas_tall',
        kind: 'command',
        toolName: 'Bash',
        summary: COMMAND,
        detail: DESCRIPTION,
        questions: [],
        planFilePath: null,
      },
    ],
    subagentRunning: false,
  }),
};
