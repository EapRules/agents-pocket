import {
  DPAD_KEYS,
  leadingKeys,
  type QuickKey,
  quickKeyId,
  type TerminalKeyboardControl,
  type ToolbarConfiguration,
  type ToolbarKey,
  toolbarQuickKey,
  trailingKeys,
} from '@openagentspocket/core';
import { t } from '@openagentspocket/i18n';
import { Icon, type IconName, makeStyles, Tappable, Text } from '@openagentspocket/ui';
import { type ReactNode, useSyncExternalStore } from 'react';
import { type GestureResponderEvent, ScrollView, View } from 'react-native';
import { keySpec, spokenName } from './keyTables';

const useStyles = makeStyles((th) => ({
  band: { alignItems: 'center', paddingVertical: th.spacing.xs, paddingHorizontal: th.spacing.md },
  // One capsule: the leading slot and the actions stay pinned, the keys scroll between them.
  capsule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: th.spacing.xxs,
    padding: th.spacing.xxs,
    maxWidth: '100%',
    overflow: 'hidden',
    borderRadius: th.radius.capsule,
    backgroundColor: th.colors.surfaceOverlay,
    borderWidth: th.metrics.hairlineWidth,
    borderColor: th.hairline,
  },
  keys: { flexGrow: 0, flexShrink: 1 },
  keysContent: { flexDirection: 'row', alignItems: 'center', gap: th.spacing.xxs },
  pinned: { flexDirection: 'row', alignItems: 'center', gap: th.spacing.xxs },
  leading: {
    minWidth: th.metrics.minTapSize,
    height: th.metrics.minTapSize - 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  key: {
    minWidth: th.metrics.minTapSize,
    height: th.metrics.minTapSize - 4,
    paddingHorizontal: th.spacing.sm,
    borderRadius: th.radius.capsule,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: th.colors.control,
  },
  on: { backgroundColor: th.colors.accent },
  divider: { width: th.metrics.hairlineWidth, height: 20, backgroundColor: th.hairline },
  pressed: { opacity: 0.6 },
  pad: { flexDirection: 'row', gap: th.spacing.xs, paddingBottom: th.spacing.xs },
}));

const GLYPH: Partial<Record<ToolbarKey, IconName>> = {
  dPad: 'chevronUpDown',
  keyboard: 'keyboard',
  more: 'more',
};

/** A control after the keys (to the Composer): data, so the toolbar stays generic. */
export interface ToolbarAction {
  key: string;
  icon: IconName;
  /** Says where it goes ("Show Chat"). */
  label: string;
  onPress: () => void;
  testID: string;
}

interface Props {
  keyboard: TerminalKeyboardControl;
  configuration: ToolbarConfiguration;
  onKey: (key: QuickKey) => void;
  /** The full keyboard is up (the entry then offers the system keyboard back). */
  fullKeyboardShown: boolean;
  onToggleKeyboard: () => void;
  onMore: (event: GestureResponderEvent) => void;
  dPadOpen: boolean;
  onToggleDPad: (open: boolean) => void;
  /** Pinned at the start of the capsule (the way back to Chat); the toolbar knows nothing of it. */
  leading?: ReactNode;
  /** Pinned at the trailing end of the capsule, always in view; the keys scroll between. */
  actions?: readonly ToolbarAction[];
}

/** The floating capsule: sticky Ctrl, Esc, Tab, a D-pad, the keyboard switch and More. */
export function TerminalToolbar({
  keyboard,
  configuration,
  onKey,
  fullKeyboardShown,
  onToggleKeyboard,
  onMore,
  dPadOpen,
  onToggleDPad,
  leading,
  actions = [],
}: Props) {
  const styles = useStyles();
  useSyncExternalStore(keyboard.subscribe, keyboard.getSnapshot);
  const latch = keyboard.latch('control');

  const renderKey = (key: ToolbarKey) => {
    const quick = toolbarQuickKey(key);
    const isCtrl = key === 'control';
    const active = isCtrl ? latch !== 'off' : key === 'dPad' ? dPadOpen : false;
    const label = isCtrl ? 'Ctrl' : quick ? keySpec(quick).label : '';
    const spoken =
      key === 'dPad'
        ? t('D-pad')
        : key === 'keyboard'
          ? fullKeyboardShown
            ? t('iOS Keyboard')
            : t('Full Keyboard')
          : key === 'more'
            ? t('More')
            : isCtrl
              ? t('Control modifier')
              : quick
                ? spokenName(quick)
                : label;
    const press = (event: GestureResponderEvent) => {
      if (isCtrl) keyboard.toggleModifier('control');
      else if (key === 'dPad') onToggleDPad(!dPadOpen);
      else if (key === 'keyboard') onToggleKeyboard();
      else if (key === 'more') onMore(event);
      else if (quick) onKey(quick);
    };
    const glyph = GLYPH[key];
    return (
      <Tappable
        key={key}
        onPress={press}
        onLongPress={isCtrl ? () => keyboard.lockModifier('control') : undefined}
        accessibilityRole="button"
        accessibilityLabel={spoken}
        accessibilityValue={isCtrl ? { text: latch } : undefined}
        accessibilityState={{ selected: active }}
        style={({ pressed }) => [styles.key, active && styles.on, pressed && styles.pressed]}
        testID={`toolbar-${key}`}
      >
        {glyph ? (
          <Icon name={glyph} size={16} color={active ? 'onAccent' : 'textPrimary'} />
        ) : (
          <Text variant="callout" tone={active ? 'onAccent' : 'primary'}>
            {label}
          </Text>
        )}
      </Tappable>
    );
  };

  return (
    <View style={styles.band} testID="terminal-toolbar">
      {dPadOpen && configuration.showsDPad ? (
        <View style={styles.pad} accessibilityLabel={t('Arrow keys and Enter')} testID="dpad-pad">
          {DPAD_KEYS.map((key) => {
            const spec = keySpec(key);
            return (
              <Tappable
                key={quickKeyId(key)}
                onPress={() => onKey(key)}
                accessibilityRole="keyboardkey"
                accessibilityLabel={spec.accessibilityLabel}
                style={({ pressed }) => [styles.key, pressed && styles.pressed]}
                testID={`dpad-${quickKeyId(key)}`}
              >
                {spec.icon ? (
                  <Icon name={spec.icon} size={16} color="textPrimary" />
                ) : (
                  <Icon name="send" size={16} color="textPrimary" />
                )}
              </Tappable>
            );
          })}
        </View>
      ) : null}
      <View style={styles.capsule}>
        {leading ? <View style={styles.leading}>{leading}</View> : null}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="always"
          style={styles.keys}
          contentContainerStyle={styles.keysContent}
        >
          {leadingKeys(configuration).map(renderKey)}
          <View style={styles.divider} />
          {trailingKeys(configuration).map(renderKey)}
        </ScrollView>
        {actions.length ? (
          <>
            <View style={styles.divider} />
            <View style={styles.pinned}>
              {actions.map((action) => (
                <Tappable
                  key={action.key}
                  onPress={action.onPress}
                  accessibilityRole="button"
                  accessibilityLabel={action.label}
                  style={({ pressed }) => [styles.key, pressed && styles.pressed]}
                  testID={action.testID}
                >
                  <Icon name={action.icon} size={16} color="textPrimary" />
                </Tappable>
              ))}
            </View>
          </>
        ) : null}
      </View>
    </View>
  );
}
