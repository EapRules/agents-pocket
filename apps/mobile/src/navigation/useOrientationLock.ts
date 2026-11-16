import { useLayoutMode } from '@openagentspocket/ui';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { orientationPolicyFor } from './orientationLock';

/**
 * Mount once at the root: the window's layout mode decides whether the interface may rotate (a
 * `compact` window stays portrait, so a phone never goes landscape). The native initial orientation
 * is portrait (config plugin), so the first frame is already locked; this keeps it so and unlocks
 * where there is room. Web has no orientation lock.
 */
export function useOrientationLock(): void {
  const policy = orientationPolicyFor(useLayoutMode());
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const apply =
      policy === 'portrait'
        ? ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP)
        : ScreenOrientation.unlockAsync();
    apply.catch(() => {});
  }, [policy]);
}
