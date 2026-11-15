import { LinkOpenerProvider } from '@openagentspocket/ui';
import type { ReactNode } from 'react';
import { useOpenLink } from './useOpenLink';

/** Every link in the ui package opens through the app's one opener (a sheet for web links). */
export function AppLinkOpener({ children }: { children: ReactNode }) {
  return <LinkOpenerProvider openLink={useOpenLink()}>{children}</LinkOpenerProvider>;
}
