import * as WebBrowser from 'expo-web-browser';
import { Linking } from 'react-native';
import type { LinkHost } from './linkHost';

/** The real thing: expo-web-browser as a page sheet, and Linking for the system. */
export const deviceLinkHost: LinkHost = {
  async openInApp(url, tint) {
    await WebBrowser.openBrowserAsync(url, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
      toolbarColor: tint.toolbarColor,
      controlsColor: tint.controlsColor,
    });
  },
  openSystem: (url) => Linking.openURL(url),
};
