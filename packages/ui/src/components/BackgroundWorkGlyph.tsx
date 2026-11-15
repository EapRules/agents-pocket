import { View } from 'react-native';
import { Icon, type IconName } from '../primitives/Icon';
import { Spinner } from '../primitives/Spinner';
import { StatusDot } from '../primitives/StatusDot';
import { makeStyles } from '../theme/theme';

/** How a piece of work stands, as the view says it (the core presentation's statuses). */
export type BackgroundWorkState =
  | 'running'
  | 'unconfirmed'
  | 'quiet'
  | 'completed'
  | 'failed'
  | 'stopped';

/** The status line's state: the Agent working, waiting on the user or idle, or its work's. */
export type StatusLineState = BackgroundWorkState | 'working' | 'waiting' | 'idle';

const GLYPHS: Partial<Record<StatusLineState, IconName>> = {
  unconfirmed: 'clock',
  quiet: 'clock',
  completed: 'check',
  failed: 'errorCircle',
  stopped: 'stop',
  waiting: 'hand',
};

/** Width of the leading glyph column. */
const LEAD = 18;

const useStyles = makeStyles(() => ({
  lead: { width: LEAD, alignItems: 'center' },
}));

/** A row's state as tool rows draw theirs; the label says it in words. */
export function BackgroundWorkGlyph({ state }: { state: StatusLineState }) {
  const styles = useStyles();
  const icon = GLYPHS[state];
  return (
    <View style={styles.lead} accessibilityElementsHidden importantForAccessibility="no">
      {state === 'working' || state === 'idle' ? (
        <StatusDot status={state} pulse={state === 'working'} />
      ) : icon === undefined ? (
        <Spinner size="small" testID="work-spinner" />
      ) : (
        <Icon
          name={icon}
          size={14}
          color={state === 'failed' ? 'danger' : state === 'waiting' ? 'warning' : 'textSecondary'}
          testID={`work-glyph-${state}`}
        />
      )}
    </View>
  );
}
