import { FakeLinkHost } from './fakeLinkHost';
import { createLinkOpener } from './openLink';

const TINT = { toolbarColor: '#111', controlsColor: '#222' };

function setup() {
  const host = new FakeLinkHost();
  return { host, ...createLinkOpener(host) };
}

describe('createLinkOpener', () => {
  it('opens a web link in the app with the tint', async () => {
    const { host, openLink } = setup();
    expect(await openLink('  https://claude.ai/chat/1 ', TINT)).toBe(true);
    expect(host.inApp).toEqual([{ url: 'https://claude.ai/chat/1', tint: TINT }]);
    expect(host.system).toEqual([]);
  });

  it.each(['mailto:a@b.co', 'tel:+5400000', 'openagentspocket://usage', 'agentico://usage'])(
    'hands %s to the system',
    async (url) => {
      const { host, openLink } = setup();
      expect(await openLink(url, TINT)).toBe(true);
      expect(host.system).toEqual([url]);
      expect(host.inApp).toEqual([]);
    },
  );

  it.each(['', 'javascript:alert(1)', 'data:text/html,x', 'file:///etc/passwd', 'example.com'])(
    'refuses %j without opening anything',
    async (url) => {
      const { host, openLink } = setup();
      expect(await openLink(url, TINT)).toBe(false);
      expect(host.inApp).toEqual([]);
      expect(host.system).toEqual([]);
    },
  );

  it('falls back to the system when the in-app browser fails', async () => {
    const { host, openLink } = setup();
    host.failInApp = true;
    expect(await openLink('https://example.com', TINT)).toBe(true);
    expect(host.system).toEqual(['https://example.com']);
  });

  it('never throws when both fail', async () => {
    const { host, openLink, openExternally } = setup();
    host.failInApp = true;
    host.failSystem = true;
    expect(await openLink('https://example.com', TINT)).toBe(false);
    expect(await openExternally('https://example.com')).toBe(false);
  });

  it('openExternally uses the system for web links too, and still refuses unsafe ones', async () => {
    const { host, openExternally } = setup();
    expect(await openExternally('https://example.com/x')).toBe(true);
    expect(await openExternally('javascript:alert(1)')).toBe(false);
    expect(host.system).toEqual(['https://example.com/x']);
    expect(host.inApp).toEqual([]);
  });
});
