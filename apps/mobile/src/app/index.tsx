import { t } from '@openagentspocket/i18n';
import { EmptyState, SplitView, useLayoutMode } from '@openagentspocket/ui';
import { useHomeRoute } from '@/home/useHomeRoute';
import { AppScreen } from '@/navigation/AppScreen';

/**
 * `/`: Home. The header capsules, the + sheet and every card are drawn by HomeScreen. From `regular`
 * up Home is the list pane of a split whose detail waits for an Agent (ADR 0029).
 */
export default function Index() {
  const home = useHomeRoute();
  // Always the split, one pane alone in compact: Home keeps its state when the window resizes.
  const compact = useLayoutMode() === 'compact';
  return (
    <SplitView
      single={compact ? 'list' : undefined}
      list={home}
      detail={
        <AppScreen bare scroll={false} testID="split-empty-detail">
          <EmptyState
            title={t('No Agent Selected')}
            message={t('Choose an Agent in the list to open it here.')}
          />
        </AppScreen>
      }
    />
  );
}
