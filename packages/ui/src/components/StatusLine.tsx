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
  if (open === undefined)
    return (
      <View style={styles.line} accessible accessibilityLabel={spoken} testID={testID}>
        {body}
      </View>
    );
  return (
    <Tappable
      style={styles.line}
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
}
