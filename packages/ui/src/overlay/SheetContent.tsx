import type { ComponentRef, ReactNode, Ref } from 'react';
import { ScrollView, View } from 'react-native';
import { BarAction } from '../components/SheetBar';
import { Button } from '../primitives/Button';
import { GlassCapsule } from '../primitives/GlassCapsule';
import { SurfaceFillProvider } from '../primitives/surfaceFill';
import { Text } from '../primitives/Text';
import { makeStyles } from '../theme/theme';

const useStyles = makeStyles((t) => ({
  // One header layout (the same metrics as `SheetBar`): clear of the grabber, buttons and title on the content gutter.
  headerBox: { paddingTop: t.metrics.sheetHeaderTop, paddingBottom: t.metrics.sheetHeaderGap },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xs,
    paddingHorizontal: t.metrics.screenInset,
    minHeight: t.metrics.minTapSize,
  },
  title: { flex: 1 },
  // The bare close glyph sits in a 44 pt target: pull the target out so the glyph's edge is near the content gutter.
  closeEnd: { marginRight: -t.spacing.xs },
  barTitle: { flex: 1, textAlign: 'center' },
  barSlot: { minWidth: t.metrics.minTapSize * 1.5, flexDirection: 'row' },
  barEnd: { justifyContent: 'flex-end' },
  largeHeader: { paddingHorizontal: t.metrics.screenInset, paddingTop: t.spacing.xs },
  largeTitle: {},
  body: { paddingHorizontal: t.metrics.screenInset, gap: t.spacing.md },
  // No header row: the content starts at the header's top, clear of the grabber.
  bodyNoHeader: { paddingTop: t.metrics.sheetHeaderTop },
  // Floats over the content on the native host: the canvas under it hides what scrolls behind.
  hostFooter: { backgroundColor: t.colors.canvas, paddingBottom: t.spacing.sm },
  // The native host already counts its footer in a content-sized sheet's height; the body only needs air above it.
  aboveHostFooter: { paddingBottom: t.spacing.md },
}));

/** A labeled action in the sheet's bar: `Cancel` / `Done` leading, `Start` / `Save` trailing. */
export interface SheetBarAction {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  testID?: string;
}

/** What a sheet draws inside its surface, whichever host (native or JS) presents it. */
export interface SheetContentProps {
  onClose: () => void;
  title?: string;
  closeLabel: string;
  leading?: SheetBarAction;
  trailing?: SheetBarAction;
  largeTitle: boolean;
  closeButton: boolean;
  headerless: boolean;
  footer?: ReactNode;
  /**
   * `inline`: the footer is drawn here under the body and the ScrollView keeps the focused field
   * above the keyboard (the JS host lifts the whole panel). `host`: the host draws the footer
   * (`SheetFooter`) above the keyboard and insets the plugged scroll view itself (True Sheet).
   */
  footerPlacement?: 'inline' | 'host';
  /** Content-sized: the body shrinks and scrolls past the host's limit; otherwise it fills. */
  fit: boolean;
  /**
   * Height of a footer the host draws under the content (`footerPlacement="host"`), zero until it is
   * measured. The host sizes a content-sized sheet with its footer included (seen on the simulator:
   * adding this height below the body doubled the room), so the body only keeps a gap above it.
   */
  footerHeight?: number;
  scrollRef?: Ref<ComponentRef<typeof ScrollView>>;
  children: ReactNode;
  testID: string;
}

/** The bar or title row, the scrolling body and the pinned footer: one look for every host. */
export function SheetContent({
  onClose,
  title,
  closeLabel,
  leading,
  trailing,
  largeTitle,
  closeButton,
  headerless,
  footer,
  footerPlacement = 'inline',
  fit,
  footerHeight = 0,
  scrollRef,
  children,
  testID,
}: SheetContentProps) {
  const styles = useStyles();
  const bar = leading !== undefined || trailing !== undefined;
  const hasHeader = !headerless && (bar || closeButton || title !== undefined);
  return (
    <>
      {hasHeader ? (
        <View style={styles.headerBox}>
          {bar ? (
            <>
              <View style={styles.header} testID={`${testID}-bar`}>
                <View style={styles.barSlot}>
                  {leading ? <BarButton action={leading} testID={`${testID}-leading`} /> : null}
                </View>
                {largeTitle ? (
                  <View style={styles.title} />
                ) : (
                  <Text
                    variant="headline"
                    accessibilityRole="header"
                    style={styles.barTitle}
                    numberOfLines={1}
                  >
                    {title ?? ''}
                  </Text>
                )}
                <View style={[styles.barSlot, styles.barEnd]}>
                  {trailing ? (
                    <GlassCapsule>
                      <BarAction action={trailing} testID={`${testID}-trailing`} />
                    </GlassCapsule>
                  ) : null}
                </View>
              </View>
              {largeTitle ? (
                <View style={styles.largeHeader}>
                  <Text
                    variant="title"
                    accessibilityRole="header"
                    style={styles.largeTitle}
                    numberOfLines={2}
                  >
                    {title ?? ''}
                  </Text>
                </View>
              ) : null}
            </>
          ) : (
            <View style={styles.header}>
              <Text variant="headline" accessibilityRole="header" style={styles.title}>
                {title ?? ''}
              </Text>
              <View style={styles.closeEnd}>
                <Button
                  kind="text"
                  icon="close"
                  accessibilityLabel={closeLabel}
                  onPress={onClose}
                  testID={`${testID}-close`}
                />
              </View>
            </View>
          )}
        </View>
      ) : null}
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.body,
          !hasHeader && styles.bodyNoHeader,
          fit && footerPlacement === 'host' && footerHeight > 0 && styles.aboveHostFooter,
        ]}
        keyboardShouldPersistTaps="handled"
        // Inline, the JS panel lifts with the keyboard and this scrolls the focused field into
        // view; on the native host True Sheet insets the plugged scroll view: once, not twice.
        automaticallyAdjustKeyboardInsets={footerPlacement === 'inline'}
        style={fit ? { flexShrink: 1 } : { flex: 1 }}
        testID={`${testID}-scroll`}
      >
        <SurfaceFillProvider value="surfaceOverlay">{children}</SurfaceFillProvider>
      </ScrollView>
      {footer && footerPlacement === 'inline' ? <SheetFooter footer={footer} /> : null}
    </>
  );
}

/** The pinned footer (a primary action): under the body inline, or given to the native host. */
export function SheetFooter({
  footer,
  host = false,
  onHeight,
  testID,
}: {
  footer: ReactNode;
  host?: boolean;
  /** The footer's measured height, for the body to keep that room free (see `footerHeight`). */
  onHeight?: (height: number) => void;
  testID?: string;
}) {
  const styles = useStyles();
  return (
    <View
      style={host ? [styles.body, styles.hostFooter] : styles.body}
      onLayout={onHeight ? (event) => onHeight(event.nativeEvent.layout.height) : undefined}
      testID={testID}
    >
      <SurfaceFillProvider value="surfaceOverlay">{footer}</SurfaceFillProvider>
    </View>
  );
}

function BarButton({ action, testID }: { action: SheetBarAction; testID: string }) {
  return (
    <Button
      kind="capsule"
      size="small"
      title={action.label}
      onPress={action.onPress}
      disabled={action.disabled}
      loading={action.loading}
      testID={action.testID ?? testID}
    />
  );
}
