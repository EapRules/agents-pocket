import type { PoolEntry } from '@openagentspocket/core';
import { t } from '@openagentspocket/i18n';
import { makeStyles, TerminalView, useAttachedTerminal } from '@openagentspocket/ui';
import { useSyncExternalStore } from 'react';
import { View } from 'react-native';
import { TerminalGestures } from '@/terminal/TerminalGestures';
import { TerminalPasteReview } from '@/terminal/TerminalPasteReview';
import { TerminalStatus } from '@/terminal/TerminalStatus';

const useStyles = makeStyles(() => ({
  fill: { flex: 1 },
}));

/**
 * The shell's terminal view, its connection overlay and its Review Paste sheet. The view is keyed
 * by pipeline surface.
 */
export function ShellSurface({ entry }: { entry: PoolEntry }) {
  const styles = useStyles();
  const { store } = entry;
  // A replacement pipeline (Host generation, take over) is a new surface and a new view.
  useSyncExternalStore(store.subscribe, store.getVersion);
  const terminal = useAttachedTerminal(store.terminal);
  return (
    <View style={styles.fill} testID="shell-terminal">
      <TerminalGestures touchScroll={store.touchScroll}>
        {(fontSize) => (
          <TerminalView
            key={terminal.snapshot.surfaceId}
            accessibilityLabel={t('Terminal')}
            testID="shell-terminal-view"
            fontSize={fontSize}
            {...terminal.viewProps}
          />
        )}
      </TerminalGestures>
      <TerminalStatus
        status={terminal.snapshot.status}
        stopped="connecting"
        actions={[
          { title: t('Reattach'), onPress: () => store.retryTerminal() },
          { title: t('Take Over'), kind: 'secondary', onPress: () => store.takeOverTerminal() },
        ]}
      />
      <TerminalPasteReview input={store.input} />
    </View>
  );
}
