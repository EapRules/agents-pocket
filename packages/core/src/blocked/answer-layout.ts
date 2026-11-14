// How a Blocked card lays out an approval: a title naming who wants to do what, and the two
// single-use answers side by side. Presentation only: what each button sends is the planner's,
// keyed by the option's ordinal or number, and never changes with the layout.

import { programDefinition } from '../chat/programs/registry';
import { permissionRole, splitShortcut } from './row-scanner';
import type { BlockedDialog, BlockedDialogKind, DialogOptionRole } from './types';

/** The dialogs that ask to allow one action: they get the side-by-side pair. */
const APPROVAL_KINDS: readonly BlockedDialogKind[] = [
  'claudeBash',
  'claudeFileEdit',
  'claudeFileCreate',
  'claudeFileRead',
  'claudeFetch',
  'codexExec',
  'codexPatch',
  'codexNetwork',
  'ompApproval',
  'grokPermission',
  'openCodePermission',
];

export const isApprovalDialog = (dialog: BlockedDialog): boolean =>
  APPROVAL_KINDS.includes(dialog.kind);

/** What the Agent wants to do, for the card's title ("Bash wants to run:"). */
export type ApprovalVerb = 'run' | 'edit' | 'create' | 'read' | 'fetch' | 'connect';

export interface ApprovalHeadline {
  /** The tool when the dialog names one that runs commands, otherwise the program. */
  readonly actor: string;
  readonly verb: ApprovalVerb;
}

const OPENCODE_VERBS: Readonly<Record<string, ApprovalVerb>> = {
  Read: 'read',
  List: 'read',
  Edit: 'edit',
  Write: 'edit',
  Patch: 'edit',
  WebFetch: 'fetch',
};

/** The title an approval reads as, or null to keep the dialog's own title. */
export function approvalHeadline(dialog: BlockedDialog): ApprovalHeadline | null {
  const program = programDefinition(dialog.program).chatName;
  const { subject } = dialog;
  const by = (actor: string, verb: ApprovalVerb): ApprovalHeadline => ({ actor, verb });
  switch (dialog.kind) {
    case 'claudeBash':
      return by('Bash', 'run');
    case 'claudeFileEdit':
      return by(program, 'edit');
    case 'claudeFileCreate':
      return by(program, 'create');
    case 'claudeFileRead':
      return by(program, 'read');
    case 'claudeFetch':
      return by(program, 'fetch');
    case 'codexExec':
      return by(program, 'run');
    case 'codexPatch':
      return by(program, 'edit');
    case 'codexNetwork':
      return subject.host ? by(program, 'connect') : null;
    case 'ompApproval':
    case 'grokPermission':
      return subject.command ? by(subject.toolName ?? program, 'run') : null;
    case 'openCodePermission': {
      if (subject.command) return by(subject.toolName ?? program, 'run');
      const verb = OPENCODE_VERBS[subject.toolName ?? ''];
      return verb ? by(program, verb) : null;
    }
    default:
      return null;
  }
}

/** An approval's answers: the single-use pair, deny first, and everything else below in order. */
export interface AnswerLayout<T> {
  readonly pair: { readonly deny: T; readonly approve: T } | null;
  readonly rest: readonly T[];
}

/**
 * The pair holds exactly one single-use approve (`approve`, never `approvePersistent` or a mode
 * switch) and exactly one decline; anything else, or more than one of either, keeps every answer
 * in the list.
 */
export function splitAnswers<T>(
  items: readonly T[],
  roleOf: (item: T) => DialogOptionRole | null,
): AnswerLayout<T> {
  const approves = items.filter((item) => roleOf(item) === 'approve');
  const denies = items.filter((item) => roleOf(item) === 'decline');
  const [approve] = approves;
  const [deny] = denies;
  if (approves.length !== 1 || denies.length !== 1 || !approve || !deny) {
    return { pair: null, rest: items };
  }
  return {
    pair: { deny, approve },
    rest: items.filter((item) => item !== approve && item !== deny),
  };
}

/** The single-use approvals each program labels this way, compared without case. */
const SINGLE_USE_LABELS = ['yes', 'yes, proceed', 'allow once'];

/**
 * A generic option's role, from its label alone and strictly: approve only for a label that is a
 * known single-use answer as a whole, so a "Yes, and ..." the parsers never saw is never the lead.
 */
export function genericAnswerRole(label: string): DialogOptionRole | null {
  const bare = splitShortcut(label.trim()).label;
  if (SINGLE_USE_LABELS.includes(bare.toLowerCase())) return 'approve';
  const role = permissionRole(bare, null);
  return role === 'approve' ? null : role;
}
