import {
  type BlockedCardState,
  type BlockedCardStore,
  type BlockedDialog,
  type CardContent,
  type DialogOption,
  decodeAnsiScreen,
  type GenericDialogExcerpt,
  makeFocus,
  makeOption,
  makeSubject,
  message,
  requestShownOnScreen,
} from '@openagentspocket/core';
import type { ReactNode } from 'react';
import { BlockedCardOverride } from '@/blocked/BlockedCardSlot';
import { TALL_CONTENT } from './atlasBlockedTall';

/** The Blocked card states the atlas draws over a Blocked Agent's chat. */
export type AtlasBlockedVariant =
  | 'bash'
  | 'clipped'
  | 'tall'
  | 'raw'
  | 'unreadable'
  | 'persistent'
  | 'question';

const FINGERPRINT = { value: 'atlas', requestLines: null, ruleLines: null };

function dialog(fields: Partial<BlockedDialog> & Pick<BlockedDialog, 'options'>): BlockedDialog {
  return {
    kind: 'claudeBash',
    program: 'claude',
    title: 'Bash command',
    sourceSuffix: null,
    positionLabel: null,
    body: [],
    progress: null,
    rows: { lowerBound: 0, upperBound: 10 },
    fingerprint: FINGERPRINT,
    focus: makeFocus({ focusedOrdinal: 1 }),
    subject: makeSubject(),
    note: null,
    ...fields,
  };
}

const option = (ordinal: number, label: string, role: DialogOption['role']) =>
  makeOption({ ordinal, number: ordinal, label, role, isFocused: ordinal === 1 });

const bash = dialog({
  body: ['Run the declined card UI test'],
  options: [
    option(1, 'Yes', 'approve'),
    option(
      2,
      "Yes, and don't ask again for swift test commands in /workspace/storefront",
      'approvePersistent',
    ),
    option(3, 'No', 'decline'),
  ],
  subject: {
    ...makeSubject(),
    commandDescription: 'Run the declined card UI test',
    command: 'swift test --filter CheckoutUITests/testDeclinedPaymentKeepsTheCart',
  },
});

const codex = dialog({
  kind: 'codexExec',
  program: 'codex',
  title: 'Would you like to run the following command?',
  options: [
    option(1, 'Yes, proceed', 'approve'),
    option(
      2,
      "Yes, and don't ask again for commands that start with `pnpm test`",
      'approvePersistent',
    ),
    option(3, 'No, and tell Codex what to do differently', 'decline'),
  ],
  subject: {
    ...makeSubject(),
    command: 'pnpm test --filter checkout',
    reason: 'Run the checkout tests',
  },
});

const question = dialog({
  kind: 'claudeQuestion',
  title: 'Which payment provider should checkout use?',
  options: [
    option(1, 'Stripe', 'answer'),
    option(2, 'Adyen', 'answer'),
    option(3, 'Keep both behind a flag', 'answer'),
  ],
  subject: { ...makeSubject(), question: 'Which payment provider should checkout use?' },
});

/** A Bash dialog whose top scrolled off the terminal: the parsers cannot name it. */
const CLIPPED_ROWS = [
  ' Bash command',
  ' Commit and push the release bump, dry-run the release script',
  '╌'.repeat(60),
  '  │ git commit -qam "Release 1.0.1 (4)" >/dev/null 2>&1; git log --oneline -1; git push',
  '  │ origin main 2>&1 | tail -1',
  '╌'.repeat(60),
  ' Do you want to proceed?',
  ' ❯ 1. Yes',
  '   2. No',
];
const COMMAND =
  'git commit -qam "Release 1.0.1 (4)" >/dev/null 2>&1; git log --oneline -1; git push origin main 2>&1 | tail -1';

const excerpt: GenericDialogExcerpt = {
  rows: decodeAnsiScreen(CLIPPED_ROWS.join('\n')).rows,
  numbered: new Map([
    [1, 'Yes'],
    [2, 'No'],
  ]),
  reason: message('The top of the dialog is off screen.'),
  fingerprint: FINGERPRINT,
  displayLines: null,
};

const CONTENT: Record<AtlasBlockedVariant, CardContent> = {
  bash: { kind: 'card', dialog: bash },
  persistent: { kind: 'card', dialog: codex },
  question: { kind: 'card', dialog: question },
  clipped: {
    kind: 'generic',
    excerpt,
    // Read as the store reads it, so the atlas shows what the match really allows.
    shown: requestShownOnScreen(excerpt, {
      requests: [
        {
          entryID: 'atlas',
          callID: 'toolu_atlas',
          kind: 'command',
          toolName: 'Bash',
          summary: COMMAND,
          detail: 'Commit and push the release bump, dry-run the release script',
          questions: [],
          planFilePath: null,
        },
      ],
      subagentRunning: false,
    }),
  },
  tall: TALL_CONTENT,
  raw: { kind: 'generic', excerpt, shown: null },
  // No parser saw a dialog while herdr says Blocked: the key pad card.
  unreadable: { kind: 'unreadable' },
};

const stateOf = (variant: AtlasBlockedVariant): BlockedCardState => ({
  content: CONTENT[variant],
  progress: 'ready',
  notice: null,
  composerFocusRequest: 0,
  dialogGeneration: 0,
  isCollapsed: false,
});

const store = {
  perform: async () => undefined,
  press: async () => undefined,
  sendKeys: async () => undefined,
  setCollapsed: () => undefined,
} as unknown as BlockedCardStore;

/** A Blocked Agent's card as the atlas shows it over the composer: a Bash approval by default. */
export function AtlasBlocked({
  variant = 'bash',
  children,
}: {
  variant?: AtlasBlockedVariant;
  children: ReactNode;
}) {
  return (
    <BlockedCardOverride.Provider value={{ store, state: stateOf(variant) }}>
      {children}
    </BlockedCardOverride.Provider>
  );
}
