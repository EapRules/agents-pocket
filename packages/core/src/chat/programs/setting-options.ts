// One value of a conversation setting (`settings.ts`), kept apart so the mode lists can build their
// thinking levels from it without loading the readers.

import { type Message, message } from '../../errors/text';

export interface ProgramSettingOption {
  /** What the program's command takes, and what a read returns. */
  readonly value: string;
  readonly title: Message;
  /** Other words the program's records use for this value (`fast` for fast mode on). */
  readonly recorded?: readonly string[];
  /** Text the program's footer draws in this state, for a `footer` read. */
  readonly drawn?: readonly string[];
  /** How long this value lasts when it differs from its command's (Claude Code's session-only `max`). */
  readonly persists?: SettingPersistence;
}

/** How long a change lasts, per the program's documentation. */
export type SettingPersistence =
  /** Saved as the user's default for later sessions too. */
  | 'default'
  | 'session'
  /** The documentation does not say. */
  | 'unstated';

export const settingOption = (
  value: string,
  title: string,
  extra: Pick<ProgramSettingOption, 'recorded' | 'drawn' | 'persists'> = {},
): ProgramSettingOption => ({ value, title: message(title), ...extra });
