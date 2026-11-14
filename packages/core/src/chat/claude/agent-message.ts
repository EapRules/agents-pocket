// A message another agent sent the session: a Subagent's final report ("hand-back"), a teammate's
// or a peer session's message. Claude Code records it as `<agent-message from="…">` (or
// `<teammate-message teammate_id="…">`), the hand-back framed by a harness paragraph addressed to
// the model and with every line of the report indented. What the user reads is the report alone:
// the known frame at the start and the indentation go, anything unrecognized stays.

import { notice } from '../model/factories';
import { capPreview, PREVIEW_EXPANDED_LIMITS } from '../model/preview';
import type { ChatEntry, ChatEntryContent, ChatMessageSender } from '../model/types';
import { attribute } from './text';

export interface ClaudeAgentMessage {
  /** The sender as the record names it: a Subagent's id, a teammate's or a session's name. */
  from: string | null;
  /** The message, frame and indentation stripped when the frame is the known one. */
  text: string;
  /** A Subagent's final report, framed by the harness. */
  isHandBack: boolean;
}

const HAND_BACK_OPENER = '[Subagent hand-back] ';
const HAND_BACK_CLOSER = 'The report follows:';
const INDENT = '  ';

/**
 * The report under the harness frame, its added indentation removed; null when the text does not
 * start with the known frame line. Only the first line (the frame) and the two-space indent each
 * line carries are dropped: never a line from the middle.
 */
export function handBackReport(content: string): string | null {
  const text = content.replace(/^\n+/, '');
  if (!text.startsWith(HAND_BACK_OPENER)) return null;
  const newline = text.indexOf('\n');
  const frame = newline < 0 ? text : text.slice(0, newline);
  if (!frame.trimEnd().endsWith(HAND_BACK_CLOSER)) return null;
  if (newline < 0) return '';
  const lines = text.slice(newline + 1).split('\n');
  return lines
    .map((line) => (line.startsWith(INDENT) ? line.slice(INDENT.length) : line.trimEnd()))
    .join('\n')
    .trim();
}

/** The message an opening tag and its content hold. */
export function agentMessage(
  openingTag: string,
  content: string,
  senderAttribute: 'from' | 'teammate_id' = 'from',
): ClaudeAgentMessage {
  const report = handBackReport(content);
  return {
    from: attribute(senderAttribute, openingTag),
    text: report ?? content.trim(),
    isHandBack: report !== null,
  };
}

const AGENT_TAG = 'agent-message';

/**
 * The `<agent-message>` blocks of a record. The harness closes a block at the start of a line, and
 * indents every line of a report, so a closing tag the report itself quotes never ends it: the
 * first closing tag at column zero does. A block with none ends at the first closing tag anywhere.
 */
export function agentMessageBlocks(text: string): ClaudeAgentMessage[] {
  const messages: ClaudeAgentMessage[] = [];
  const close = `</${AGENT_TAG}>`;
  let searchStart = 0;
  for (;;) {
    const open = text.indexOf(`<${AGENT_TAG}`, searchStart);
    if (open < 0) break;
    const after = text.charAt(open + AGENT_TAG.length + 1);
    if (after !== '>' && !/\s/u.test(after)) {
      searchStart = open + AGENT_TAG.length + 1;
      continue;
    }
    const openEnd = text.indexOf('>', open);
    if (openEnd < 0) break;
    const atLineStart = text.indexOf(`\n${close}`, openEnd + 1);
    const end = atLineStart >= 0 ? atLineStart + 1 : text.indexOf(close, openEnd + 1);
    if (end < 0) break;
    messages.push(agentMessage(text.slice(open, openEnd + 1), text.slice(openEnd + 1, end)));
    searchStart = end + close.length;
  }
  return messages;
}

/** An id Claude Code gives a Subagent (hex), which says nothing to a reader. */
export const isOpaqueAgentID = (from: string): boolean => /^[0-9a-f]{12,}$/i.test(from);

/** Who sent it, as a reader knows them: the title of the Subagent call that reported the id, else a readable name. */
export function messageSender(
  message: ClaudeAgentMessage,
  entries: readonly ChatEntry[],
): ChatMessageSender {
  const { from, isHandBack } = message;
  if (from !== null) {
    for (const entry of entries) {
      if (entry.content.type !== 'tool' || entry.content.value.subagentAgentID !== from) continue;
      const title = entry.content.value.title;
      return { name: title === '' ? null : title, isSubagent: true };
    }
  }
  const opaque = from === null || isOpaqueAgentID(from);
  return { name: opaque ? null : from, isSubagent: isHandBack };
}

/**
 * The notice entry a message shows as: one line naming the sender that opens the whole message. The text
 * keeps an expanded row's limits, not a row's, so a long report reaches the sheet whole.
 */
export function agentMessageNotice(
  message: ClaudeAgentMessage,
  entries: readonly ChatEntry[],
): ChatEntryContent {
  const from = messageSender(message, entries);
  const detail =
    message.text === '' ? null : capPreview(message.text, 0, PREVIEW_EXPANDED_LIMITS).text;
  const value = notice('agentMessage', from.name ?? '', { detail, detailFormat: 'markdown', from });
  return { type: 'notice', value };
}
