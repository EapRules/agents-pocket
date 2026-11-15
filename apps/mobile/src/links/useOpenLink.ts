import { useTheme } from '@openagentspocket/ui';
import { useCallback } from 'react';
import { openLinkWithTint } from './openLink';

/** `openLink(url)`: the one way a web link opens, with the browser controls tinted by the theme. */
export function useOpenLink(): (url: string) => Promise<boolean> {
  const { colors } = useTheme();
  const { surface, accent } = colors;
  return useCallback(
    (url) => openLinkWithTint(url, { toolbarColor: surface, controlsColor: accent }),
    [surface, accent],
  );
}
