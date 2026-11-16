import { type ComposerStore, commandKeys, type QuickKey } from '@openagentspocket/core';
import { t } from '@openagentspocket/i18n';
import {
  ActionMenu,
  type ActionMenuItem,
  KeyboardDock,
  type KeyModifiers,
  type KeySpec,
  TerminalView,
  useAttachedTerminal,
  useContextMenu,
} from '@openagentspocket/ui';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { View } from 'react-native';
import { conversationSettingsItems } from '@/features/composer-tools/composerMenus';
import { useSettings } from '@/settings/SettingsProvider';
import { TerminalGestures } from '@/terminal/TerminalGestures';
import { TerminalPasteReview } from '@/terminal/TerminalPasteReview';
import { TerminalStatus } from '@/terminal/TerminalStatus';
import { useDetailUi, useDockSlot } from '../detailUi';
import { useConversationSettingsEntry } from '../settings/useConversationSettings';
import type { AgentTerminalSession } from './AgentTerminalSession';
import { CONTROL_KEYS, FULL_KEYBOARD, type KeyRows, keyLabel } from './keyTables';
import { TerminalToolbar, type ToolbarAction } from './TerminalToolbar';
import { useAgentTerminalSession } from './useAgentTerminalSession';
import { useTerminalTextActions } from './useTerminalTextActions';

/** Which keys sit under the terminal: the system keyboard, or one of the app's docks. */
type Keys = 'system' | 'controls' | 'full';

const DOCKS: Record<Exclude<Keys, 'system'>, KeyRows> = {
  controls: CONTROL_KEYS,
  full: FULL_KEYBOARD,
};

/** The Agent detail's terminal: attach pipeline, keys and paste, over one session. */
export function TerminalSurface({
  hostId,
  paneId,
  program,
  composer,
  onShowChat,
}: {
  hostId: string;
  paneId: string;
  program?: string | null;
  /** The Agent's Composer: what it delivers round the PTY is told to this session. */
  composer?: ComposerStore;
  /** The key toolbar's way back to Chat; without it the toolbar offers none. */
  onShowChat?: () => void;
}) {
  const session = useAgentTerminalSession(hostId, paneId);
  useEffect(
    () => (session ? composer?.bindSubmitRecorder(session.input) : undefined),
    [composer, session],
  );
  return session ? (
    <LiveTerminal
      session={session}
      hostId={hostId}
      paneId={paneId}
      program={program}
      onShowChat={onShowChat}
    />
  ) : null;
}

function LiveTerminal({
  session,
  hostId,
  paneId,
  program,
  onShowChat,
}: {
  session: AgentTerminalSession;
  hostId: string;
  paneId: string;
  program?: string | null;
  onShowChat?: () => void;
}) {
  const textActions = useTerminalTextActions(hostId, paneId, session, program);
  const settingsEntry = useConversationSettingsEntry(hostId, paneId, program ?? 'unknown');
  const router = useRouter();
  const settings = useSettings();
  const store = useSyncExternalStore(session.subscribe, session.getStore);
  const terminal = useAttachedTerminal(store);
  const [keys, setKeys] = useState<Keys>('system');
  const context = useContextMenu();
  const [dPad, setDPad] = useState(false);
  const { keyboard } = session;
  const { input, setInput } = useDetailUi();
  const configuration = {
    showsEscape: settings.toolbarEscape,
    showsTab: settings.toolbarTab,
    showsDPad: settings.toolbarDPad,
  };

  const sendKey = useCallback((key: QuickKey) => void keyboard.sendQuickKey(key), [keyboard]);
  const showKeys = (next: Keys) => {
    setKeys(next);
    if (next === 'system') terminal.handle.current?.focus();
  };
  const paste = async () => {
    const text = await Clipboard.getStringAsync();
    if (text) session.input.requestPaste(text);
  };
  const dockKey = (rows: KeyRows) => (spec: KeySpec, mods: KeyModifiers) => {
    const key = rows.lookup.get(spec.id);
    if (key)
      keyboard.sendQuickKey(key, { control: mods.ctrl, option: mods.alt, shift: mods.shift });
  };

  const items: ActionMenuItem[] = [
    ...commandKeys(configuration).map((key) => ({
      key: `cmd-${keyLabel(key)}`,
      title: keyLabel(key),
      onPress: () => sendKey(key),
    })),
    { key: 'paste', title: t('Paste'), icon: 'copy', onPress: () => void paste() },
    ...textActions.items,
    ...conversationSettingsItems(settingsEntry),
    {
      key: 'controls',
      title: t('Control Keys'),
      icon: 'keyboard',
      checked: keys === 'controls',
      onPress: () => showKeys(keys === 'controls' ? 'system' : 'controls'),
    },
    {
      key: 'customize',
      title: t('Customize Toolbar'),
      icon: 'settings',
      onPress: () => router.push({ pathname: '/settings/[page]', params: { page: 'toolbar' } }),
    },
  ];
  // The app's key rows belong to Keys mode: in Compose the Composer is the only bar.
  const dock = keys === 'system' || input === 'compose' ? null : DOCKS[keys];
  const actions: ToolbarAction[] = [
    ...(onShowChat
      ? [
          {
            key: 'chat',
            icon: 'chat' as const,
            label: t('Show Chat'),
            onPress: onShowChat,
            testID: 'surface-toggle',
          },
        ]
      : []),
    {
      key: 'compose',
      icon: 'edit',
      label: t('Show Composer'),
      onPress: () => setInput('compose'),
      testID: 'toolbar-compose',
    },
  ];

  // The toolbar is the dock's bar in Keys mode (`dockBar`); the Composer takes its place in Compose.
  useDockSlot(
    <TerminalToolbar
      keyboard={keyboard}
      configuration={configuration}
      onKey={sendKey}
      fullKeyboardShown={keys === 'full'}
      onToggleKeyboard={() => showKeys(keys === 'full' ? 'system' : 'full')}
      onMore={context.open}
      dPadOpen={dPad}
      onToggleDPad={setDPad}
      actions={actions}
    />,
  );
  return (
    <View style={{ flex: 1 }} testID="terminal-surface">
      <View style={{ flex: 1 }}>
        <TerminalGestures touchScroll={session.touchScroll}>
          {(fontSize) => (
            <TerminalView
              key={terminal.snapshot.surfaceId}
              {...terminal.viewProps}
              fontSize={fontSize}
              onInput={(data) => void keyboard.typed(data)}
              accessibilityLabel={t('Terminal')}
              testID="terminal-slot"
            />
          )}
        </TerminalGestures>
        <TerminalStatus
          status={terminal.snapshot.status}
          actions={[
            {
              title: t('Retry'),
              kind: 'secondary',
              onPress: store.retry.bind(store),
              testID: 'terminal-retry',
            },
          ]}
        />
      </View>
      {dock ? <KeyboardDock rows={dock.rows} onKey={dockKey(dock)} testID="keys-dock" /> : null}
      <ActionMenu items={items} {...context.menuProps} />
      {textActions.sheets}
      <TerminalPasteReview input={session.input} />
    </View>
  );
}
