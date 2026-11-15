import { linkTarget } from '@openagentspocket/core';
import { deviceLinkHost } from './deviceLinkHost';
import type { LinkHost, LinkTint } from './linkHost';

export interface LinkOpener {
  /** Follows `linkTarget`: web links in a sheet, other schemes to the system, unsafe ones nowhere. */
  openLink(url: string, tint: LinkTint): Promise<boolean>;
  /** Always the system (the person asked to leave the app); unsafe links are still refused. */
  openExternally(url: string): Promise<boolean>;
}

/** Never throws: true when something was opened, false when the link was refused or failed. */
export function createLinkOpener(host: LinkHost): LinkOpener {
  const system = async (url: string) => {
    try {
      await host.openSystem(url);
      return true;
    } catch {
      return false;
    }
  };
  return {
    async openLink(raw, tint) {
      const url = raw.trim();
      const target = linkTarget(url);
      if (target === 'refuse') return false;
      if (target === 'system') return system(url);
      try {
        await host.openInApp(url, tint);
        return true;
      } catch {
        return system(url);
      }
    },
    async openExternally(raw) {
      const url = raw.trim();
      return linkTarget(url) === 'refuse' ? false : system(url);
    },
  };
}

const device = createLinkOpener(deviceLinkHost);

/** The device's opener, for callers outside React or without a theme. */
export const { openExternally } = device;
export const openLinkWithTint = device.openLink;
