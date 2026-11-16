import { programSettings } from '@openagentspocket/core';
import { useCallback, useState } from 'react';
import type { AgentComposer } from '../composer/composerContext';
import { useConversationSettingsAsks } from '../detailUi';
import { ConversationSettingsSheet } from './ConversationSettingsSheet';
import { useConversationSettings } from './useConversationSettings';
import { useSettingChange } from './useSettingChange';

interface Props {
  composer: AgentComposer;
  program: string;
  /** To the terminal in Compose, where a picker's draft waits for the user's Send. */
  onToTerminal: () => void;
}

/**
 * The conversation settings sheet, owned by the dock so either surface's menu can ask for it
 * (`useOpenConversationSettings`). Nothing for a program that lists no settings.
 */
export function ConversationSettingsHost({ composer, program, onToTerminal }: Props) {
  const [open, setOpen] = useState(false);
  const show = useCallback(() => setOpen(true), []);
  useConversationSettingsAsks(show);
  const status = composer.snapshot.status;
  const settings = useConversationSettings(composer.hostId, composer.paneId, program, open, status);
  const close = () => setOpen(false);
  const change = useSettingChange({ composer, program, onToTerminal, onDone: close });
  if (programSettings(program).length === 0) return null;
  return (
    <ConversationSettingsSheet
      visible={open}
      onClose={() => {
        change.cancel();
        close();
      }}
      settings={settings}
      change={change}
    />
  );
}
