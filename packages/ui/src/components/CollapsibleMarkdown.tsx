import { useState } from 'react';
import { View } from 'react-native';
import { Markdown } from '../markdown/Markdown';
import { Button } from '../primitives/Button';
import { makeStyles } from '../theme/theme';
import { typography } from '../theme/typography';

export interface CollapsibleMarkdownLabels {
  more: string;
  less: string;
}

const useStyles = makeStyles((t) => ({
  root: { gap: t.spacing.xxs },
  clip: { overflow: 'hidden' },
  toggle: { alignSelf: 'flex-start' },
}));

interface CollapsibleMarkdownProps {
  text: string;
  /** Body lines it shows while collapsed. */
  lines?: number;
  labels: CollapsibleMarkdownLabels;
  testID?: string;
}

/**
 * Markdown cut to a few lines with "Show More" when it runs longer (a Subagent's prompt). It
 * measures what it renders, so headings and code blocks count by their real height.
 */
export function CollapsibleMarkdown({
  text,
  lines = 6,
  labels,
  testID = 'collapsible-markdown',
}: CollapsibleMarkdownProps) {
  const styles = useStyles();
  const [open, setOpen] = useState(false);
  const [height, setHeight] = useState(0);
  const limit = typography.body.lineHeight * lines;
  const long = height > limit;
  return (
    <View style={styles.root} testID={testID}>
      <View style={[styles.clip, !open && { maxHeight: limit }]}>
        <View
          onLayout={(event) => setHeight(event.nativeEvent.layout.height)}
          testID={`${testID}-content`}
        >
          <Markdown text={text} />
        </View>
      </View>
      {long ? (
        <View style={styles.toggle}>
          <Button
            kind="text"
            size="mini"
            tight
            title={open ? labels.less : labels.more}
            onPress={() => setOpen((value) => !value)}
            testID={`${testID}-toggle`}
          />
        </View>
      ) : null}
    </View>
  );
}
