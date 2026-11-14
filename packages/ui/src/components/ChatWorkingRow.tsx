import { View } from 'react-native';
import { StatusDot } from '../primitives/StatusDot';
import { Text } from '../primitives/Text';
import { makeStyles } from '../theme/theme';

/** The glyph column of a tool line, so the live line's mark sits under the tool glyphs. */
const LINE_GLYPH = 16;

const useStyles = makeStyles((t) => ({
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xs,
    minHeight: t.metrics.minTapSize,
    paddingHorizontal: t.spacing.md,
  },
  mark: { width: LINE_GLYPH, alignItems: 'center' },
  text: { flexShrink: 1, minWidth: 0 },
}));

interface ChatWorkingRowProps {
  /** "Working… 1m 56s · pnpm test". */
  text: string;
  /** The same as VoiceOver reads it; the text when omitted. */
  accessibilityLabel?: string;
  testID?: string;
}

/**
 * The live line that ends the conversation while the Agent works: a pulsing mark (still under
 * Reduce Motion), how long the turn has worked and what it does. Quiet, in the tool lines' place.
 */
export function ChatWorkingRow({
  text,
  accessibilityLabel,
  testID = 'chat-working-row',
}: ChatWorkingRowProps) {
  const styles = useStyles();
  return (
    <View
      style={styles.line}
      accessible
      accessibilityLabel={accessibilityLabel ?? text}
      testID={testID}
    >
      <View style={styles.mark}>
        <StatusDot status="working" pulse />
      </View>
      <Text
        variant="subheadline"
        tone="secondary"
        tabularNums
        numberOfLines={1}
        style={styles.text}
      >
        {text}
      </Text>
    </View>
  );
}
