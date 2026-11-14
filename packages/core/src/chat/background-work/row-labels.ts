// The second line of a Background Work row: what kind of work it is, and where it stands.

import { message, type Text } from '../../errors/text';
import type { ChatBackgroundWorkItem } from '../model/types';
import type { BackgroundWorkStatus } from './presentation';

/** What kind of work the item is: a Subagent's type, "Workflow", "Shell command". */
export function kindLabelOf(item: ChatBackgroundWorkItem): Text {
  switch (item.kind) {
    case 'subagent':
      return item.subtitle ?? message('Subagent');
    case 'workflow':
      return message('Workflow');
    case 'command':
      return message('Shell command');
  }
}

/** An exit code worth saying: one other than zero. */
export const exitCodeText = (exitCode: number | null): Text | null =>
  exitCode === null || exitCode === 0 ? null : message('Exit code %@', String(exitCode));

/**
 * Where the work stands: its running time (or why there is none), else how it ended, with an exit
 * code other than zero and how long it ran.
 */
export function stateLabelOf(
  status: BackgroundWorkStatus,
  time: string | null,
  note: Text | null,
  exitCode: number | null,
): Text {
  const ended = (word: Text): Text => {
    const parts = [word, exitCodeText(exitCode), time].filter((part) => part !== null);
    return parts.length === 1 ? word : { join: parts, separator: ' · ' };
  };
  switch (status) {
    case 'running':
      return time ?? message('Running');
    case 'unconfirmed':
    case 'quiet':
      return note ?? message('Not updating');
    case 'completed':
      return ended(message('Completed'));
    case 'failed':
      return ended(message('Failed'));
    case 'stopped':
      return ended(message('Stopped'));
  }
}
