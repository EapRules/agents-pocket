import type { LayoutMode } from '@openagentspocket/ui';

/** Portrait only while the window is one column; free to rotate where two columns fit. */
export type OrientationPolicy = 'portrait' | 'free';

export function orientationPolicyFor(mode: LayoutMode): OrientationPolicy {
  return mode === 'compact' ? 'portrait' : 'free';
}
