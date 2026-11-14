// Background Work in Chat's model (Swift ChatBackgroundWorkItem): the Subagents, Workflows and
// background commands a transcript launches, how each ended, and what a task notice says of one.
// Re-exported by `types.ts`.

/** What a task notification says about the work it announces, so Background Work can attach it. */
export interface ChatNoticeTask {
  /** The tool call that launched the work, when the notice names it. */
  callID: string | null;
  /** The program's id for the work: a Subagent's agent id, a background command's task id. */
  taskID: string | null;
  /** What the work is, when the notice says. */
  kind: BackgroundWorkKind | null;
  state: BackgroundWorkState;
  /** What the notice calls the work ("Build the app"), when it quotes it. */
  label: string | null;
  exitCode: number | null;
}

/** `command`: a shell command the program runs in the background (this port's; goldens leave it out). */
export type BackgroundWorkKind = 'subagent' | 'workflow' | 'command';
export type BackgroundWorkState = 'running' | 'completed' | 'failed' | 'stopped';

export interface BackgroundWorkUsage {
  tokens: number | null;
  toolUses: number | null;
  durationMilliseconds: number | null;
  agents: number | null;
  agentsDone: number | null;
  agentsFailed: number | null;
}

export interface ChatBackgroundWorkItem {
  id: string;
  kind: BackgroundWorkKind;
  title: string;
  subtitle: string | null;
  state: BackgroundWorkState;
  journalPath: string | null;
  launchOffset: number;
  endOffset: number | null;
  launchedAt: string | null;
  endedAt: string | null;
  usage: BackgroundWorkUsage | null;
  /** A Subagent's id (its notifications' task id, its transcript's name); null for a Workflow or an id unsafe as a path. */
  agentID: string | null;
  /** The latest resume of a Subagent that ended; its state, end and usage are that run's. */
  resume: ChatBackgroundWorkResume | null;
  /** What the launch asked a Subagent to do, as markdown. This port's, like `exitCode` and `taskID`. */
  prompt?: string | null;
  /** How a background command exited, when its end says. */
  exitCode?: number | null;
  /** The program's id for a background command, which a notification naming no call names. */
  taskID?: string | null;
}

/** A Subagent continued after it ended (Claude Code `SendMessage` naming it), running again. */
export interface ChatBackgroundWorkResume {
  /** The resuming call, which the notification ending this run names. */
  callID: string;
  offset: number;
  resumedAt: string | null;
}

/** What the loaded lines say about one Subagent beyond its launch, by its id. */
export interface ChatBackgroundWorkAgent {
  /** Its latest resume in the loaded lines, and the end of that run there, if any. */
  resume: ChatBackgroundWorkResume | null;
  resumeEnd: ChatBackgroundWorkEnd | null;
  /** Notifications naming only the agent, no tool call, oldest first. */
  notifications: ChatBackgroundWorkEnd[];
}

export interface ChatBackgroundWorkEnd {
  state: BackgroundWorkState;
  offset: number;
  endedAt: string | null;
  usage: BackgroundWorkUsage | null;
  /** How a background command exited, when the end says. This port's. */
  exitCode?: number | null;
}
