import type { LinkHost, LinkTint } from './linkHost';

/** A LinkHost that records what it was asked to open; `failInApp` / `failSystem` make it reject. */
export class FakeLinkHost implements LinkHost {
  readonly inApp: { url: string; tint: LinkTint }[] = [];
  readonly system: string[] = [];
  failInApp = false;
  failSystem = false;

  async openInApp(url: string, tint: LinkTint): Promise<void> {
    if (this.failInApp) throw new Error('in-app failed');
    this.inApp.push({ url, tint });
  }

  async openSystem(url: string): Promise<void> {
    if (this.failSystem) throw new Error('system failed');
    this.system.push(url);
  }
}
