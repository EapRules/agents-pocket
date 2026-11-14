import type { AttachStatus } from '@openagentspocket/core';
import { t } from '@openagentspocket/i18n';
import { Button, type ButtonKind, Card, EmptyState, makeStyles } from '@openagentspocket/ui';
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
  // The scrim both surfaces used (Shell: `th.backdrop`): the terminal's last screen stays visible.
  layer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: th.spacing.lg,
    backgroundColor: th.backdrop,
  },
  card: { width: '100%', maxWidth: 320, alignItems: 'center' },
}));

/**
 * What a terminal says about its attach, over its canvas: a wait while it connects, the reason
 * and the surface's `actions` once it ended; nothing while live. The Agent's and the Shell's
 * terminals both draw it.
 */
export function TerminalStatus({
  status,
  actions = [],
  stopped = 'hidden',
}: {
  status: AttachStatus;
  actions?: TerminalStatusAction[];
  stopped?: 'hidden' | 'connecting';
}) {
  const styles = useStyles();
  if (status.kind === 'live' || (status.kind === 'stopped' && stopped === 'hidden')) return null;
  const ended = status.kind === 'ended';
  return (
    <View style={[StyleSheet.absoluteFill, styles.layer]} testID="terminal-status">
      <Card level="overlay" style={styles.card}>
        <EmptyState
          layout="compact"
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
      </Card>
    </View>
  );
}
