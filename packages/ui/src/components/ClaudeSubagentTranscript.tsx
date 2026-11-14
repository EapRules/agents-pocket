import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Markdown } from '../markdown/Markdown';
import { Button } from '../primitives/Button';
import { EmptyState } from '../primitives/EmptyState';
import { Icon, type IconName } from '../primitives/Icon';
import { Section } from '../primitives/Section';
import { Spinner } from '../primitives/Spinner';
import { Tappable } from '../primitives/Tappable';
import { Text } from '../primitives/Text';
import { makeStyles, useTheme } from '../theme/theme';
import { ChatToolRow } from './ChatToolRow';
import { ChatUserBubble } from './ChatUserBubble';
import { CollapsibleMarkdown } from './CollapsibleMarkdown';

/** One row of a subagent's transcript. */
export type SubagentRow =
  | { id: string; kind: 'user'; text: string }
  | { id: string; kind: 'assistant'; text: string }
  | { id: string; kind: 'tool'; summary: string; detail?: string; icon?: IconName };

export type SubagentPhase = 'loading' | 'loaded' | 'empty' | 'missing' | 'failed';

export interface SubagentTranscriptLabels {
  back: string;
  readOnly: string;
  partial: string;
  loading: string;
  emptyTitle: string;
  emptyMessage: string;
  missingTitle: string;
  missingMessage: string;
  failedTitle: string;
  retry: string;
  prompt: string;
  showMore: string;
  showLess: string;
}

export const defaultSubagentLabels: SubagentTranscriptLabels = {
  back: 'Back',
  readOnly: 'Read-only',
  partial: 'Showing the latest part',
  loading: 'Loading subagent transcript…',
  emptyTitle: 'Nothing Recorded Yet',
  emptyMessage: "This subagent hasn't written anything yet.",
  missingTitle: 'Transcript Not Found',
  missingMessage:
    'The Host has no transcript for this subagent. Claude Code may have cleaned it up.',
  failedTitle: "Couldn't Load the Transcript",
  retry: 'Try Again',
  prompt: 'Prompt',
  showMore: 'Show More',
  showLess: 'Show Less',
};

const BACK_SIZE = 36;

const useStyles = makeStyles((t) => ({
  root: { flex: 1, minHeight: 640, backgroundColor: t.colors.canvas },
  header: { backgroundColor: t.colors.surface, paddingBottom: t.spacing.xxs },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: t.metrics.screenInset,
    paddingTop: t.spacing.xxs,
  },
  back: {
    width: BACK_SIZE,
    height: BACK_SIZE,
    borderRadius: BACK_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.surfaceRaised,
    borderWidth: t.metrics.hairlineWidth,
    borderColor: t.hairline,
  },
  title: { flex: 1, textAlign: 'center' },
  spacer: { width: BACK_SIZE },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xs,
    paddingHorizontal: t.metrics.screenInset,
    paddingTop: t.spacing.xxs,
  },
  timeline: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: t.metrics.screenInset,
    paddingVertical: t.spacing.sm,
    gap: t.spacing.xs,
  },
  bleed: { marginHorizontal: -t.spacing.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: t.spacing.sm },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: t.metrics.screenInset,
    paddingVertical: t.spacing.sm,
    gap: t.spacing.sm,
  },
  brief: { gap: t.spacing.xs },
}));

/** What the Subagent was asked: its description, then its prompt under a heading. */
function Brief({
  description,
  prompt,
  labels,
}: {
  description?: string;
  prompt?: string;
  labels: SubagentTranscriptLabels;
}) {
  const styles = useStyles();
  return (
    <View style={styles.brief} testID="subagent-brief">
      {description ? <Text variant="headline">{description}</Text> : null}
      {prompt ? (
        <Section title={labels.prompt} grouped={false} testID="subagent-prompt">
          <CollapsibleMarkdown
            text={prompt}
            labels={{ more: labels.showMore, less: labels.showLess }}
            testID="subagent-prompt-text"
          />
        </Section>
      ) : null}
    </View>
  );
}

function SubagentTool({ row }: { row: Extract<SubagentRow, { kind: 'tool' }> }) {
  const [open, setOpen] = useState(false);
  return (
    <ChatToolRow
      testID={`subagent-tool-${row.id}`}
      tool={{ icon: row.icon ?? 'search', title: row.summary, status: 'done', output: row.detail }}
      expanded={open}
      onToggle={row.detail !== undefined ? () => setOpen((value) => !value) : undefined}
    />
  );
}

interface ClaudeSubagentTranscriptProps {
  /** The subagent's type or name ("Explore"). */
  title: string;
  /** What the launch called the task ("Find callers"), over the prompt. */
  description?: string;
  /** What the launch asked of it, as markdown; collapsed to a few lines when long. */
  prompt?: string;
  phase?: SubagentPhase;
  /** Only the tail of a long transcript was read. */
  partial?: boolean;
  rows: readonly SubagentRow[];
  failureMessage?: string;
  onBack: () => void;
  onRetry?: () => void;
  labels?: Partial<SubagentTranscriptLabels>;
  testID?: string;
}

/**
 * A subagent's own transcript, pushed from its call row in Chat: back button, its type as the
 * title, a read-only hint, what it was asked (description and prompt), then the timeline. No
 * composer, no status line, and nothing here sends input anywhere.
 */
export function ClaudeSubagentTranscript({
  title,
  description,
  prompt,
  phase = 'loaded',
  partial = false,
  rows,
  failureMessage,
  onBack,
  onRetry,
  labels,
  testID = 'subagent-transcript',
}: ClaudeSubagentTranscriptProps) {
  const styles = useStyles();
  const theme = useTheme();
  const text = { ...defaultSubagentLabels, ...labels };
  const hint = [text.readOnly, partial && phase === 'loaded' ? text.partial : undefined]
    .filter(Boolean)
    .join(' · ');

  const content = () => {
    switch (phase) {
      case 'loading':
        return (
          <View style={styles.center} testID="subagent-loading">
            <Spinner />
            <Text variant="subheadline" tone="secondary">
              {text.loading}
            </Text>
          </View>
        );
      case 'empty':
        return (
          <EmptyState
            icon="emptyTray"
            title={text.emptyTitle}
            message={text.emptyMessage}
            testID="subagent-empty"
          />
        );
      case 'missing':
        return (
          <EmptyState
            icon="folder"
            title={text.missingTitle}
            message={text.missingMessage}
            testID="subagent-missing"
          />
        );
      case 'failed':
        return (
          <EmptyState
            icon="warning"
            title={text.failedTitle}
            message={failureMessage}
            testID="subagent-failed"
            actions={
              onRetry ? <Button kind="secondary" title={text.retry} onPress={onRetry} /> : undefined
            }
          />
        );
      default:
        return rows.map((row) => {
          if (row.kind === 'user')
            return (
              <View key={row.id} style={styles.bleed}>
                <ChatUserBubble text={row.text} testID={`subagent-user-${row.id}`} />
              </View>
            );
          if (row.kind === 'assistant') return <Markdown key={row.id} text={row.text} />;
          return (
            <View key={row.id} style={styles.bleed}>
              <SubagentTool row={row} />
            </View>
          );
        });
    }
  };
  const hasBrief = Boolean(description || prompt);
  // The brief reads from the top; a bare timeline sits at the bottom, as a conversation does.
  const scrolls = phase === 'loaded' || (hasBrief && phase !== 'loading');

  return (
    <View style={styles.root} testID={testID}>
      <View style={styles.header}>
        <View style={styles.bar}>
          <Tappable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel={text.back}
            testID="subagent-back"
            style={styles.back}
          >
            <Icon name="chevronLeft" size={22} color="textPrimary" weight="bold" />
          </Tappable>
          <Text
            variant="headline"
            numberOfLines={1}
            accessibilityRole="header"
            style={styles.title}
          >
            {title}
          </Text>
          <View style={styles.spacer} />
        </View>
        <View style={styles.hint} accessible testID="subagent-read-only">
          <Icon name="eye" size={15} />
          <Text variant="footnote" tone="secondary">
            {hint}
          </Text>
        </View>
      </View>
      {scrolls ? (
        <ScrollView
          contentContainerStyle={hasBrief ? styles.scroll : styles.timeline}
          testID={phase === 'loaded' ? 'subagent-timeline' : 'subagent-scroll'}
        >
          {hasBrief ? <Brief description={description} prompt={prompt} labels={text} /> : null}
          {content()}
        </ScrollView>
      ) : (
        content()
      )}
    </View>
  );
}
