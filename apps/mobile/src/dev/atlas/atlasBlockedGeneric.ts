import {
  type CardContent,
  decodeAnsiScreen,
  type GenericDialogExcerpt,
  message,
} from '@openagentspocket/core';

/**
 * Dialogs no parser names, as the generic card gets them: each excerpt's rows and numbered options
 * copied from a screen golden (`packages/core/goldens`), which `atlasBlockedGeneric.test.ts` reads
 * through the real parser and `genericCardExcerpt` to keep them the same.
 */
export const GENERIC_GOLDENS = {
  /** Codex's MCP tool approval: Allow, Allow for this session, Always allow, Cancel. */
  mcp: {
    golden: 'codex/screens/codex-15-x6-mcp-tool-list',
    program: 'codex',
    reason: 'Agentico does not know this list.',
    rows: [
      '  Field 1/1',
      '  Allow the probe MCP server to run',
      '  tool "probe_echo"?',
      '',
      '  text: hi',
      '',
      '  › 1. Allow               Run the tool',
      '                           and continue',
      '    2. Allow for this      Run the tool',
      '       session             and remember',
      '                           this choice',
      '                           for this',
      '                           session',
      '    3. Always allow        Run the tool',
      '                           and remember',
      '                           this choice',
      '                           for future',
      '                           tool calls',
      '    4. Cancel              Cancel this',
      '                           tool call',
      '  enter to submit | esc to cancel',
    ],
    numbered: ['Allow', 'Allow for this session', 'Always allow', 'Cancel'],
  },
  /** Codex's "Implement this plan?" prompt. */
  plan: {
    golden: 'codex/screens/codex-19-x3-implement-plan',
    program: 'codex',
    reason: 'Agentico does not know this list.',
    rows: [
      '',
      '  Implement this plan?',
      '',
      '',
      '› 1. Yes, implement this plan          Switch to Default and start coding',
      '  2. Yes, clear context and implement  Start a fresh thread (current context: 4% used)',
      '  3. No, stay in Plan mode             Continue planning with the model',
      '',
      '  enter select · esc back',
    ],
    numbered: [
      'Yes, implement this plan',
      'Yes, clear context and implement',
      'No, stay in Plan mode',
    ],
  },
  /** Grok Build's rewind confirmation: lettered answers, no numbered one, so the key pad. */
  keys: {
    golden: 'grok/screens/grok-23-rewind-confirm',
    program: 'grok',
    reason:
      "Agentico doesn't know this Grok Build card. Answer it with these keys or in the terminal.",
    rows: [
      '  ┃',
      '  ┃  Rewind conversation to “Reply with the word plum.”?',
      '  ┃  y   (●) Yes',
      "  ┃  a   (○) Yes, and don't ask again",
      '  ┃  n   (○) No',
      '  ┃',
    ],
    numbered: [],
  },
} as const;

export type AtlasGenericVariant = keyof typeof GENERIC_GOLDENS;

function excerptOf(variant: AtlasGenericVariant): GenericDialogExcerpt {
  const { rows, numbered, reason } = GENERIC_GOLDENS[variant];
  return {
    rows: decodeAnsiScreen(rows.join('\n')).rows,
    numbered: new Map(numbered.map((label, index) => [index + 1, label])),
    reason: message(reason),
    fingerprint: { value: `atlas-${variant}`, requestLines: null, ruleLines: null },
    displayLines: null,
  };
}

/** The generic card of each golden, no request shown (none is a command waiting). */
export const genericContent = (variant: AtlasGenericVariant): CardContent => ({
  kind: 'generic',
  excerpt: excerptOf(variant),
  shown: null,
});
