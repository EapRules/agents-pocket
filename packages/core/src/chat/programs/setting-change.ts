// Whether and how the app changes one setting of an Agent's conversation: a pure decision over the
// setting, the value wanted, what herdr reports and the Agent's screen. A change is typed into the
// Agent's terminal like any terminal draft, so it goes through the program's own submission
// (`send/command-shortcut`) and refuses with the Composer's own refusals. Never while the Agent is
// blocked, and a command goes only into an input box read as empty (`send/input-box`): a slash
// command typed over a dialog could answer it, and one typed after a draft would extend it.

import type { AnsiScreen } from '../../blocked/screen';
import type { ComposerRefusal } from '../../composer/policy';
import { type Message, message } from '../../errors/text';
import type { ChatAgentActivity } from '../model/types';
import {
  commandShortcutDraft,
  type ShortcutDraft,
  terminalCommandWithArguments,
} from '../send/command-shortcut';
import { detectInputBox, holdReason } from '../send/detect';
import { type InputBoxState, preSendCheck } from '../send/input-box';
import type { ProgramSendPolicy } from '../send/policy';
import { programCommands } from './registry';
import type { ProgramSetting, SettingPersistence } from './settings';

export const SETTING_READ_ONLY_KEY = 'The app can only show this setting.';
export const SETTING_VALUE_NOT_OFFERED_KEY = "The program doesn't offer this value.";
export const SETTING_AFTER_TURN_KEY = 'Applies after this turn.';
export const SETTING_SAVES_DEFAULT_KEY = 'Also becomes the default for new sessions.';
export { SETTING_USAGE_CREDITS_KEY } from './setting-options';

export interface SettingChangeRequest {
  readonly program: string | null | undefined;
  readonly setting: ProgramSetting;
  /** One of the setting's option values; ignored by a `terminal` apply, which opens the picker. */
  readonly value: string | null;
  readonly activity: ChatAgentActivity;
  /** The program's send policy; null for one Chat does not send to. */
  readonly policy: ProgramSendPolicy | null;
  /**
   * The Agent's screen read just now; a command is sent only into a box it shows empty. Absent
   * previews the change (what a row offers before the user applies it): every check but the box.
   */
  readonly screen?: AnsiScreen | null;
}

export type SettingChangePlan =
  /**
   * Send `draft.text` to the Agent's terminal as typed; the program sets the value. The terminal
   * Composer's delivery re-reads the box before it types, as for any draft.
   */
  | {
      readonly kind: 'send';
      readonly draft: ShortcutDraft;
      /** The Agent is working: the change takes effect once this turn ends. */
      readonly appliesAfterTurn: boolean;
      readonly persists: SettingPersistence;
      /** The value's own notes (Claude Code's fast mode bills usage credits). */
      readonly notes: readonly Message[];
    }
  /** Type the program's own picker into its terminal draft, for the user to choose there. */
  | { readonly kind: 'openTerminal'; readonly draft: ShortcutDraft }
  | { readonly kind: 'refuse'; readonly refusal: ComposerRefusal };

const refuse = (refusal: ComposerRefusal): SettingChangePlan => ({ kind: 'refuse', refusal });

const unavailable = (key: string) => refuse({ kind: 'commandUnavailable', reason: message(key) });

const awaitsIdle = (command: string) =>
  refuse({ kind: 'commandAwaitsIdle', name: command.replace(/^\//, '') });

const UNREAD_BOX: InputBoxState = {
  kind: 'unknown',
  reason: message("Agentico can't find the Agent's input box on screen."),
};

/** Why the box cannot take a command now; null when it reads as empty. */
function boxRefusal(request: SettingChangeRequest): SettingChangePlan | null {
  const { policy, screen, activity } = request;
  const state = policy && screen ? detectInputBox(screen, policy) : UNREAD_BOX;
  const decision = preSendCheck(state, activity);
  if (decision.kind === 'send') return null;
  if (decision.kind === 'holdBlocked' || !policy) return refuse({ kind: 'agentBlocked' });
  return refuse({ kind: 'inputNotReady', reason: holdReason(decision.state, policy) });
}

export function planSettingChange(request: SettingChangeRequest): SettingChangePlan {
  const { setting, value, activity, policy } = request;
  const { apply } = setting;
  if (apply.kind === 'none') return unavailable(SETTING_READ_ONLY_KEY);
  if (activity === 'blocked') return refuse({ kind: 'agentBlocked' });
  if (apply.kind === 'terminal') {
    const shortcut = programCommands(request.program).find((c) => c.command === apply.command);
    if (!shortcut) return unavailable(SETTING_READ_ONLY_KEY);
    return { kind: 'openTerminal', draft: commandShortcutDraft(shortcut, 'terminal', policy) };
  }
  const option = setting.options.find((candidate) => candidate.value === value);
  if (value === null || !option) return unavailable(SETTING_VALUE_NOT_OFFERED_KEY);
  // An unknown status could be a dialog; a turn the docs say nothing about waits for idle.
  if (activity === 'unknown') return awaitsIdle(apply.command);
  if (activity === 'working' && apply.whileWorking === 'refuse') return awaitsIdle(apply.command);
  const held = request.screen === undefined ? null : boxRefusal(request);
  if (held) return held;
  return {
    kind: 'send',
    draft: {
      surface: 'terminal',
      text: terminalCommandWithArguments(apply.command, value, policy),
    },
    appliesAfterTurn: activity === 'working',
    persists: option.persists ?? apply.persists,
    notes: (option.notes ?? []).map((key) => message(key)),
  };
}

/** What a planned change tells the user beside its result: when it applies, and for how long. */
export function settingChangeNotes(plan: SettingChangePlan): readonly Message[] {
  if (plan.kind !== 'send') return [];
  return [
    ...(plan.appliesAfterTurn ? [message(SETTING_AFTER_TURN_KEY)] : []),
    ...(plan.persists === 'default' ? [message(SETTING_SAVES_DEFAULT_KEY)] : []),
    ...plan.notes,
  ];
}
