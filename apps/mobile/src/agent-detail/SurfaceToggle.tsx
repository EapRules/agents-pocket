import { t } from '@openagentspocket/i18n';
import { ProgramMark, type Status, Tappable } from '@openagentspocket/ui';
import { useShownStatus } from '../blocked/BlockedCardProvider';
import type { Surface } from './surface';

/**
 * The Agent's mark as the control that flips Chat and Terminal: the Composer's `leading` and the
 * terminal toolbar's. `surface` is the one on screen; the label says where it goes.
 */
export function SurfaceToggle({
  program,
  status,
  surface,
  onPress,
}: {
  program: string;
  status?: Status;
  surface: Surface;
  onPress?: () => void;
}) {
  const shownStatus = useShownStatus(status ?? 'idle');
  return (
    <Tappable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={surface === 'chat' ? t('Show Terminal') : t('Show Chat')}
      testID="surface-toggle"
    >
      <ProgramMark program={program} status={status && shownStatus} size={26} />
    </Tappable>
  );
}
