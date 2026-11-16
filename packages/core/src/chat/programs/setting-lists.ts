// Each program's conversation settings (`settings.ts`), read 2026-11-16. The app writes a setting
// only through a slash command whose documentation gives the value as its argument, with no picker;
// it never drives a picker with keys. It never writes the model: no program gives a reliable list,
// and Claude Code's `/model <name>` saves the user's default. Everything else opens the program's
// own picker in its terminal (`terminal`), or is shown only.
//
// Claude Code 2.1.325, code.claude.com/docs/en/commands, /model-config ("Adjust effort level"),
//   /fast-mode: `/effort low..xhigh|max|auto` sets the level; a level typed after it is saved as the
//   default (`max` stays session-only, `auto` clears the saved level), and one sent mid-turn applies
//   from the next message. `/fast on|off`: mid-turn it toggles at once and the running turn ends at
//   the old speed; on is saved across sessions, may switch the model to Opus, and bills usage
//   credits. `claude --help`: `--effort <level>`.
// Hermes Agent 0.23.1, hermes-agent.nousresearch.com/docs/reference/slash-commands:
//   `/reasoning <level>` with none, minimal, low, medium, high, xhigh, max, ultra (the same levels
//   `hermes chat --help` lists for `--reasoning`); `--global` persists it, the bare form's lifetime
//   and a change sent mid-turn are not documented, so it waits for idle.
// Codex 0.167, learn.chatgpt.com/docs/reference/slash-commands: `/model` and `/reasoning` "choose"
//   a value, with no documented argument form. OpenCode's `/models` and `/variants`, Pi's
//   `/thinking`, Oh My Pi's `/fast`, Grok's `/effort` and `/model`: no verified argument form.
//
// Where the value is read: Claude Code's and Codex's transcripts, OpenCode's and Hermes's stores
// (`recordedSettings`), Pi's and Oh My Pi's footer, Grok's input box border.

import { message } from '../../errors/text';
import { grokScreenModel } from '../grok/screen-model';
import { OMP_LEVELS, PI_LEVELS } from './mode-lists';
import { settingOption as option } from './setting-options';
import type { ProgramSetting, SettingApply, SettingRead } from './settings';

const records = (field: 'model' | 'effort' | 'speed'): SettingRead => ({ from: 'records', field });
const NOT_READ: SettingRead = { from: 'none' };
const terminal = (command: string): SettingApply => ({ kind: 'terminal', command });
const SHOWN_ONLY: SettingApply = { kind: 'none' };

const model = (read: SettingRead, picker: string): ProgramSetting => ({
  id: 'model',
  title: message('Model'),
  kind: 'choice',
  options: [],
  read,
  apply: terminal(picker),
});

const effort = (
  read: SettingRead,
  options: ProgramSetting['options'],
  apply: SettingApply,
): ProgramSetting => ({
  id: 'effort',
  title: message('Effort Level'),
  kind: 'choice',
  options,
  read,
  apply,
});

const onOff = (onRecorded: string[], offRecorded: string[]) => [
  option('on', 'On', { recorded: onRecorded }),
  option('off', 'Off', { recorded: offRecorded }),
];

export const CLAUDE_SETTINGS: readonly ProgramSetting[] = [
  model(records('model'), '/model'),
  effort(
    records('effort'),
    [
      option('low', 'Low'),
      option('medium', 'Medium'),
      option('high', 'High'),
      option('xhigh', 'Extra High'),
      option('max', 'Max', { persists: 'session' }),
      // Clears the saved level: the default changes too.
      option('auto', 'Auto'),
    ],
    { kind: 'command', command: '/effort', whileWorking: 'afterTurn', persists: 'default' },
  ),
  {
    id: 'fast',
    title: message('Fast Mode'),
    kind: 'toggle',
    options: onOff(['fast'], ['standard']),
    read: records('speed'),
    apply: { kind: 'command', command: '/fast', whileWorking: 'afterTurn', persists: 'default' },
  },
];

export const CODEX_SETTINGS: readonly ProgramSetting[] = [
  model(records('model'), '/model'),
  effort(records('effort'), [], SHOWN_ONLY),
];

export const OPENCODE_SETTINGS: readonly ProgramSetting[] = [
  model(records('model'), '/models'),
  effort(records('effort'), [], terminal('/variants')),
];

export const HERMES_SETTINGS: readonly ProgramSetting[] = [
  model(records('model'), '/model'),
  effort(
    NOT_READ,
    [
      option('none', 'None'),
      option('minimal', 'Minimal'),
      option('low', 'Low'),
      option('medium', 'Medium'),
      option('high', 'High'),
      option('xhigh', 'Extra High'),
      option('max', 'Max'),
      option('ultra', 'Ultra'),
    ],
    { kind: 'command', command: '/reasoning', whileWorking: 'refuse', persists: 'unstated' },
  ),
];

export const PI_SETTINGS: readonly ProgramSetting[] = [
  model(NOT_READ, '/model'),
  effort({ from: 'footer' }, PI_LEVELS, terminal('/thinking')),
];

export const OMP_SETTINGS: readonly ProgramSetting[] = [
  model(NOT_READ, '/model'),
  effort({ from: 'footer' }, OMP_LEVELS, SHOWN_ONLY),
  {
    id: 'fast',
    title: message('Fast Mode'),
    kind: 'toggle',
    options: onOff([], []),
    read: NOT_READ,
    apply: terminal('/fast'),
  },
];

export const GROK_SETTINGS: readonly ProgramSetting[] = [
  model({ from: 'screen', read: grokScreenModel }, '/model'),
  effort(NOT_READ, [], terminal('/effort')),
];
