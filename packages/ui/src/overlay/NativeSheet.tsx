import { type ComponentRef, useEffect, useRef, useState } from 'react';
import { type ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useTheme } from '../theme/theme';
import { loadTrueSheet, type TrueSheetDetent, type TrueSheetMethods } from './loadTrueSheet';
import { SheetAlertHost, SheetBody } from './SheetBody';
import { SheetFooter } from './SheetContent';
import type { SheetDetent } from './sheetDetents';
import type { SheetProps } from './sheetTypes';

/** `fit` is the content's height (the native `auto`, capped by `nativeMaxHeight`); the rest are fractions. */
export function nativeDetents(detent: SheetDetent, maxShare: number): TrueSheetDetent[] {
  if (detent === 'fit') return ['auto'];
  if (detent === 'medium') return [0.5];
  if (detent === 'large') return [maxShare];
  return [Math.min(maxShare, Math.max(0.2, detent.fraction))];
}

/**
 * The tallest a sheet may be, for the native `auto` detent (it otherwise grows to the screen): the
 * same height `large` asks for, so a long fit sheet stops where a large one does. A fixed detent
 * needs none.
 */
export function nativeMaxHeight(
  detent: SheetDetent,
  windowHeight: number,
  maxShare: number,
): number | undefined {
  return detent === 'fit' ? Math.round(windowHeight * maxShare) : undefined;
}

/**
 * The native host of `Sheet`: a native sheet with the app's canvas surface and the sheet radius
 * token, so it matches the route sheets. `visible` presents and dismisses it; a swipe or scrim tap
 * reports `onClose`.
 */
export function NativeSheet(props: SheetProps) {
  const { visible, onClose, onDismissed, detent = 'fit', grabber = true, testID = 'sheet' } = props;
  const TrueSheet = loadTrueSheet();
  const { colors, metrics, radius } = useTheme();
  const { height } = useWindowDimensions();
  const ref = useRef<TrueSheetMethods>(null);
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  // The sheet's own dismissal (a swipe) arrives after the fact: do not dismiss it twice.
  const open = useRef(false);
  const [presented, setPresented] = useState(visible);
  const [footerHeight, setFooterHeight] = useState(0);
  useEffect(() => {
    if (visible) {
      setPresented(true);
      void ref.current?.present();
      open.current = true;
    } else if (open.current) {
      open.current = false;
      void ref.current?.dismiss();
    }
  }, [visible]);
  if (!TrueSheet) return null;
  // Its content view is auto-height unless told: the flex surface below would collapse to nothing.
  // A fit sheet's content shrinks instead: True Sheet measures the content's natural height apart
  // (for `auto`), but the laid-out content must stop at the sheet's height, or a list taller than
  // the cap is laid out at full length, its end below the screen with nothing left to scroll.
  const fill = detent === 'fit' ? styles.shrink : styles.fill;
  return (
    <TrueSheet
      ref={ref}
      style={fill}
      detents={nativeDetents(detent, metrics.sheetMaxShare)}
      maxContentHeight={nativeMaxHeight(detent, height, metrics.sheetMaxShare)}
      backgroundColor={colors.canvas}
      cornerRadius={radius.sheet}
      grabber={grabber}
      scrollableRef={scrollRef}
      // A footer inside the content stays behind the keyboard; the sheet's own absolute footer
      // rises above it and goes back down with it, and insets the scroll view by its height.
      footer={
        props.footer ? (
          <SheetFooter
            footer={props.footer}
            host
            onHeight={setFooterHeight}
            testID={`${testID}-footer`}
          />
        ) : undefined
      }
      footerOptions={props.footer ? FOOTER_OPTIONS : undefined}
      onDidDismiss={() => {
        if (open.current) {
          open.current = false;
          onClose();
        }
        setPresented(false);
        onDismissed?.();
      }}
      testID={testID}
    >
      {presented || visible ? (
        <View style={fill} testID={`${testID}-surface`}>
          <SheetBody
            sheet={props}
            fit={detent === 'fit'}
            scrollRef={scrollRef}
            footerPlacement="host"
            footerHeight={footerHeight}
          />
          <SheetAlertHost testID={testID} />
        </View>
      ) : null}
    </TrueSheet>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 }, shrink: { flexShrink: 1 } });

const FOOTER_OPTIONS = { position: 'absolute', avoidKeyboard: true } as const;
