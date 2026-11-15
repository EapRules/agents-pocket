import { renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { LinkOpenerProvider, useLinkOpener } from './LinkOpenerContext';

describe('useLinkOpener', () => {
  it('returns the provided opener', async () => {
    const openLink = jest.fn();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <LinkOpenerProvider openLink={openLink}>{children}</LinkOpenerProvider>
    );
    const { result } = await renderHook(() => useLinkOpener(), { wrapper });
    await result.current('https://example.com');
    expect(openLink).toHaveBeenCalledWith('https://example.com');
  });

  it('defaults to a function when no provider is mounted', async () => {
    const { result } = await renderHook(() => useLinkOpener());
    expect(typeof result.current).toBe('function');
  });
});
