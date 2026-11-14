// A notice row of the conversation: the harness, a command's output, a message another agent sent.

import type { ChatQuestion } from './types';

export type NoticeKind =
  | 'command'
  | 'shellCommand'
  | 'pythonCommand'
  | 'taskNotification'
  | 'interrupted'
  | 'stopped'
  | 'error'
  | 'modelChange'
  | 'planMode'
  | 'hook'
  | 'review'
  | 'answered'
  | 'system'
  /** A message another agent sent: one quiet line that opens it (`from` says who). */
  | 'agentMessage';

/** Who sent an `agentMessage` notice. */
export interface ChatMessageSender {
  /** A Subagent's title, a teammate's or a session's name; null when the record names none a reader would know. */
  name: string | null;
  /** A Subagent this conversation launched, handing back its report. */
  isSubagent: boolean;
}

export interface ChatNotice {
  kind: NoticeKind;
  title: string;
  detail: string | null;
  /** `markdown` when `detail` is markdown, such as a local command's output the program recorded so; absent for plain text. */
  detailFormat?: 'markdown';
  rawDetail: string | null;
  questions: ChatQuestion[];
  /** The sender of an `agentMessage` notice, whose whole text is `detail`; absent otherwise. */
  from?: ChatMessageSender;
}
