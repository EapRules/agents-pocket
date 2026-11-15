/** Control colors for the in-app browser, taken from theme tokens by the caller. */
export interface LinkTint {
  readonly toolbarColor: string;
  readonly controlsColor: string;
}

/**
 * The two native ways to open a URL. Injected so tests never load the native modules; the device
 * one is `deviceLinkHost`, the fake is `fakeLinkHost`.
 */
export interface LinkHost {
  /** A sheet over the app (SFSafariViewController, Custom Tabs): the app cannot read the page. */
  openInApp(url: string, tint: LinkTint): Promise<void>;
  /** The system: the app that owns the scheme, or the default browser for a web link. */
  openSystem(url: string): Promise<void>;
}
