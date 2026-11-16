import type { SettingKey, SettingsThemeId, SettingsValues } from '@openagentspocket/core';
import type { IconName } from '@openagentspocket/ui';

/** What a row may read to show a value or decide to appear. */
export interface SettingsContext {
  values: Readonly<SettingsValues>;
  /** "Face ID", "Touch ID" or "Passcode" when the device can authenticate; null otherwise. */
  authKind: string | null;
  version: string;
  /**
   * Over-the-air updates in this build (an official store build only) and what runs now: a short
   * value for the row ("Built In" or the update's short id) and, for an update, its date.
   */
  updates: { enabled: boolean; running: string; runningDate?: string };
  themeName: string;
  themeId: SettingsThemeId;
  /** Live values for the root rows: notification state, Host count. */
  summary: { notifications?: string; hostCount: number };
  /** Recognizer locales dictation can offer, one per device language; empty without a recognizer. */
  dictationLanguages: readonly string[];
}

type Text = (ctx: SettingsContext) => string;
interface PickerChoice {
  value: string;
  label: Text;
}
/** A secondary line; undefined draws none. */
type Subtitle = (ctx: SettingsContext) => string | undefined;
type BoolKey = { [K in SettingKey]: SettingsValues[K] extends boolean ? K : never }[SettingKey];
type NumberKey = { [K in SettingKey]: SettingsValues[K] extends number ? K : never }[SettingKey];
type ChoiceKey = { [K in SettingKey]: SettingsValues[K] extends string ? K : never }[SettingKey];

interface RowBase {
  id: string;
  title: Text;
  subtitle?: Subtitle;
  icon?: IconName;
  /** Hides the row (and an emptied section) when false. */
  when?: (ctx: SettingsContext) => boolean;
}

export type SettingsRow =
  | (RowBase & {
      kind: 'page';
      page: string;
      value?: (ctx: SettingsContext) => string | undefined;
      /** Drawn before the value: the active theme's palette dots. */
      accessory?: 'themeDots';
    })
  /** Opens another screen of the app. `route` stays null until that screen exists. */
  | (RowBase & {
      kind: 'route';
      route: string | null;
      value?: (ctx: SettingsContext) => string | undefined;
    })
  | (RowBase & { kind: 'external'; url: string })
  | (RowBase & { kind: 'info'; value: (ctx: SettingsContext) => string })
  | (RowBase & { kind: 'toggle'; key: BoolKey; requireAuth?: boolean })
  | (RowBase & {
      kind: 'picker';
      key: ChoiceKey;
      /** A fixed list, or one read from the context (choices the device only knows at run time). */
      options: readonly PickerChoice[] | ((ctx: SettingsContext) => readonly PickerChoice[]);
    })
  | (RowBase & {
      kind: 'stepper';
      key: NumberKey;
      min: number;
      max: number;
      format?: (value: number) => string;
    })
  | (RowBase & { kind: 'reset'; keys: readonly SettingKey[] })
  /** A bespoke block (theme cards, cache size, licenses) the renderer looks up by name. */
  | (RowBase & { kind: 'custom'; component: CustomComponent });

export type CustomComponent =
  | 'themePreview'
  | 'toolbarPreview'
  | 'themeCards'
  | 'terminalPalette'
  | 'agentFieldHosts'
  | 'chatSample'
  | 'chatCache'
  | 'acknowledgements'
  | 'demoMode';

export interface SettingsSection {
  id: string;
  /** Rows lay out loose (cards of their own) instead of inside one grouped card. */
  loose?: boolean;
  title?: Text;
  footer?: (ctx: SettingsContext) => string | undefined;
  rows: readonly SettingsRow[];
}

export interface SettingsPage {
  id: string;
  title: Text;
  sections: readonly SettingsSection[];
}

/** A picker row's choices in this context. */
export function pickerChoices(
  row: Extract<SettingsRow, { kind: 'picker' }>,
  ctx: SettingsContext,
): readonly PickerChoice[] {
  return typeof row.options === 'function' ? row.options(ctx) : row.options;
}

export { SETTINGS_PAGES } from './pages';
