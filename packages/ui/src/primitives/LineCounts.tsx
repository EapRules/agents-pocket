import { View } from 'react-native';
import { makeStyles } from '../theme/theme';
import { Text, type TextVariant } from './Text';

const useStyles = makeStyles((t) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.xxs },
}));

interface LineCountsProps {
  added?: number | null;
  removed?: number | null;
  /** The type size of both numbers. */
  size?: Extract<TextVariant, 'caption' | 'footnote' | 'subheadline'>;
  /** Semibold digits, for rows where the totals are the point. */
  semibold?: boolean;
  /** Draws "+0 −0" too; by default a zero side is left out and two zeros draw nothing. */
  showZero?: boolean;
  testID?: string;
}

/** "+12 −3": lines added in green, lines removed in red, with the true minus sign and fixed-width digits. */
export function LineCounts({
  added,
  removed,
  size = 'footnote',
  semibold,
  showZero,
  testID,
}: LineCountsProps) {
  const styles = useStyles();
  const showAdded = showZero ? added !== undefined && added !== null : Boolean(added);
  const showRemoved = showZero ? removed !== undefined && removed !== null : Boolean(removed);
  if (!showAdded && !showRemoved) return null;
  return (
    <View style={styles.row} testID={testID}>
      {showAdded ? (
        <Text variant={size} monospaced semibold={semibold} tabularNums tone="success">
          {`+${added}`}
        </Text>
      ) : null}
      {showRemoved ? (
        <Text variant={size} monospaced semibold={semibold} tabularNums tone="danger">
          {`−${removed}`}
        </Text>
      ) : null}
    </View>
  );
}
