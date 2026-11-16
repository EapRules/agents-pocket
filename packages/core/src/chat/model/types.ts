// Program-agnostic chat timeline model (ported from Swift ChatTranscript, ChatMessages,
// ChatInteractions, ChatToolActivity, ChatBackgroundWorkItem). Absent optionals are `null`, as in
// the Swift goldens, so a persisted entry round-trips through JSON unchanged. Dates are ISO 8601
// strings with milliseconds.

import type {
  ChatBackgroundWorkAgent,
  ChatBackgroundWorkEnd,
  ChatBackgroundWorkItem,
} from './background-work-types';
import type { ChatNotice } from './notice-types';

export type * from './background-work-types';

export const CHAT_PROGRAMS = [
  'claude',
  'codex',
  'pi',
  'omp',
  'grok',
  'opencode',
  'hermes',
] as const;
export type ChatProgram = (typeof CHAT_PROGRAMS)[number];

/** What herdr last reported the Agent doing; reducers need it to tell running tools from lost ones. */
export type ChatAgentActivity = 'idle' | 'working' | 'blocked' | 'unknown';

export interface ChatCommandInvocation {
  name: string;
  arguments: string;
}

export interface ChatUserMessage {
  text: string;
  imageCount: number;
  attachmentLabels: string[];
  command: ChatCommandInvocation | null;
  wasQueued: boolean;
}

export interface ChatAssistantMessage {
  text: string;
}

export interface ChatReasoning {
  text: string;
  durationMilliseconds: number | null;
}

export interface ChatSubagentActivity {
  agentPath: string | null;
  events: string[];
}

export type ToolKind =
  | 'command'
  | 'fileEdit'
  | 'fileWrite'
  | 'fileRead'
  | 'search'
  | 'listing'
  | 'web'
  | 'agent'
  | 'question'
  | 'todo'
  | 'mcp'
  | 'image'
  | 'other';

export type ToolStatus =
  | 'running'
  | 'awaitingApproval'
  | 'succeeded'
  | 'failed'
  | 'declined'
  | 'interrupted'
  | 'notCompleted'
  | 'noResult'
  | 'started'
  | 'chatInstead';

export type CardAnswer = 'allowed' | 'stopped';

export type OutputRead =
  | { loading: true }
  | { read: true }
  | { failed: string }
  | { unavailable: string };

export interface ChatDiffStats {
  added: number;
  removed: number;
  files: number;
}

export interface ChatDiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: string[];
}

export type FileChangeKind = 'updated' | 'created' | 'deleted' | 'written';

export interface ChatFileChange {
  path: string;
  kind: FileChangeKind;
  added: number;
  removed: number;
  lineCount: number;
  hunks: ChatDiffHunk[];
  isLineCut: boolean;
}

export interface ChatFileChanges {
  files: ChatFileChange[];
  moreFiles: number;
  directory: string | null;
  isShared: boolean;
  isUnavailable: boolean;
  isSkipped: boolean;
  movesWorkingTree: boolean;
}

export interface ChatToolPreview {
  text: string;
  isTruncated: boolean;
  imageCount: number;
}

export interface ChatOutputReference {
  path: string | null;
  offset: number;
  length: number;
}

export interface ChatQuestionOption {
  label: string;
  detail: string | null;
}

export interface ChatQuestion {
  id: string | null;
  header: string | null;
  text: string;
  options: ChatQuestionOption[];
  isMultiSelect: boolean;
  recommendedIndex: number | null;
  answer: string | null;
  queuedAnswer: string | null;
}

export interface ChatToolActivity {
  subagentActivity: ChatSubagentActivity | null;
  subagentAgentID: string | null;
  imagePath: string | null;
  kind: ToolKind;
  name: string;
  title: string;
  subtitle: string | null;
  /**
   * What the call is for, in the program's own words (a shell command's description), which the
   * row shows as its title. Null when the program records none. This port's: goldens leave it out.
   */
  purpose: string | null;
  /** The command line as run, when the title is not it (it is the purpose). This port's, like `purpose`. */
  command: string | null;
  status: ToolStatus;
  note: string | null;
  diff: ChatDiffStats | null;
  fileChanges: ChatFileChanges | null;
  exitCode: number | null;
  questions: ChatQuestion[];
  callID: string | null;
  /** Start of the output; held in memory only (the cache drops it). */
  preview: ChatToolPreview | null;
  output: ChatOutputReference | null;
  cardAnswer: CardAnswer | null;
  outputRead: OutputRead | null;
  isNotUpdating: boolean;
}

export interface ChatPlan {
  text: string;
  filePath: string | null;
  status: ToolStatus;
  note: string | null;
  callID: string | null;
  cardAnswer: CardAnswer | null;
}

export interface ChatQuestionSet {
  questions: ChatQuestion[];
}

export type { ChatMessageSender, ChatNotice, NoticeKind } from './notice-types';

export interface ChatDivider {
  kind: 'compaction' | 'historyUnavailable';
  detail: string | null;
}

export type ChatEntryContent =
  | { type: 'user'; value: ChatUserMessage }
  | { type: 'assistant'; value: ChatAssistantMessage }
  | { type: 'reasoning'; value: ChatReasoning }
  | { type: 'tool'; value: ChatToolActivity }
  | { type: 'plan'; value: ChatPlan }
  | { type: 'questions'; value: ChatQuestionSet }
  | { type: 'notice'; value: ChatNotice }
  | { type: 'divider'; value: ChatDivider };

export interface ChatEntry {
  id: string;
  /** Where the line that places this entry starts in its file. */
  sourceOffset: number;
  content: ChatEntryContent;
  /**
   * An entry this port shows that the Swift app does not (it reads more of the record, such as
   * a Codex code-mode command): the Swift goldens leave it out. Absent otherwise.
   */
  isPortOnly?: true;
}

export type TurnEnding = 'completed' | 'interrupted' | 'failed';

export interface ChatTurn {
  firstEntryID: string;
  startedAt: string | null;
  endedAt: string | null;
  ending: TurnEnding | null;
}

export interface ChatTurnEnd {
  ending: TurnEnding;
  endedAt: string | null;
  duration: number | null;
}

export interface ChatTranscriptLinks {
  relocatedCwd: string | null;
  continuedInSessionID: string | null;
}

export interface ChatTranscriptDiagnostics {
  invalidLines: number;
  oversizedLines: number;
  unknownRecordTypes: ReadonlySet<string>;
}

export interface ChatPendingRequest {
  entryID: string;
  callID: string | null;
  kind: ToolKind;
  toolName: string;
  summary: string;
  detail: string | null;
  questions: ChatQuestion[];
  planFilePath: string | null;
}

export interface ChatRecordedPrompt {
  offset: number;
  text: string;
  entryID: string | null;
  pastedImagePaths: string[] | null;
}

export interface AgentContextUsage {
  usedTokens: number;
  windowTokens: number;
}

/**
 * What the conversation's own records say it ran with, as of its newest record that says so: the
 * model, the reasoning effort and the speed (Claude Code's `fast` or `standard`), in the program's
 * own words. Null where the records say nothing; a reader never guesses one.
 */
export interface ChatRecordedSettings {
  model: string | null;
  effort: string | null;
  speed: string | null;
}

export const NO_RECORDED_SETTINGS: ChatRecordedSettings = {
  model: null,
  effort: null,
  speed: null,
};

export interface ChatTranscript {
  /** Display order, oldest first. */
  entries: ChatEntry[];
  title: string | null;
  needsOlderHistory: boolean;
  pendingRequests: ChatPendingRequest[];
  recordedPrompts: ChatRecordedPrompt[];
  links: ChatTranscriptLinks;
  diagnostics: ChatTranscriptDiagnostics;
  backgroundWork: ChatBackgroundWorkItem[];
  latestPromptOffset: number | null;
  backgroundWorkEnds: Record<string, ChatBackgroundWorkEnd>;
  backgroundWorkStop: ChatBackgroundWorkEnd | null;
  /** Resumes and task-id-only notifications by Subagent id, for work launched above the loaded lines. */
  backgroundWorkAgents: Record<string, ChatBackgroundWorkAgent>;
  turns: ChatTurn[];
  precedingTurnEnd: ChatTurnEnd | null;
  /** Entries standing for something not recorded yet (a queued prompt's bubble); never cached. */
  unrecordedEntryIDs: ReadonlySet<string>;
  contextUsage: AgentContextUsage | null;
  /** This port's: what the conversation settings read (`programs/settings.ts`) takes from records. */
  recordedSettings: ChatRecordedSettings;
}

/** What a reducer needs beyond the lines. */
export interface ChatProjectionContext {
  /** Where the loaded window starts; 0 means the file's head is loaded. */
  windowStart: number;
  activity: ChatAgentActivity;
  skillNames: ReadonlySet<string>;
}

export function projectionContext(
  partial: Partial<ChatProjectionContext> = {},
): ChatProjectionContext {
  return { windowStart: 0, activity: 'unknown', skillNames: new Set(), ...partial };
}

export function emptyTranscript(): ChatTranscript {
  return {
    entries: [],
    title: null,
    needsOlderHistory: false,
    pendingRequests: [],
    recordedPrompts: [],
    links: { relocatedCwd: null, continuedInSessionID: null },
    diagnostics: { invalidLines: 0, oversizedLines: 0, unknownRecordTypes: new Set() },
    backgroundWork: [],
    latestPromptOffset: null,
    backgroundWorkEnds: {},
    backgroundWorkStop: null,
    backgroundWorkAgents: {},
    turns: [],
    precedingTurnEnd: null,
    unrecordedEntryIDs: new Set(),
    contextUsage: null,
    recordedSettings: NO_RECORDED_SETTINGS,
  };
}
