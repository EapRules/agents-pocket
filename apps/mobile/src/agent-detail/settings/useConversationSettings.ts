import {
  type AnsiScreen,
  agentKey,
  type ConversationSetting,
  conversationSettingsSummary,
  keepLastKnown,
  programSettings,
  readConversationSettings,
} from '@openagentspocket/core';
import { useEffect, useMemo, useState } from 'react';
import { useConversation } from '@/conversations/useConversation';
import { renderMessage } from '@/usage/usageText';
import { useOpenConversationSettings } from '../detailUi';
import { useAgentScreenIO } from '../useAgentScreenIO';

/** The last values each Agent's settings read as, so a read that says nothing keeps them. */
const lastKnown = new Map<string, readonly ConversationSetting[]>();

/**
 * The Agent's conversation settings as its program lists them, each with its value: from the
 * conversation's records, and from its screen while `live` (the sheet is up) and a setting reads
 * one. A value a read no longer says (a dialog over the footer) stays as last known.
 */
export function useConversationSettings(
  hostId: string,
  paneId: string,
  program: string,
  live: boolean,
  status: string,
): readonly ConversationSetting[] {
  const { state } = useConversation(hostId, paneId, live);
  const io = useAgentScreenIO(hostId, paneId);
  const readsScreen = useMemo(
    () =>
      programSettings(program).some((s) => s.read.from === 'footer' || s.read.from === 'screen'),
    [program],
  );
  const [screen, setScreen] = useState<AnsiScreen | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new status is a reason to read again.
  useEffect(() => {
    if (!live || !readsScreen) return;
    let current = true;
    io.readScreen()
      .then((read) => current && setScreen(read))
      // A screen that cannot be read leaves the last values shown.
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [live, readsScreen, io, status]);
  const transcript = state.snapshot.transcript;
  const key = agentKey(hostId, paneId);
  return useMemo(() => {
    const read = readConversationSettings({ program, transcript, screen });
    const kept = keepLastKnown(lastKnown.get(key) ?? null, read);
    lastKnown.set(key, kept);
    return kept;
  }, [program, transcript, screen, key]);
}

/**
 * The "..." menus' way to the settings sheet, with the known values as its line; undefined for a
 * program that lists no settings.
 */
export function useConversationSettingsEntry(
  hostId: string,
  paneId: string,
  program: string,
): { open: () => void; summary?: string } | undefined {
  const open = useOpenConversationSettings();
  const settings = useConversationSettings(hostId, paneId, program, false, '');
  const summary = conversationSettingsSummary(settings);
  const line = summary === null ? undefined : renderMessage(summary);
  const listed = settings.length > 0;
  return useMemo(() => (listed ? { open, summary: line } : undefined), [listed, open, line]);
}
