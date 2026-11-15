import { type ReactNode, useState } from 'react';
import { Platform, View } from 'react-native';
import { composerAction } from '../composer/Composer';
import { type ActionMenuItem, isDeadMenuTrigger } from '../overlay/ActionMenu';
import { useAnchor } from '../overlay/anchors';
import { Button } from '../primitives/Button';
import { Icon, type IconName } from '../primitives/Icon';
import { Tappable } from '../primitives/Tappable';
import { ThemedTextInput } from '../primitives/ThemedTextInput';
import { rounded } from '../theme/corners';
import { makeStyles, useTheme } from '../theme/theme';
import { typography } from '../theme/typography';
import { type AgentBarLabels, defaultAgentBarLabels } from './agentBarLabels';
import { ComposerPanel } from './ComposerPanel';
import { type ComposerSkill, ComposerSuggestions } from './ComposerSuggestions';
import { menuPanelSections } from './composerMenuPanel';
import { KeyboardDismissButton } from './KeyboardDismissButton';

const CIRCLE = 40;
/** Centres one body line (22 pt) in the circle-high field. */
const LINE_PAD = (CIRCLE - typography.body.lineHeight) / 2;
/** The field grows a line at a time up to this many lines, then scrolls inside itself (chat apps do the same). */
const INPUT_MAX_LINES = 6;
const INPUT_MAX_HEIGHT = INPUT_MAX_LINES * typography.body.lineHeight + 2 * LINE_PAD;

const useStyles = makeStyles((t) => ({
  card: {
    marginHorizontal: t.spacing.sm,
    // Concentric with the circles it holds at the xs inset.
    ...rounded(CIRCLE / 2 + t.spacing.xs),
    borderWidth: t.metrics.hairlineWidth,
    borderColor: t.hairline,
    backgroundColor: t.colors.surfaceRaised,
    overflow: 'hidden',
  },
  oneLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xs,
    paddingHorizontal: t.spacing.xs,
    paddingVertical: t.spacing.xs,
  },
  // The buttons pin under the input, so it never changes parent or position in the tree: a moved
  // input would remount and lose focus, dropping the keyboard the moment the card expands.
  stack: {
    paddingHorizontal: t.spacing.xs,
    paddingTop: t.spacing.xs,
    paddingBottom: CIRCLE + 2 * t.spacing.xs,
  },
  buttons: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs },
  pinLeft: { position: 'absolute', left: t.spacing.xs, bottom: t.spacing.xs },
  pinRight: { position: 'absolute', right: t.spacing.xs, bottom: t.spacing.xs },
  circle: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.control,
  },
  // No flex here: in the stacked column `flex: 1` is basis 0 on the vertical axis, which ignores the
  // multiline field's content height and pins it at minHeight. Only the one-line row sets flexGrow.
  input: {
    minWidth: 0,
    color: t.colors.textPrimary,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    paddingVertical: LINE_PAD,
    maxHeight: INPUT_MAX_HEIGHT,
    minHeight: CIRCLE,
    textAlignVertical: 'center',
  },
  // LINE_PAD + 22 + LINE_PAD = CIRCLE: with explicit padding the multiline native field (UITextView / EditText)
  // lands the text and placeholder on the same centre line as the single-line web field.
  inputOneLine: {
    height: CIRCLE,
    paddingVertical: LINE_PAD,
    lineHeight: typography.body.lineHeight,
    textAlignVertical: 'center',
    width: 0,
    flexBasis: 0,
    flexGrow: 1,
  },
  // Height comes from the content (between minHeight and the six-line cap), width from the column.
  inputStack: { alignSelf: 'stretch', paddingHorizontal: t.spacing.xs },
  circleActive: { backgroundColor: t.colors.accentContainer },
  badge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 16,
    height: 16,
    borderRadius: t.radius.capsule,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.surfaceRaised,
  },
}));

type MenuPanel = 'add' | 'more' | 'shortcuts';

export type { ComposerSkill };

export interface ComposerCardProps {
  value: string;
  onChange: (text: string) => void;
  working?: boolean;
  /** Attachments stand for the next message, so Send works with an empty input. */
  hasAttachments?: boolean;
  onSend: () => void;
  onStop?: () => void;
  /** The agent mark circle (a ProgramMark in a 40pt circle; the caller picks the program). */
  leading?: ReactNode;
  /** Items of the + menu (Add File, Add Image). */
  addMenu?: readonly ActionMenuItem[];
  /** Items of the more menu (Paste, Snippets, Clear); shown in the expanded layout. */
  moreMenu?: readonly ActionMenuItem[];
  /** The Agent's program shortcuts (keys it presses, commands it types); after the more menu. */
  shortcutsMenu?: readonly ActionMenuItem[];
  /** The program's commands: listed first in the `/` panel, while the draft starts with "/". */
  commands?: readonly ComposerSkill[];
  onCommand?: (name: string) => void;
  /** Slash skills: listed under the commands in the same panel. */
  skills?: readonly ComposerSkill[];
  onSkill?: (name: string) => void;
  /** Forces the stacked layout; otherwise it grows once the draft has a line break or is long. */
  expanded?: boolean;
  /** The corner glyph on the agent circle: the surface the Agent is on (chat or keyboard). */
  surfaceIcon?: IconName;
  placeholder?: string;
  disabled?: boolean;
  labels?: AgentBarLabels;
  /** The key the "..." circle registers as a popover anchor. */
  moreAnchorKey?: string;
  /** A show/hide toggle for a bar above the composer (the terminal's key toolbar); omitted draws nothing. */
  barToggle?: { visible: boolean; onToggle: () => void; label: string };
  /** The input gained or lost focus: the composer is open (a surface above it may condense). */
  onFocusChange?: (focused: boolean) => void;
  /**
   * Dictation into the draft: a microphone while the draft is empty, in Send's place or beside Stop,
   * and while it listens. Omitted where the build has no recognizer.
   */
  dictation?: { listening: boolean; onToggle: () => void };
  testID?: string;
}

function Circle({
  icon,
  label,
  onPress,
  menu,
  active,
  anchorKey,
  testID,
}: {
  icon: IconName;
  label: string;
  onPress?: () => void;
  /** The items the circle opens a panel of; with none and no `onPress` the circle is not drawn. */
  menu?: readonly ActionMenuItem[];
  /** Its panel is open. */
  active?: boolean;
  /** Registers the circle as a popover anchor (`confirm({ anchorKey })`). */
  anchorKey?: string;
  testID: string;
}) {
  const styles = useStyles();
  const anchor = useAnchor(anchorKey);
  if (isDeadMenuTrigger(menu, onPress)) return null;
  return (
    <View ref={anchor} style={[styles.circle, active && styles.circleActive]}>
      <Button
        kind="text"
        neutral
        icon={icon}
        iconSize={18}
        accessibilityLabel={label}
        expanded={menu ? Boolean(active) : undefined}
        onPress={() => onPress?.()}
        testID={testID}
      />
    </View>
  );
}

/**
 * The chat composer: a rounded glass card. One line (+, agent mark, input, send or stop) until
 * the draft grows, then the input stacks over a button row. A leading slash opens the skills panel.
 */
export function ComposerCard({
  value,
  onChange,
  working = false,
  hasAttachments = false,
  onSend,
  onStop,
  leading,
  addMenu,
  moreMenu,
  shortcutsMenu,
  moreAnchorKey,
  barToggle,
  onFocusChange,
  dictation,
  commands,
  onCommand,
  skills,
  onSkill,
  expanded,
  surfaceIcon = 'note',
  placeholder,
  disabled = false,
  labels = defaultAgentBarLabels,
  testID = 'composer-card',
}: ComposerCardProps) {
  const styles = useStyles();
  const theme = useTheme();
  const [dismissed, setDismissed] = useState(false);
  const [focused, setFocused] = useState(false);
  // The one panel open at a time; the `/` list takes precedence over it.
  const [open, setOpen] = useState<MenuPanel | null>(null);
  const action = composerAction(value, working, onStop !== undefined, hasAttachments);
  const showSkills =
    Boolean(skills?.length || commands?.length) && value.startsWith('/') && !dismissed;
  const panel = showSkills ? null : open;
  // An open "..." or shortcuts panel holds the layout: their circles live in the stacked one, and
  // folding would take them away. The "+" circle is in both, so its panel leaves the layout alone.
  const stacked =
    (expanded ?? (value.includes('\n') || value.length > 36)) ||
    showSkills ||
    panel === 'more' ||
    panel === 'shortcuts';
  // Undefined for a menu with no items, so its circle is not drawn (no dead buttons).
  const toggle = (which: MenuPanel, items?: readonly ActionMenuItem[]) =>
    items?.length ? () => setOpen(panel === which ? null : which) : undefined;
  const stopInk = theme.appearance === 'dark' ? 'textPrimary' : 'onAccent';
  const hint = placeholder ?? labels.messagePlaceholder;
  const input = (
    <ThemedTextInput
      value={value}
      onChangeText={(text) => {
        if (!text.startsWith('/')) setDismissed(false);
        else setOpen(null);
        onChange(text);
      }}
      placeholder={hint}
      editable={!disabled}
      onFocus={() => {
        setFocused(true);
        onFocusChange?.(true);
      }}
      onBlur={() => {
        setFocused(false);
        onFocusChange?.(false);
      }}
      multiline={stacked || Platform.OS !== 'web'}
      style={[styles.input, stacked ? styles.inputStack : styles.inputOneLine]}
      accessibilityLabel={hint}
      testID={`${testID}-input`}
    />
  );
  const trailing =
    action === 'stop' ? (
      <Tappable
        style={[styles.circle, { backgroundColor: theme.colors.danger }]}
        onPress={() => onStop?.()}
        accessibilityRole="button"
        accessibilityLabel={labels.stop}
        testID={`${testID}-stop`}
      >
        <Icon name="stop" size={20} color={stopInk} />
      </Tappable>
    ) : (
      <Tappable
        style={[styles.circle, { backgroundColor: theme.colors.textPrimary }]}
        onPress={() => {
          setOpen(null);
          onSend();
        }}
        disabled={disabled || action !== 'send'}
        accessibilityRole="button"
        accessibilityLabel={labels.send}
        accessibilityState={{ disabled: disabled || action !== 'send' }}
        testID={`${testID}-send`}
      >
        <Icon name="send" size={18} color="canvas" />
      </Tappable>
    );
  // Text in the draft takes the microphone's place for Send; a draft dictated so far keeps it to stop.
  const empty = value.trim() === '' && !hasAttachments;
  const mic =
    dictation && (empty || dictation.listening) ? (
      <Tappable
        style={[styles.circle, dictation.listening && { backgroundColor: theme.colors.accent }]}
        onPress={dictation.onToggle}
        accessibilityRole="button"
        accessibilityLabel={dictation.listening ? labels.stopDictating : labels.dictate}
        accessibilityState={{ selected: dictation.listening }}
        testID={`${testID}-mic`}
      >
        <Icon name="mic" size={18} color={dictation.listening ? 'onAccent' : 'textPrimary'} />
      </Tappable>
    ) : null;
  const leadingMark = leading ? (
    <View style={styles.circle}>
      {leading}
      <View style={styles.badge} testID={`${testID}-surface-badge`}>
        <Icon name={surfaceIcon} size={10} color="textPrimary" />
      </View>
    </View>
  ) : null;
  const plus = (
    <Circle
      icon="add"
      label={labels.add}
      menu={addMenu}
      active={panel === 'add'}
      onPress={toggle('add', addMenu)}
      testID={`${testID}-add`}
    />
  );
  const menuFor = { add: addMenu, more: moreMenu, shortcuts: shortcutsMenu };
  const panelTitle = { add: labels.add, more: labels.moreOptions, shortcuts: labels.shortcuts };
  const panelItems = panel ? menuFor[panel] : undefined;
  return (
    <View style={styles.card} testID={testID}>
      {showSkills ? (
        <ComposerSuggestions
          sections={[
            { key: 'command', title: labels.commands, rows: commands ?? [], onPick: onCommand },
            { key: 'skill', title: labels.skills, rows: skills ?? [], onPick: onSkill },
          ]}
          query={value}
          closeLabel={labels.closeSkills}
          onClose={() => setDismissed(true)}
          testID={testID}
        />
      ) : null}
      {panel && panelItems?.length ? (
        <ComposerPanel
          title={panelTitle[panel]}
          sections={menuPanelSections(panelItems, () => setOpen(null), `${testID}-${panel}`)}
          closeLabel={labels.closePanel}
          onClose={() => setOpen(null)}
          testID={`${testID}-${panel}-panel`}
          idPrefix={`${testID}-${panel}`}
        />
      ) : null}
      <View style={stacked ? styles.stack : styles.oneLine}>
        <View style={[styles.buttons, stacked && styles.pinLeft]}>
          {plus}
          {leadingMark}
          {stacked && barToggle ? (
            <Circle
              icon="toolbar"
              label={barToggle.label}
              onPress={barToggle.onToggle}
              testID={`${testID}-bar-toggle`}
            />
          ) : null}
          {stacked && moreMenu?.length ? (
            <Circle
              icon="more"
              label={labels.moreOptions}
              menu={moreMenu}
              active={panel === 'more'}
              onPress={toggle('more', moreMenu)}
              anchorKey={moreAnchorKey}
              testID={`${testID}-more`}
            />
          ) : null}
          {stacked && shortcutsMenu?.length ? (
            <Circle
              icon="shortcuts"
              label={labels.shortcuts}
              menu={shortcutsMenu}
              active={panel === 'shortcuts'}
              onPress={toggle('shortcuts', shortcutsMenu)}
              testID={`${testID}-shortcuts`}
            />
          ) : null}
        </View>
        {input}
        <View style={[styles.buttons, stacked && styles.pinRight]}>
          {focused ? <KeyboardDismissButton label={labels.dismissKeyboard} /> : null}
          {mic}
          {mic && action === 'none' ? null : trailing}
        </View>
      </View>
    </View>
  );
}
