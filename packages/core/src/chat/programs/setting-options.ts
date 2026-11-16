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
}

export const settingOption = (
  value: string,
  title: string,
  extra: Pick<ProgramSettingOption, 'recorded' | 'drawn'> = {},
): ProgramSettingOption => ({ value, title: message(title), ...extra });
