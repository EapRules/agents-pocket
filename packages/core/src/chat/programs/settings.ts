// The settings of an Agent's conversation (its model, reasoning effort and fast mode), one shape for
// every program. Each program lists its own in `setting-lists.ts`: what it calls each value, where
// the current one can be read and how, if at all, the app may change it. Reading is pure: it takes
// the transcript and the screen the app already holds. Changing is `planSettingChange`.

import type { AnsiScreen } from '../../blocked/screen';
import { screenText } from '../../blocked/screen';
import type { Message, Text } from '../../errors/text';
import type { ChatRecordedSettings, ChatTranscript } from '../model/types';
import { footerCovered } from './agent-mode';
import { findDrawn } from './modes';
import { programSettings } from './registry';
import type { ProgramSettingOption, SettingPersistence } from './setting-options';

export {
  type ProgramSettingOption,
  type SettingPersistence,
  settingOption,
} from './setting-options';

export type ProgramSettingID = 'model' | 'effort' | 'fast';

/** Where the current value comes from. */
export type SettingRead =
  /** The transcript's `recordedSettings`, filled by the program's own reader. */
  | { readonly from: 'records'; readonly field: keyof ChatRecordedSettings }
  /** The options' `drawn` text on the footer, as `readProgramMode` reads a mode. */
  | { readonly from: 'footer'; readonly conversationRow?: string }
  /** A reader of the program's screen. */
  | { readonly from: 'screen'; readonly read: (screen: AnsiScreen) => string | null }
  /** Nothing the app holds says it. */
  | { readonly from: 'none' };

/** How the app may change the setting. */
export type SettingApply =
  /**
   * A documented slash command that takes the value as its argument, with no picker. `whileWorking`
   * says what the documentation promises for one sent during a turn: the change waits for the
   * turn's end (`afterTurn`), or nothing is promised and the app waits for idle (`refuse`).
   */
  | {
      readonly kind: 'command';
      readonly command: string;
      readonly whileWorking: 'afterTurn' | 'refuse';
      readonly persists: SettingPersistence;
    }
  /** The program's own picker, typed into its terminal (one of its listed commands). */
  | { readonly kind: 'terminal'; readonly command: string }
  /** Shown only. */
  | { readonly kind: 'none' };

export interface ProgramSetting {
  readonly id: ProgramSettingID;
  readonly title: Message;
  /** `toggle` has exactly an `on` and an `off` option; `choice` lists the program's own values. */
  readonly kind: 'choice' | 'toggle';
  /** Empty for a value no list names (a model): a read then shows the program's own words. */
  readonly options: readonly ProgramSettingOption[];
  readonly read: SettingRead;
  readonly apply: SettingApply;
}

export type SettingValue =
  /** `option` is the listed one it matches; null for a value no option names. */
  | { readonly kind: 'known'; readonly value: string; readonly option: ProgramSettingOption | null }
  | { readonly kind: 'unknown' };

export const UNKNOWN_SETTING: SettingValue = { kind: 'unknown' };

/** What a read looks at: the Agent's conversation and its screen, each null when not loaded. */
export interface SettingReadInput {
  readonly program: string | null | undefined;
  readonly transcript: ChatTranscript | null;
  readonly screen: AnsiScreen | null;
}

function known(setting: ProgramSetting, raw: string | null): SettingValue {
  if (raw === null || raw === '') return UNKNOWN_SETTING;
  const option = setting.options.find(
    (candidate) => candidate.value === raw || candidate.recorded?.includes(raw) === true,
  );
  if (option) return { kind: 'known', value: option.value, option };
  // A toggle's state is one of its two options; another word says nothing sure.
  return setting.kind === 'toggle' ? UNKNOWN_SETTING : { kind: 'known', value: raw, option: null };
}

function footerOption(
  setting: ProgramSetting,
  screen: AnsiScreen,
  conversationRow: string | undefined,
): SettingValue {
  const drawn = setting.options.flatMap((option) =>
    (option.drawn ?? []).map((text) => ({ drawn: text, option })),
  );
  const found = findDrawn(drawn, screenText(screen), conversationRow);
  return found
    ? { kind: 'known', value: found.option.value, option: found.option }
    : UNKNOWN_SETTING;
}

/** The setting's current value; `unknown` whenever what the app holds does not say it. */
export function readSetting(setting: ProgramSetting, input: SettingReadInput): SettingValue {
  const { read } = setting;
  switch (read.from) {
    case 'records':
      return known(setting, input.transcript?.recordedSettings[read.field] ?? null);
    case 'footer':
    case 'screen': {
      const { screen } = input;
      // A dialog in the input box's place covers what the footer draws.
      if (!screen || footerCovered(input.program, screen)) return UNKNOWN_SETTING;
      return read.from === 'footer'
        ? footerOption(setting, screen, read.conversationRow)
        : known(setting, read.read(screen));
    }
    case 'none':
      return UNKNOWN_SETTING;
  }
}

export interface ConversationSetting {
  readonly setting: ProgramSetting;
  readonly value: SettingValue;
}

/**
 * `next`, where a setting it reads as unknown keeps the value `previous` knew: a read describes the
 * last reply, and a dialog over the footer hides what it showed, so neither says the value changed.
 */
export function keepLastKnown(
  previous: readonly ConversationSetting[] | null,
  next: readonly ConversationSetting[],
): readonly ConversationSetting[] {
  if (!previous) return next;
  return next.map((current) => {
    if (current.value.kind === 'known') return current;
    const before = previous.find((candidate) => candidate.setting.id === current.setting.id);
    return before?.value.kind === 'known' ? { ...current, value: before.value } : current;
  });
}

/** How a value reads: its option's title, or the program's own words; null when unknown. */
export function settingValueText(value: SettingValue): Text | null {
  if (value.kind === 'unknown') return null;
  return value.option ? value.option.title : value.value;
}

/** The known values in the program's order (`model · effort`); null when none is known. */
export function conversationSettingsSummary(settings: readonly ConversationSetting[]): Text | null {
  const known = settings.flatMap(({ value }) => {
    const text = settingValueText(value);
    return text === null ? [] : [text];
  });
  return known.length === 0 ? null : { join: known, separator: ' · ' };
}

/** Every setting the Agent's program lists, each with its current value. */
export function readConversationSettings(input: SettingReadInput): readonly ConversationSetting[] {
  return programSettings(input.program).map((setting) => ({
    setting,
    value: readSetting(setting, input),
  }));
}
