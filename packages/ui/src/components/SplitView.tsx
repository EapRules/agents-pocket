import { type ReactNode, useContext, useMemo, useState } from 'react';
import {
  I18nManager,
  type LayoutChangeEvent,
  type StyleProp,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';
import { PaneSafeAreaContext, type PaneSide, paneSafeArea, useInsets } from '../theme/insets';
import { layoutModeFor, PaneLayoutModeContext } from '../theme/layoutMode';
import { metrics } from '../theme/metrics';
import { makeStyles } from '../theme/theme';

const useStyles = makeStyles((t) => ({
  root: { flex: 1, flexDirection: 'row' },
  // One pane alone is invisible: no background, no clipping, the whole width.
  single: { flex: 1, flexDirection: 'row' },
  fill: { flex: 1 },
  pane: { overflow: 'hidden' },
  detail: { flex: 1, overflow: 'hidden' },
  hairline: { width: t.metrics.hairlineWidth, backgroundColor: t.hairline },
}));

/** The list pane's width in a split `total` wide: the metric, never more than its share. */
export function splitListWidth(total: number): number {
  return Math.min(metrics.splitListWidth, Math.floor(total * metrics.splitListMaxShare));
}

const widthOf = (event: LayoutChangeEvent) => event.nativeEvent.layout.width;

/**
 * One pane: its layout mode from its own width (the estimate until it is measured, so the first frame
 * already lays out for the pane) and its share of the window's safe area. A pane shown `alone` is no
 * scope: it passes on what is around it (the window, outside another split), so its screen lays out
 * exactly as it would without the split. The tree is the same either way, so the pane's content keeps
 * its state when the split opens or closes.
 */
function SplitPane({
  side,
  estimate,
  alone,
  style,
  children,
  testID,
}: {
  side: PaneSide;
  estimate: number;
  alone: boolean;
  style: StyleProp<ViewStyle>;
  children: ReactNode;
  testID: string;
}) {
  const [measured, setMeasured] = useState<number | null>(null);
  const insets = useInsets();
  const outerMode = useContext(PaneLayoutModeContext);
  const outerSafeArea = useContext(PaneSafeAreaContext);
  const safeArea = useMemo(() => paneSafeArea(insets, side, I18nManager.isRTL), [insets, side]);
  const mode = alone ? outerMode : layoutModeFor(measured ?? estimate);
  return (
    <View style={style} onLayout={(event) => setMeasured(widthOf(event))} testID={testID}>
      <PaneLayoutModeContext.Provider value={mode}>
        <PaneSafeAreaContext.Provider value={alone ? outerSafeArea : safeArea}>
          {children}
        </PaneSafeAreaContext.Provider>
      </PaneLayoutModeContext.Provider>
    </View>
  );
}

interface SplitViewProps {
  /** The leading pane, of fixed width (Home's list). */
  list: ReactNode;
  /** The trailing pane: the rest of the width (the selected Agent, or an empty state). */
  detail: ReactNode;
  /**
   * Shows that pane alone, the whole width, as if there were no split (a compact window). The pane
   * keeps its place in the tree, so going from one pane to two and back never remounts it.
   */
  single?: 'list' | 'detail';
  /** Two halves instead of the fixed list width (Chat beside the Terminal). */
  even?: boolean;
  testID?: string;
}

/**
 * Two panes side by side with a hairline between them. Each pane is a scope: `useLayoutMode()` reads
 * the pane's width and `useInsets()` (and `Screen`) its share of the safe area, so a screen mounted in
 * a pane lays out for the room it has without knowing it is in one.
 */
export function SplitView({
  list,
  detail,
  single,
  even = false,
  testID = 'split-view',
}: SplitViewProps) {
  const styles = useStyles();
  const window = useWindowDimensions().width;
  const [measured, setMeasured] = useState<number | null>(null);
  const total = measured ?? window;
  const listWidth = even ? Math.floor((total - metrics.hairlineWidth) / 2) : splitListWidth(total);
  const alone = single !== undefined;
  // Fixed slots (list, hairline, detail): a pane that stays keeps its position, the other one leaves.
  return (
    <View
      style={alone ? styles.single : styles.root}
      onLayout={(event) => setMeasured(widthOf(event))}
      testID={testID}
    >
      {single === 'detail' ? null : (
        <SplitPane
          side="leading"
          estimate={alone ? total : listWidth}
          alone={alone}
          style={alone ? styles.fill : [styles.pane, { width: listWidth }]}
          testID={`${testID}-list`}
        >
          {list}
        </SplitPane>
      )}
      {alone ? null : <View style={styles.hairline} testID={`${testID}-hairline`} />}
      {single === 'list' ? null : (
        <SplitPane
          side="trailing"
          estimate={alone ? total : total - listWidth - metrics.hairlineWidth}
          alone={alone}
          style={alone ? styles.fill : styles.detail}
          testID={`${testID}-detail`}
        >
          {detail}
        </SplitPane>
      )}
    </View>
  );
}
