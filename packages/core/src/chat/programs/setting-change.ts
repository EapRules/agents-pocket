// Whether and how the app changes one setting of an Agent's conversation: a pure decision over the
// setting, the value wanted and what herdr reports. A change is typed into the Agent's terminal
// like any terminal draft, so it goes through the program's own submission (`send/command-shortcut`)
// and refuses with the Composer's own refusals. Never while the Agent is blocked: a slash command
// typed over a dialog could answer it.

import type { ComposerRefusal } from '../../composer/policy';
import { type Message, message } from '../../errors/text';
import type { ChatAgentActivity } from '../model/types';
import {
  commandShortcutDraft,
  type ShortcutDraft,
  terminalCommandWithArguments,
} from '../send/command-shortcut';
import type { ProgramSendPolicy } from '../send/policy';
import { programCommands } from './registry';
import type { ProgramSetting, SettingPersistence } from './settings';

export const SETTING_READ_ONLY_KEY = 'The app can only show this setting.';
export const SETTING_VALUE_NOT_OFFERED_KEY = "The program doesn't offer this value.";
export const SETTING_AFTER_TURN_KEY = 'Applies after this turn.';
export const SETTING_SAVES_DEFAULT_KEY = 'Also becomes the default for new sessions.';

export interface SettingChangeRequest {
  readonly program: string | null | undefined;
  readonly setting: ProgramSetting;
  /** One of the setting's option values; ignored by a `terminal` apply, which opens the picker. */
  readonly value: string | null;
  readonly activity: ChatAgentActivity;
  /** The program's send policy; null for one Chat does not send to. */
  readonly policy: ProgramSendPolicy | null;
}

export type SettingChangePlan =
  /** Send `draft.text` to the Agent's terminal as typed; the program sets the value. */
  | {
      readonly kind: 'send';
      readonly draft: ShortcutDraft;
      /** The Agent is working: the change takes effect once this turn ends. */
      readonly appliesAfterTurn: boolean;
      readonly persists: SettingPersistence;
    }
  /** Type the program's own picker into its terminal draft, for the user to choose there. */
  | { readonly kind: 'openTerminal'; readonly draft: ShortcutDraft }
  | { readonly kind: 'refuse'; readonly refusal: ComposerRefusal };

const unavailable = (key: string): SettingChangePlan => ({
  kind: 'refuse',
  refusal: { kind: 'commandUnavailable', reason: message(key) },
});

const awaitsIdle = (command: string): SettingChangePlan => ({
  kind: 'refuse',
  refusal: { kind: 'commandAwaitsIdle', name: command.replace(/^\//, '') },
});

export function planSettingChange(request: SettingChangeRequest): SettingChangePlan {
  const { setting, value, activity, policy } = request;
  const { apply } = setting;
  if (apply.kind === 'none') return unavailable(SETTING_READ_ONLY_KEY);
  if (activity === 'blocked') return { kind: 'refuse', refusal: { kind: 'agentBlocked' } };
  if (apply.kind === 'terminal') {
    const shortcut = programCommands(request.program).find((c) => c.command === apply.command);
    if (!shortcut) return unavailable(SETTING_READ_ONLY_KEY);
    return { kind: 'openTerminal', draft: commandShortcutDraft(shortcut, 'terminal', policy) };
  }
  if (value === null || !setting.options.some((option) => option.value === value)) {
    return unavailable(SETTING_VALUE_NOT_OFFERED_KEY);
  }
  // An unknown status could be a dialog; a turn the docs say nothing about waits for idle.
  if (activity === 'unknown') return awaitsIdle(apply.command);
  if (activity === 'working' && apply.whileWorking === 'refuse') return awaitsIdle(apply.command);
  return {
    kind: 'send',
    draft: {
      surface: 'terminal',
      text: terminalCommandWithArguments(apply.command, value, policy),
    },
    appliesAfterTurn: activity === 'working',
    persists: apply.persists,
  };
}

/** What a planned change tells the user beside its result: when it applies, and for how long. */
export function settingChangeNotes(plan: SettingChangePlan): readonly Message[] {
  if (plan.kind !== 'send') return [];
  return [
    ...(plan.appliesAfterTurn ? [message(SETTING_AFTER_TURN_KEY)] : []),
    ...(plan.persists === 'default' ? [message(SETTING_SAVES_DEFAULT_KEY)] : []),
  ];
}
