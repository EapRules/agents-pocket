import { Children, Fragment, isValidElement, type ReactNode } from 'react';
import { View } from 'react-native';
import { airy } from '../theme/metrics';
import type { Status } from '../theme/status';
import { makeStyles } from '../theme/theme';
import { Card, type CardLevel } from './Card';
import { ICON_SLOT } from './ListRow';
import { SectionHeader, type SectionHeaderAction } from './SectionHeader';
import { Text } from './Text';

/** Width of the leading element a row's text starts after (the hairline begins under that text). */
const LEADING_WIDTH = { icon: ICON_SLOT, dot: airy.dot, tile: 44, swatch: 54 } as const;

/** Where the hairlines start: the card edge inset (default), or past a leading element of a known size. */
export type SectionInset = keyof typeof LEADING_WIDTH;

const indent = (spacing: { md: number; sm: number }, width: number) =>
  spacing.md + width + spacing.sm;

const useStyles = makeStyles((t) => ({
  section: { gap: t.spacing.xs },
  separator: {
    height: t.metrics.hairlineWidth,
    backgroundColor: t.hairline,
    marginLeft: t.spacing.md,
  },
  footer: { paddingHorizontal: t.spacing.xxs },
  icon: { marginLeft: indent(t.spacing, LEADING_WIDTH.icon) },
  dot: { marginLeft: indent(t.spacing, LEADING_WIDTH.dot) },
  tile: { marginLeft: indent(t.spacing, LEADING_WIDTH.tile) },
  swatch: { marginLeft: indent(t.spacing, LEADING_WIDTH.swatch) },
}));

interface SectionProps {
  title?: string;
  status?: Status;
  count?: number;
  action?: SectionHeaderAction;
  /** Small print under the group (what a setting does). */
  footer?: string;
  /** Rows inside one card with hairlines between them (settings, hosts); false lays children out loose. */
  grouped?: boolean;
  /** Hairlines start past the rows' leading element: a symbol slot, status dot, 44pt tile or palette swatch. */
  inset?: SectionInset;
  level?: CardLevel;
  /** Collapsible: hides the children while false. */
  expanded?: boolean;
  onToggle?: () => void;
  children?: ReactNode;
  testID?: string;
}

/** A section header, a grouped container of rows, and an optional footer. */
export function Section({
  title,
  status,
  count,
  action,
  footer,
  grouped = true,
  inset,
  level,
  expanded,
  onToggle,
  children,
  testID,
}: SectionProps) {
  const styles = useStyles();
  const open = onToggle ? (expanded ?? false) : true;
  const rows = Children.toArray(children).filter(isValidElement);
  return (
    <View style={styles.section} testID={testID}>
      {title ? (
        <SectionHeader
          title={title}
          status={status}
          count={count}
          action={action}
          expanded={open}
          onToggle={onToggle}
          testID={testID ? `${testID}-header` : undefined}
        />
      ) : null}
      {open && rows.length > 0 ? (
        grouped ? (
          <Card padded={false} level={level}>
            {rows.map((row, index) => (
              <Fragment key={row.key ?? index}>
                {index > 0 ? (
                  <View style={[styles.separator, inset && styles[inset]]} testID="row-separator" />
                ) : null}
                {row}
              </Fragment>
            ))}
          </Card>
        ) : (
          rows
        )
      ) : null}
      {open && footer ? (
        <Text variant="footnote" tone="secondary" style={styles.footer}>
          {footer}
        </Text>
      ) : null}
    </View>
  );
}
