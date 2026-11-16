import { View } from 'react-native';
import { Tappable } from '../primitives/Tappable';
import { Text } from '../primitives/Text';
import { makeStyles } from '../theme/theme';
import { BackgroundWorkGlyph, type StatusLineState } from './BackgroundWorkGlyph';

const useStyles = makeStyles((t) => ({
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xs,
    minHeight: t.metrics.minTapSize,
    paddingHorizontal: t.spacing.md,
  },
  text: { flexShrink: 1, minWidth: 0 },
  // With a trailing control the line is a row of two siblings; the padding moves to the row.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    paddingHorizontal: t.spacing.md,
  },
  // The status keeps its words: only past the row's own width does it truncate.
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xs,
    minHeight: t.metrics.minTapSize,
    flexShrink: 0,
    maxWidth: '100%',
  },
  trailing: {
    flexShrink: 1,
    minWidth: 0,
    marginLeft: 'auto',
    minHeight: t.metrics.minTapSize,
    justifyContent: 'center',
  },
}));

export interface StatusLineProps {
  state: StatusLineState;
  /** "Working… 1m 56s · pnpm test · 1 running". */
  text: string;
  /** The same as VoiceOver reads it; the text when omitted. */
  accessibilityValue?: string;
  /**
   * Opens what the line counts: the line is then a button named `label`, read with `hint`. Without
   * it the line is plain text, read as its value.
   */
  open?: { onPress: () => void; label: string; hint: string };
  /**
   * A quiet control at the line's far end, its own button beside the status (never inside it). It
   * shrinks first and ends in an ellipsis when the row runs out of room.
   */
  trailing?: { text: string; onPress: () => void; label: string; hint?: string; testID?: string };
  testID?: string;
}

/**
 * Chat's one status line over the Composer: a mark and quiet text, no surface. The mark pulses
 * while the Agent works (still under Reduce Motion), wears the needs-you hand while it waits, and
 * while it is idle shows its Background Work's state.
 */
export function StatusLine({
  state,
  text,
  accessibilityValue,
  open,
  trailing,
  testID = 'chat-status-line',
}: StatusLineProps) {
  const styles = useStyles();
  const spoken = accessibilityValue ?? text;
  const body = (
    <>
      <BackgroundWorkGlyph state={state} />
      <Text
        variant="subheadline"
        tone={state === 'waiting' ? 'warning' : 'secondary'}
        tabularNums
        numberOfLines={1}
        style={styles.text}
      >
        {text}
      </Text>
    </>
  );
  const style = trailing ? styles.status : styles.line;
  const status =
    open === undefined ? (
      <View style={style} accessible accessibilityLabel={spoken} testID={testID}>
        {body}
      </View>
    ) : (
      <Tappable
        style={style}
        onPress={open.onPress}
        accessibilityRole="button"
        accessibilityLabel={open.label}
        accessibilityValue={{ text: spoken }}
        accessibilityHint={open.hint}
        testID={testID}
      >
        {body}
      </Tappable>
    );
  if (!trailing) return status;
  return (
    <View style={styles.row}>
      {status}
      <Tappable
        style={styles.trailing}
        onPress={trailing.onPress}
        accessibilityRole="button"
        accessibilityLabel={trailing.label}
        accessibilityValue={{ text: trailing.text }}
        accessibilityHint={trailing.hint}
        testID={trailing.testID}
      >
        <Text variant="subheadline" tone="tertiary" numberOfLines={1}>
          {trailing.text}
        </Text>
      </Tappable>
    </View>
  );
}
