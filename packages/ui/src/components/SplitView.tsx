import { type ReactNode, useMemo, useState } from 'react';
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
  root: { flex: 1, flexDirection: 'row', backgroundColor: t.colors.canvas },
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
 * already lays out for the pane) and its share of the window's safe area.
 */
function SplitPane({
  side,
  estimate,
  style,
  children,
  testID,
}: {
  side: PaneSide;
  estimate: number;
  style: StyleProp<ViewStyle>;
  children: ReactNode;
  testID: string;
}) {
  const [measured, setMeasured] = useState<number | null>(null);
  const insets = useInsets();
  const safeArea = useMemo(() => paneSafeArea(insets, side, I18nManager.isRTL), [insets, side]);
  return (
    <View style={style} onLayout={(event) => setMeasured(widthOf(event))} testID={testID}>
      <PaneLayoutModeContext.Provider value={layoutModeFor(measured ?? estimate)}>
        <PaneSafeAreaContext.Provider value={safeArea}>{children}</PaneSafeAreaContext.Provider>
      </PaneLayoutModeContext.Provider>
    </View>
  );
}

interface SplitViewProps {
  /** The leading pane, of fixed width (Home's list). */
  list: ReactNode;
  /** The trailing pane: the rest of the width (the selected Agent, or an empty state). */
  detail: ReactNode;
  testID?: string;
}

/**
 * Two panes side by side with a hairline between them. Each pane is a scope: `useLayoutMode()` reads
 * the pane's width and `useInsets()` (and `Screen`) its share of the safe area, so a screen mounted in
 * a pane lays out for the room it has without knowing it is in one.
 */
export function SplitView({ list, detail, testID = 'split-view' }: SplitViewProps) {
  const styles = useStyles();
  const window = useWindowDimensions().width;
  const [measured, setMeasured] = useState<number | null>(null);
  const total = measured ?? window;
  const listWidth = splitListWidth(total);
  return (
    <View style={styles.root} onLayout={(event) => setMeasured(widthOf(event))} testID={testID}>
      <SplitPane
        side="leading"
        estimate={listWidth}
        style={[styles.pane, { width: listWidth }]}
        testID={`${testID}-list`}
      >
        {list}
      </SplitPane>
      <View style={styles.hairline} />
      <SplitPane
        side="trailing"
        estimate={total - listWidth - metrics.hairlineWidth}
        style={styles.detail}
        testID={`${testID}-detail`}
      >
        {detail}
      </SplitPane>
    </View>
  );
}
