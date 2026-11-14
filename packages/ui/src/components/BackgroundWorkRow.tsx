import { View } from 'react-native';
import { Button } from '../primitives/Button';
import { Icon, type IconName } from '../primitives/Icon';
import { Meter } from '../primitives/Meter';
import { Tappable } from '../primitives/Tappable';
import { Text } from '../primitives/Text';
import { rounded } from '../theme/corners';
import { airy } from '../theme/metrics';
import { makeStyles } from '../theme/theme';
import { BackgroundWorkGlyph, type BackgroundWorkState } from './BackgroundWorkStrip';

/** What a piece of Background Work is; its row's icon says it. */
export type BackgroundWorkItemKind = 'subagent' | 'workflow' | 'command';

export interface BackgroundWorkAgentItem {
  id: string;
  state: BackgroundWorkState;
  /** The label its program gave it ("Agent 3" when it gave none). */
  label: string;
  phase?: string;
}

export interface BackgroundWorkDetailItem {
  id: string;
  kind: BackgroundWorkItemKind;
  /** A Subagent's description, a command's stated purpose, else the command line. */
  title: string;
  /** The title is a command line or a Workflow's name. */
  monospaced?: boolean;
  state: BackgroundWorkState;
  /** The second line: what kind of work it is and where it stands ("Explore · 2m 18s"). */
  caption: string;
  /** More about it: a described command's line, what a Workflow says it does. */
  detail?: string;
  fraction?: { done: number; total: number };
  /** "2 of 3 agents done so far". */
  fractionText?: string;
  /** "41.2K tokens · 14 tool uses". */
  usage?: string;
  /** A Workflow's agents; the row opens to them. */
  agents?: readonly BackgroundWorkAgentItem[];
  accessibilityLabel?: string;
  /** What the row can open (a Subagent's own transcript, read-only); absent when nothing can. */
  action?: { label: string; onPress: () => void };
}

const KIND_ICONS: Record<BackgroundWorkItemKind, IconName> = {
  subagent: 'bot',
  workflow: 'network',
  command: 'terminal',
};

const TILE = 28;

const useStyles = makeStyles((t) => ({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: t.spacing.xs, padding: t.spacing.sm },
  tile: {
    width: TILE,
    height: TILE,
    ...rounded(t.radius.control),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.surfaceRaised,
  },
  text: { flex: 1, gap: airy.chipV },
  caption: { flexDirection: 'row', alignItems: 'center', gap: airy.chipV },
  captionText: { flex: 1 },
  bar: { alignSelf: 'stretch' },
  action: { alignSelf: 'flex-start' },
  agents: {
    paddingLeft: t.spacing.sm + TILE + t.spacing.xs,
    paddingRight: t.spacing.sm,
    paddingBottom: t.spacing.xs,
    gap: t.spacing.xs,
  },
  agent: { flexDirection: 'row', alignItems: 'flex-start', gap: t.spacing.xs },
  agentText: { flex: 1, gap: airy.line },
}));

const isLive = (state: BackgroundWorkState) =>
  state === 'running' || state === 'unconfirmed' || state === 'quiet';

function AgentRow({ agent }: { agent: BackgroundWorkAgentItem }) {
  const styles = useStyles();
  return (
    <View style={styles.agent} testID={`work-agent-${agent.id}`}>
      <BackgroundWorkGlyph state={agent.state} />
      <View style={styles.agentText}>
        <Text variant="subheadline" monospaced numberOfLines={2}>
          {agent.label}
        </Text>
        {agent.phase ? (
          <Text variant="caption" tone="secondary">
            {agent.phase}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

interface BackgroundWorkRowProps {
  item: BackgroundWorkDetailItem;
  /** A Workflow open to its agents. */
  open: boolean;
  onToggle: () => void;
}

/**
 * One piece of Background Work: an icon by kind, the title on up to two lines, then its kind and
 * state with a glyph for the state, and what more it has (a command line, a Workflow's progress,
 * what it cost, an action). A Workflow opens to its agents.
 */
export function BackgroundWorkRow({ item, open, onToggle }: BackgroundWorkRowProps) {
  const styles = useStyles();
  const expandable = (item.agents?.length ?? 0) > 0;
  const body = (
    <View style={styles.row}>
      <View style={styles.tile} testID={`work-kind-${item.kind}`}>
        <Icon name={KIND_ICONS[item.kind]} size={15} color="textSecondary" />
      </View>
      <View style={styles.text}>
        <Text variant="body" monospaced={item.monospaced} numberOfLines={2}>
          {item.title}
        </Text>
        <View style={styles.caption}>
          <BackgroundWorkGlyph state={item.state} />
          <Text
            variant="caption"
            tone={item.state === 'failed' ? 'danger' : 'secondary'}
            tabularNums
            numberOfLines={1}
            style={styles.captionText}
            testID={`work-caption-${item.id}`}
          >
            {item.caption}
          </Text>
        </View>
        {item.detail ? (
          <Text
            variant="caption"
            tone="tertiary"
            monospaced={item.kind === 'command'}
            numberOfLines={2}
          >
            {item.detail}
          </Text>
        ) : null}
        {item.fraction ? (
          <View style={styles.text}>
            {isLive(item.state) ? (
              <View style={styles.bar}>
                <Meter
                  value={
                    Math.min(item.fraction.done, item.fraction.total) /
                    Math.max(1, item.fraction.total)
                  }
                  accessibilityLabel={item.title}
                />
              </View>
            ) : null}
            <Text variant="caption" tone="secondary" tabularNums>
              {item.fractionText ?? `${item.fraction.done}/${item.fraction.total}`}
            </Text>
          </View>
        ) : null}
        {item.usage ? (
          <Text variant="caption" tone="secondary" tabularNums>
            {item.usage}
          </Text>
        ) : null}
        {item.action ? (
          <View style={styles.action}>
            <Button
              kind="text"
              size="mini"
              tight
              title={item.action.label}
              accessibilityLabel={`${item.action.label}, ${item.title}`}
              onPress={item.action.onPress}
              testID={`work-open-${item.id}`}
            />
          </View>
        ) : null}
      </View>
      {expandable ? (
        <Icon name={open ? 'chevronDown' : 'chevronRight'} size={14} color="textTertiary" />
      ) : null}
    </View>
  );
  return (
    <View testID={`work-sheet-${item.id}`}>
      {expandable ? (
        <Tappable
          onPress={onToggle}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={item.accessibilityLabel}
        >
          {body}
        </Tappable>
      ) : (
        body
      )}
      {expandable && open ? (
        <View style={styles.agents}>
          {item.agents?.map((agent) => (
            <AgentRow key={agent.id} agent={agent} />
          ))}
        </View>
      ) : null}
    </View>
  );
}
