import { Children, type ReactNode } from 'react';
import { View } from 'react-native';
import { useFontScale } from '../theme/accessibility';
import { makeStyles } from '../theme/theme';

const useStyles = makeStyles((t) => ({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.xs },
  column: { gap: t.spacing.xs },
  // Each button keeps its label's width as its basis: when they do not fit side by side, the row
  // wraps to one per line, and each grows to share the width.
  cell: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', maxWidth: '100%' },
}));

interface ButtonRowProps {
  /** Buttons in reading order: the quieter answer first, the leading one last. */
  children: ReactNode;
  testID?: string;
}

/**
 * Buttons side by side that share the width, one per line when their labels do not fit or at
 * accessibility text sizes.
 */
export function ButtonRow({ children, testID }: ButtonRowProps) {
  const styles = useStyles();
  const { isAccessibilitySize } = useFontScale();
  return (
    <View style={isAccessibilitySize ? styles.column : styles.row} testID={testID}>
      {Children.toArray(children).map((child, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: the buttons are fixed in place
        <View key={index} style={isAccessibilitySize ? null : styles.cell}>
          {child}
        </View>
      ))}
    </View>
  );
}
