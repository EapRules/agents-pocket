import { View } from 'react-native';
import { BoundedScroll } from '../primitives/BoundedScroll';
import { Icon, type IconName } from '../primitives/Icon';
import { Tappable } from '../primitives/Tappable';
import { Text } from '../primitives/Text';
import { airy } from '../theme/metrics';
import { makeStyles } from '../theme/theme';

/**
 * The panel takes at most this share of the window, so the input and the keyboard stay usable over
 * a list of dozens; its rows scroll inside it.
 */
const MAX_SHARE = 0.3;

const CLOSE_SIZE = 32;
const ROW_ICON = 20;

const useStyles = makeStyles((t) => ({
  panel: { paddingHorizontal: t.spacing.sm, paddingTop: t.spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  section: { paddingTop: t.spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
    paddingVertical: airy.stack,
    borderBottomWidth: t.metrics.hairlineWidth,
    borderBottomColor: t.colors.separator,
  },
  text: { flex: 1, minWidth: 0, gap: airy.line },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm },
  title: { flexShrink: 1 },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.4 },
  close: { width: CLOSE_SIZE, height: CLOSE_SIZE, alignItems: 'center', justifyContent: 'center' },
}));

/** One row of a Composer panel: a command, a skill, a menu action. */
export interface ComposerPanelRow {
  key: string;
  title: string;
  /** Drawn in the code face (a slash command's name). */
  monospaced?: boolean;
  /** A second line under the title, secondary ink. */
  description?: string;
  /** Beside the title, secondary ink: where picking the row takes the user ("Terminal"). */
  hint?: string;
  icon?: IconName;
  /** A checkmark, for a picker's current choice. */
  checked?: boolean;
  destructive?: boolean;
  disabled?: boolean;
  /** What a screen reader says when the title is a short form of it. */
  accessibilityLabel?: string;
  onPress: () => void;
}

export interface ComposerPanelSection {
  /** Names the section's testID, and each row's unless `rowIdPrefix` is set. */
  key: string;
  /** Each row's testID is `${rowIdPrefix}-${row.key}`; default `${idPrefix}-${key}`. */
  rowIdPrefix?: string;
  /** The heading over the rows; omitted draws only a gap before them (after the first section). */
  title?: string;
  rows: readonly ComposerPanelRow[];
}

export interface ComposerPanelProps {
  /** Pinned in the head, beside Close. */
  title: string;
  sections: readonly ComposerPanelSection[];
  closeLabel: string;
  onClose: () => void;
  /** The rows start again at their top whenever this changes (a new filter query). */
  resetKey?: string;
  /** The panel's own testID; its Close and list are `${testID}-close` and `${testID}-list`. */
  testID: string;
  /** The prefix of the sections and rows (default: the panel's testID). */
  idPrefix?: string;
}

function Heading({ title }: { title: string }) {
  return (
    <Text variant="caption" tone="secondary" semibold>
      {title.toUpperCase()}
    </Text>
  );
}

/**
 * The one panel that extends from the Composer: the `/` list and the "+", "..." and shortcuts
 * menus. A head with a title and Close, then sections of rows, scrolling inside a bounded height.
 * It is drawn in the card, never in a Modal, so the input keeps focus and the keyboard stays up.
 */
export function ComposerPanel({
  title,
  sections,
  closeLabel,
  onClose,
  resetKey,
  testID,
  idPrefix = testID,
}: ComposerPanelProps) {
  const styles = useStyles();
  const shown = sections.filter((section) => section.rows.length > 0);
  if (shown.length === 0) return null;
  return (
    <View style={styles.panel} testID={testID}>
      <View style={styles.head}>
        <Heading title={title} />
        <Tappable
          style={styles.close}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={closeLabel}
          testID={`${testID}-close`}
        >
          <Icon name="close" size={16} />
        </Tappable>
      </View>
      <BoundedScroll share={MAX_SHARE} resetKey={resetKey} spaced={false} testID={`${testID}-list`}>
        {shown.map((section, index) => (
          <View key={section.key} testID={`${idPrefix}-${section.key}-section`}>
            {index > 0 ? (
              <View style={styles.section}>
                {section.title ? <Heading title={section.title} /> : null}
              </View>
            ) : null}
            {index === 0 && section.title ? <Heading title={section.title} /> : null}
            {section.rows.map((row) => (
              <Tappable
                key={row.key}
                onPress={row.onPress}
                disabled={row.disabled}
                accessibilityRole="button"
                accessibilityLabel={
                  row.accessibilityLabel ??
                  [row.title, row.description, row.hint].filter(Boolean).join('. ')
                }
                accessibilityState={{ disabled: row.disabled ?? false, checked: row.checked }}
                style={({ pressed }) => [
                  styles.row,
                  pressed && styles.pressed,
                  row.disabled && styles.disabled,
                ]}
                testID={`${section.rowIdPrefix ?? `${idPrefix}-${section.key}`}-${row.key}`}
              >
                {row.icon ? (
                  <Icon
                    name={row.icon}
                    size={ROW_ICON}
                    color={row.destructive ? 'danger' : 'textSecondary'}
                  />
                ) : null}
                <View style={styles.text}>
                  <View style={styles.titleLine}>
                    <Text
                      variant="body"
                      monospaced={row.monospaced}
                      tone={row.destructive ? 'danger' : 'primary'}
                      style={styles.title}
                      numberOfLines={1}
                    >
                      {row.title}
                    </Text>
                    {row.hint ? (
                      <Text variant="caption" tone="secondary">
                        {row.hint}
                      </Text>
                    ) : null}
                  </View>
                  {row.description ? (
                    <Text variant="caption" tone="secondary" numberOfLines={1}>
                      {row.description}
                    </Text>
                  ) : null}
                </View>
                {row.checked ? <Icon name="check" color="accent" /> : null}
              </Tappable>
            ))}
          </View>
        ))}
      </BoundedScroll>
    </View>
  );
}
