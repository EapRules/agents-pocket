import { createContext, type ReactNode, useContext } from 'react';
import { Linking } from 'react-native';

/** Opens a link a person tapped. The app decides how; ui only asks. */
export type OpenLink = (url: string) => void | Promise<unknown>;

const systemOpen: OpenLink = (url) => Linking.openURL(url).catch(() => {});

const LinkOpenerContext = createContext<OpenLink>(systemOpen);

/** The app provides its opener once at the root; without one, links go to the system. */
export function LinkOpenerProvider({
  openLink,
  children,
}: {
  openLink: OpenLink;
  children: ReactNode;
}) {
  return <LinkOpenerContext.Provider value={openLink}>{children}</LinkOpenerContext.Provider>;
}

/** The opener for any ui component that shows a link. */
export function useLinkOpener(): OpenLink {
  return useContext(LinkOpenerContext);
}
