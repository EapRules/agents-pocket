import { View } from 'react-native';
import { Markdown } from '../markdown/Markdown';
import { Sheet } from '../overlay/Sheet';
import { Text } from '../primitives/Text';
import { makeStyles } from '../theme/theme';

const useStyles = makeStyles((t) => ({
  body: { gap: t.spacing.sm, paddingBottom: t.spacing.md },
  from: { flexDirection: 'row', gap: t.spacing.xxs, flexWrap: 'wrap' },
}));

interface ChatMessageSheetProps {
  visible: boolean;
  onClose: () => void;
  onDismissed?: () => void;
  /** "Message". */
  title: string;
  /** "From:". */
  fromLabel: string;
  /** Who sent it: a Subagent's title, a teammate's name. */
  sender: string;
  /** The message, as markdown. */
  text: string;
  doneLabel: string;
  /** Copies the whole message; the bar shows it when given. */
  copy?: { label: string; onPress: () => void };
  testID?: string;
}

/**
 * A message another agent sent, opened from its one line in the conversation: who sent it and the
 * whole message rendered, scrolling past the sheet's height, with Done and Copy in the bar.
 */
export function ChatMessageSheet({
  visible,
  onClose,
  onDismissed,
  title,
  fromLabel,
  sender,
  text,
  doneLabel,
  copy,
  testID = 'chat-message-sheet',
}: ChatMessageSheetProps) {
  const styles = useStyles();
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      onDismissed={onDismissed}
      title={title}
      detent="large"
      leading={{ label: doneLabel, onPress: onClose, testID: `${testID}-done` }}
      trailing={copy ? { ...copy, testID: `${testID}-copy` } : undefined}
      testID={testID}
    >
      <View style={styles.body}>
        <View style={styles.from}>
          <Text variant="subheadline" tone="secondary">
            {fromLabel}
          </Text>
          <Text variant="subheadline" semibold testID={`${testID}-from`}>
            {sender}
          </Text>
        </View>
        <Markdown text={text} />
      </View>
    </Sheet>
  );
}
