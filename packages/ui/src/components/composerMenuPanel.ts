import { type ActionMenuItem, groupMenuItems } from '../overlay/ActionMenu';
import type { ComposerPanelSection } from './ComposerPanel';

/**
 * A Composer menu's items as panel sections, grouped the way the native menu groups them (a titled
 * `section`, a gap before Close). Picking a row runs `onPicked` first, so the panel closes, then
 * the item's own action.
 */
export function menuPanelSections(
  items: readonly ActionMenuItem[],
  onPicked: () => void,
  /** Each row's testID is `${idPrefix}-${item.key}`, whatever its group. */
  idPrefix: string,
): ComposerPanelSection[] {
  return groupMenuItems(items).map((group, index) => ({
    key: `group-${index}`,
    rowIdPrefix: idPrefix,
    title: group.title || undefined,
    rows: group.items.map((item) => ({
      key: item.key,
      title: item.title,
      description: item.subtitle,
      icon: item.icon,
      checked: item.checked,
      destructive: item.destructive,
      disabled: item.disabled,
      accessibilityLabel: item.accessibilityLabel,
      onPress: () => {
        onPicked();
        item.onPress();
      },
    })),
  }));
}
