import { View } from 'react-native';
import { Section } from '../primitives/Section';
import { makeStyles } from '../theme/theme';
import { type BackgroundWorkDetailItem, BackgroundWorkRow } from './BackgroundWorkRow';

export type {
  BackgroundWorkAgentItem,
  BackgroundWorkDetailItem,
  BackgroundWorkItemKind,
} from './BackgroundWorkRow';

export interface BackgroundWorkListLabels {
  running: string;
  finished: string;
  finishedFooter: string;
}

export type BackgroundWorkSection = 'running' | 'finished';

/** Which sections the user opened or closed while the sheet is up; absent ones follow `sectionOpen`. */
export type BackgroundWorkSections = Partial<Record<BackgroundWorkSection, boolean>>;

/**
 * Whether a section shows its rows. Running starts open. Finished starts open only when nothing
 * runs: while work runs, what runs is what the sheet is opened for, and a long Finished list would
 * push it away; with nothing running, Finished is all there is to see. The user's choice wins.
 */
export function sectionOpen(
  section: BackgroundWorkSection,
  chosen: BackgroundWorkSections,
  runningCount: number,
): boolean {
  return chosen[section] ?? (section === 'running' || runningCount === 0);
}

const useStyles = makeStyles((t) => ({ list: { gap: t.spacing.md } }));

interface BackgroundWorkListProps {
  unfinished: readonly BackgroundWorkDetailItem[];
  finished: readonly BackgroundWorkDetailItem[];
  /** Ids of the Workflows open to their agents. */
  expanded: ReadonlySet<string>;
  onToggle: (id: string) => void;
  /** The sections the user opened or closed; the rest follow `sectionOpen`. */
  sections?: BackgroundWorkSections;
  onToggleSection?: (section: BackgroundWorkSection, open: boolean) => void;
  labels: BackgroundWorkListLabels;
}

/**
 * Everything Chat lists as Background Work (Swift ChatBackgroundWorkSheet content): what runs,
 * then what finished since the user's latest message, each a collapsible section with its count.
 */
export function BackgroundWorkList({
  unfinished,
  finished,
  expanded,
  onToggle,
  sections = {},
  onToggleSection,
  labels,
}: BackgroundWorkListProps) {
  const styles = useStyles();
  const groups = [
    { key: 'running' as const, title: labels.running, items: unfinished, footer: undefined },
    {
      key: 'finished' as const,
      title: labels.finished,
      items: finished,
      footer: labels.finishedFooter,
    },
  ];
  return (
    <View style={styles.list} testID="background-work-list">
      {groups.map(({ key, title, items, footer }) => {
        if (items.length === 0) return null;
        const open = sectionOpen(key, sections, unfinished.length);
        return (
          <Section
            key={key}
            title={title}
            count={items.length}
            footer={footer}
            expanded={open}
            onToggle={onToggleSection ? () => onToggleSection(key, !open) : undefined}
            testID={`work-section-${key}`}
          >
            {items.map((item) => (
              <BackgroundWorkRow
                key={item.id}
                item={item}
                open={expanded.has(item.id)}
                onToggle={() => onToggle(item.id)}
              />
            ))}
          </Section>
        );
      })}
    </View>
  );
}
