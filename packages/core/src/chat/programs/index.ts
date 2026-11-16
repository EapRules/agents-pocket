import { claudeProgram } from '../claude/definition';
import { codexProgram } from '../codex/definition';
import { grokProgram } from '../grok/definition';
import { hermesProgram } from '../hermes/definition';
import { openCodeProgram } from '../opencode/definition';
import { piProgram } from '../pi/definition';
import { provideProgramDefinitions } from './registry';

export { footerCovered, readAgentMode } from './agent-mode';
export type { ProgramDefinition } from './definition';
export { modeLabel, type ProgramModes, readProgramMode } from './modes';
export {
  messageJumpProfile,
  type ProgramCommand,
  programCommands,
  programDefinition,
  programDefinitions,
  programModes,
  programSettings,
  programShortcuts,
  readsSubagentTranscripts,
} from './registry';
export {
  planSettingChange,
  SETTING_AFTER_TURN_KEY,
  SETTING_READ_ONLY_KEY,
  SETTING_SAVES_DEFAULT_KEY,
  SETTING_VALUE_NOT_OFFERED_KEY,
  type SettingChangePlan,
  type SettingChangeRequest,
  settingChangeNotes,
} from './setting-change';
export {
  type ConversationSetting,
  type ProgramSetting,
  type ProgramSettingID,
  type ProgramSettingOption,
  readConversationSettings,
  readSetting,
  type SettingApply,
  type SettingPersistence,
  type SettingRead,
  type SettingReadInput,
  type SettingValue,
} from './settings';
export {
  COMMON_SHORTCUTS,
  type CommandArgument,
  type CommandPlace,
  commandShortcut,
  keysShortcut,
  menuCommand,
  type ProgramShortcut,
} from './shortcuts';
export { type TerminalWait, terminalWaitOn } from './terminal-waits';

provideProgramDefinitions({
  claude: claudeProgram,
  codex: codexProgram,
  pi: piProgram('pi', 'Pi'),
  omp: piProgram('omp', 'Oh My Pi'),
  grok: grokProgram,
  opencode: openCodeProgram,
  hermes: hermesProgram,
});
