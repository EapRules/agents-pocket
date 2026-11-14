import { type ChatLiveTurn, type ChatNotice, liveLine } from '@openagentspocket/core';
import { t } from '@openagentspocket/i18n';
import {
  ChatMessageSheet,
  ChatToolRow,
  ChatWorkingRow,
  copyToClipboard,
} from '@openagentspocket/ui';
import { useCallback, useEffect, useState } from 'react';
import { renderMessage } from '@/lib/renderText';
import { useAgentBlocked } from '../detailUi';

/** Who sent a message, as the line and the sheet name them. */
export function senderName(from: ChatNotice['from']): string {
  if (from?.name) return from.name;
  return from?.isSubagent ? t('subagent') : t('another agent');
}

/** A message another agent sent: one quiet line, "Received message from …", that opens it. */
export function ChatAgentMessageLine({
  notice,
  onOpen,
}: {
  notice: ChatNotice;
  onOpen?: (notice: ChatNotice) => void;
}) {
  return (
    <ChatToolRow
      tool={{
        icon: 'chat',
        title: t('Received message from %@', senderName(notice.from)),
        status: 'done',
      }}
      onToggle={onOpen ? () => onOpen(notice) : undefined}
      testID="chat-agent-message"
      lineTestID="chat-agent-message-open"
    />
  );
}

/** The sheet a message line opens, and the stable `open` the rows call. One per timeline. */
export function useAgentMessageSheet() {
  const [message, setMessage] = useState<ChatNotice | null>(null);
  const [visible, setVisible] = useState(false);
  const open = useCallback((notice: ChatNotice) => {
    setMessage(notice);
    setVisible(true);
  }, []);
  const text = message?.detail ?? '';
  // The content outlives `visible` until the sheet has left, so it never empties while it slides away.
  const sheet = message ? (
    <ChatMessageSheet
      visible={visible}
      onClose={() => setVisible(false)}
      onDismissed={() => setMessage(null)}
      title={t('Message')}
      fromLabel={t('From:')}
      sender={senderName(message.from)}
      text={text}
      doneLabel={t('Done')}
      copy={
        text === ''
          ? undefined
          : { label: t('Copy'), onPress: () => void copyToClipboard(text, t('Copied')) }
      }
    />
  ) : null;
  return { open, sheet };
}

/** The live line that ends the transcript while the turn runs; its time moves once a second. */
export function ChatLiveLine({ turn }: { turn: ChatLiveTurn }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const line = liveLine(turn, now, useAgentBlocked());
  return (
    <ChatWorkingRow
      text={renderMessage(line.text)}
      accessibilityLabel={renderMessage(line.accessibilityLabel)}
      waiting={line.waiting}
    />
  );
}
