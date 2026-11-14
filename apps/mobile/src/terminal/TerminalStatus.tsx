import type { AttachStatus } from '@openagentspocket/core';
import { t } from '@openagentspocket/i18n';
import { Button, type ButtonKind, EmptyState, makeStyles } from '@openagentspocket/ui';
import { StyleSheet, View } from 'react-native';
import { renderMessage } from '@/lib/renderText';

/** One button under an ended terminal's message; each surface passes its own. */
export interface TerminalStatusAction {
  title: string;
  onPress: () => void;
  kind?: ButtonKind;
  testID?: string;
}

const useStyles = makeStyles((th) => ({
  layer: { backgroundColor: th.colors.canvas },
}));

/**
 * What a terminal says about its attach, over its canvas: a wait while it connects, the reason
 * and the surface's `actions` once it ended; nothing while live. The Agent's and the Shell's
 * terminals both draw it.
 */
export function TerminalStatus({
  status,
  actions = [],
}: {
  status: AttachStatus;
  actions?: TerminalStatusAction[];
}) {
  const styles = useStyles();
  if (status.kind === 'live' || status.kind === 'stopped') return null;
  const ended = status.kind === 'ended';
  return (
    <View style={[StyleSheet.absoluteFill, styles.layer]} testID="terminal-status">
      <EmptyState
        busy={!ended}
        icon="warning"
        title={
          ended
            ? t('Terminal Closed')
            : status.kind === 'reconnecting'
              ? t('Reconnecting…')
              : t('Connecting…')
        }
        message={ended ? renderMessage(status.message) : undefined}
        testID={ended ? 'terminal-ended' : 'terminal-connecting'}
        actions={
          ended
            ? actions.map((action) => (
                <Button
                  key={action.title}
                  kind={action.kind}
                  title={action.title}
                  onPress={action.onPress}
                  testID={action.testID}
                />
              ))
            : undefined
        }
      />
    </View>
  );
}
