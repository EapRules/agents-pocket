import { MemoryStorage, SettingsStore } from '@openagentspocket/core';
import { ThemeProvider } from '@openagentspocket/ui';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Dimensions } from 'react-native';
import { TestSettings } from '@/settings/TestSettings';
import { createDemoConsoleStore } from '../console/demo';
import { ConsoleStoreProvider } from '../console/hooks';
import { fakeAuthenticator } from '../settings/authenticator';
import { SettingsProvider } from '../settings/SettingsProvider';
import { AgentDetailScreen } from './AgentDetailScreen';
import { parseSurface, readSurface } from './surface';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('expo-clipboard', () => ({ getStringAsync: async () => '' }));
// Counts mounts of the terminal view: a remount would drop what it shows.
const mockTerminalMounts = jest.fn();
jest.mock('@openagentspocket/ui', () => {
  const ui = jest.requireActual('@openagentspocket/ui');
  const { useEffect } = jest.requireActual('react');
  return {
    ...ui,
    TerminalView: (props: object) => {
      useEffect(() => mockTerminalMounts(), []);
      return <ui.TerminalView {...props} />;
    },
  };
});
beforeEach(() => mockTerminalMounts.mockClear());
function renderDetail(
  props: Partial<React.ComponentProps<typeof AgentDetailScreen>> & { paneId: string },
) {
  const storage = props.storage ?? new MemoryStorage();
  const onSwitch = props.onSwitch ?? jest.fn();
  const settings = new SettingsStore(new MemoryStorage());
  render(
    <ThemeProvider themeId="indigo">
      <SettingsProvider store={settings} authenticator={fakeAuthenticator(null)}>
        <AgentDetailScreen hostId="demo" storage={storage} onSwitch={onSwitch} {...props} />
      </SettingsProvider>
    </ThemeProvider>,
  );
  return { storage, onSwitch, settings };
}

describe('AgentDetailScreen', () => {
  it('shows the header and the Chat slot by default', async () => {
    renderDetail({ paneId: 'p2' });
    await waitFor(() => expect(screen.getByTestId('agent-header')).toBeTruthy());
    expect(screen.getByTestId('slot-chat')).toBeTruthy();
    expect(screen.getByTestId('chat-timeline')).toBeTruthy();
  });

  it('toggles to the terminal and persists the choice', async () => {
    const { storage } = renderDetail({ paneId: 'p2' });
    await waitFor(() => expect(screen.getByTestId('surface-toggle')).toBeTruthy());
    fireEvent.press(screen.getByTestId('surface-toggle'));
    await waitFor(() => expect(screen.getByTestId('slot-terminal')).toBeTruthy());
    expect(readSurface(storage)).toBe('terminal');
  });

  it('opens on the surface a deep link names without saving it', async () => {
    const { storage } = renderDetail({ paneId: 'p2', surface: 'terminal' });
    await waitFor(() => expect(screen.getByTestId('slot-terminal')).toBeTruthy());
    expect(readSurface(storage)).toBe('chat');
  });

  it('a fresh surface request brings an open detail back to Chat (a Composer handoff)', async () => {
    const storage = new MemoryStorage();
    const settings = new SettingsStore(new MemoryStorage());
    const detail = (request?: string) => (
      <ThemeProvider themeId="indigo">
        <SettingsProvider store={settings} authenticator={fakeAuthenticator(null)}>
          <AgentDetailScreen
            hostId="demo"
            paneId="p2"
            storage={storage}
            onSwitch={jest.fn()}
            surface={request ? 'chat' : undefined}
            surfaceRequest={request}
          />
        </SettingsProvider>
      </ThemeProvider>
    );
    const view = await render(detail());
    await waitFor(() => expect(screen.getByTestId('surface-toggle')).toBeTruthy());
    fireEvent.press(screen.getByTestId('surface-toggle'));
    await waitFor(() => expect(screen.getByTestId('slot-terminal')).toBeTruthy());
    await view.rerender(detail('1'));
    await waitFor(() => expect(screen.getByTestId('slot-chat')).toBeTruthy());
    fireEvent.press(screen.getByTestId('surface-toggle'));
    await waitFor(() => expect(screen.getByTestId('slot-terminal')).toBeTruthy());
    await view.rerender(detail('2'));
    await waitFor(() => expect(screen.getByTestId('slot-chat')).toBeTruthy());
  });

  it('switches to another Agent from the title', async () => {
    const { onSwitch } = renderDetail({ paneId: 'p2', surface: 'terminal' });
    await waitFor(() => expect(screen.getByTestId('agent-header-title')).toBeTruthy());
    fireEvent.press(screen.getByTestId('agent-header-title'));
    await waitFor(() => expect(screen.getByTestId('agent-header-agents-p3')).toBeTruthy());
    fireEvent.press(screen.getByTestId('agent-header-agents-p3'));
    await waitFor(() =>
      expect(onSwitch).toHaveBeenCalledWith(
        expect.objectContaining({
          hostId: 'demo',
          agent: expect.objectContaining({ pane_id: 'p3' }),
        }),
      ),
    );
  });

  it('stays put when the current Agent is picked', async () => {
    const { onSwitch } = renderDetail({ paneId: 'p2', surface: 'terminal' });
    await waitFor(() => expect(screen.getByTestId('agent-header-title')).toBeTruthy());
    fireEvent.press(screen.getByTestId('agent-header-title'));
    await waitFor(() => expect(screen.getByTestId('agent-header-agents-p2')).toBeTruthy());
    fireEvent.press(screen.getByTestId('agent-header-agents-p2'));
    await waitFor(() => expect(screen.queryByTestId('agent-header-agents-p2')).toBeNull());
    expect(onSwitch).not.toHaveBeenCalled();
  });

  it('has no status row or Agent capsule on either surface', async () => {
    renderDetail({ paneId: 'p2' });
    await waitFor(() => expect(screen.getByTestId('agent-header')).toBeTruthy());
    expect(screen.queryByTestId('status-line')).toBeNull();
    expect(screen.queryByTestId('agent-switcher')).toBeNull();
    fireEvent.press(screen.getByTestId('surface-toggle'));
    await waitFor(() => expect(screen.getByTestId('slot-terminal')).toBeTruthy());
    expect(screen.queryByTestId('status-line')).toBeNull();
    expect(screen.queryByTestId('agent-switcher')).toBeNull();
  });

  it.each(['chat', 'terminal'] as const)(
    'opens Changes from the header line on the %s',
    async (surface) => {
      const onOpenChanges = jest.fn();
      renderDetail({ paneId: 'p2', surface, onOpenChanges });
      await waitFor(() => expect(screen.getByTestId('agent-header-git')).toBeTruthy());
      fireEvent.press(screen.getByTestId('agent-header-git'));
      expect(onOpenChanges).toHaveBeenCalledTimes(1);
    },
  );

  it('dots Sessions for another Blocked Agent', async () => {
    renderDetail({ paneId: 'p2' });
    await waitFor(() => expect(screen.getByTestId('agent-header-sidebar-dot')).toBeTruthy());
  });

  it('draws no dot for the Blocked Agent on screen', async () => {
    renderDetail({ paneId: 'p1' });
    await waitFor(() => expect(screen.getByTestId('agent-header')).toBeTruthy());
    expect(screen.queryByTestId('agent-header-sidebar-dot')).toBeNull();
  });

  it('turns the terminal toolbar on and off from the header menu', async () => {
    const { settings } = renderDetail({ paneId: 'p2', surface: 'terminal' });
    const before = settings.get('terminalToolbarVisible');
    await waitFor(() => expect(screen.getByTestId('agent-header-more')).toBeTruthy());
    fireEvent.press(screen.getByTestId('agent-header-more'));
    await waitFor(() => expect(screen.getByTestId('action-menu-terminal-toolbar')).toBeTruthy());
    fireEvent.press(screen.getByTestId('action-menu-terminal-toolbar'));
    await waitFor(() => expect(settings.get('terminalToolbarVisible')).toBe(!before));
  });

  it('keeps the toolbar item off the Chat menu', async () => {
    renderDetail({ paneId: 'p2' });
    await waitFor(() => expect(screen.getByTestId('agent-header-more')).toBeTruthy());
    fireEvent.press(screen.getByTestId('agent-header-more'));
    await waitFor(() => expect(screen.getByTestId('action-menu-surface-chat')).toBeTruthy());
    expect(screen.queryByTestId('action-menu-terminal-toolbar')).toBeNull();
  });

  it('says so when the Agent is not listed', async () => {
    renderDetail({ paneId: 'nope' });
    await waitFor(() => expect(screen.getByTestId('agent-gone')).toBeTruthy());
  });

  it('focuses a Done Agent once, and leaves a working one alone', async () => {
    const store = createDemoConsoleStore();
    const focus = jest.spyOn(store, 'focusAgent').mockResolvedValue();
    const view = (paneId: string) => (
      <ThemeProvider themeId="indigo">
        <TestSettings>
          <ConsoleStoreProvider store={store}>
            <AgentDetailScreen
              hostId="demo"
              paneId={paneId}
              storage={new MemoryStorage()}
              onSwitch={jest.fn()}
            />
          </ConsoleStoreProvider>
        </TestSettings>
      </ThemeProvider>
    );
    const first = await render(view('p2'));
    await waitFor(() => expect(screen.getByTestId('agent-header')).toBeTruthy());
    expect(focus).not.toHaveBeenCalled();
    await first.unmount();
    render(view('p4'));
    await waitFor(() => expect(focus).toHaveBeenCalledTimes(1));
    expect(focus).toHaveBeenCalledWith('demo', 'p4', expect.any(Function));
  });

  it('parses only known surfaces from a deep link', () => {
    expect(parseSurface('terminal')).toBe('terminal');
    expect(parseSurface(['chat'])).toBe('chat');
    expect(parseSurface('other')).toBeUndefined();
  });
});

describe('Chat beside the terminal', () => {
  const window = Dimensions.get('window');
  const atWidth = (width: number) => Dimensions.set({ window: { ...window, width } });
  afterEach(async () => {
    await act(async () => Dimensions.set({ window }));
  });

  it('shows Chat and the terminal side by side in a wide window on the terminal', async () => {
    atWidth(1000);
    renderDetail({ paneId: 'p2', surface: 'terminal' });
    await waitFor(() => expect(screen.getByTestId('terminal-surface')).toBeTruthy());
    expect(screen.getByTestId('detail-surfaces-list')).toContainElement(
      screen.getByTestId('chat-timeline'),
    );
    expect(screen.getByTestId('detail-surfaces-detail')).toContainElement(
      screen.getByTestId('terminal-surface'),
    );
  });

  it('keeps Chat alone on Chat at any width: the terminal is not mounted', async () => {
    atWidth(1000);
    renderDetail({ paneId: 'p2', surface: 'chat' });
    await waitFor(() => expect(screen.getByTestId('chat-timeline')).toBeTruthy());
    expect(screen.queryByTestId('terminal-surface')).toBeNull();
  });

  it('shows one surface in compact, as before', async () => {
    atWidth(390);
    renderDetail({ paneId: 'p2', surface: 'terminal' });
    await waitFor(() => expect(screen.getByTestId('terminal-surface')).toBeTruthy());
    expect(screen.queryByTestId('chat-timeline')).toBeNull();
  });

  it('keeps the same terminal view when its pane goes from beside Chat to alone and back', async () => {
    atWidth(1000);
    renderDetail({ paneId: 'p2', surface: 'terminal' });
    await waitFor(() => expect(screen.getByTestId('terminal-slot')).toBeTruthy());
    expect(screen.getByTestId('chat-timeline')).toBeTruthy();
    expect(mockTerminalMounts).toHaveBeenCalledTimes(1);
    await act(async () => atWidth(390));
    expect(screen.queryByTestId('chat-timeline')).toBeNull();
    await act(async () => atWidth(1000));
    expect(screen.getByTestId('chat-timeline')).toBeTruthy();
    expect(screen.getAllByTestId('terminal-slot')).toHaveLength(1);
    expect(mockTerminalMounts).toHaveBeenCalledTimes(1);
  });

  it('mounts the terminal only while it is the surface, in a wide window', async () => {
    atWidth(1000);
    renderDetail({ paneId: 'p2', surface: 'chat' });
    await waitFor(() => expect(screen.getByTestId('surface-toggle')).toBeTruthy());
    fireEvent.press(screen.getByTestId('surface-toggle'));
    await waitFor(() => expect(screen.getByTestId('terminal-surface')).toBeTruthy());
    expect(screen.getAllByTestId('terminal-surface')).toHaveLength(1);
    expect(screen.getByTestId('chat-timeline')).toBeTruthy();
    fireEvent.press(screen.getByTestId('surface-toggle'));
    await waitFor(() => expect(screen.queryByTestId('terminal-surface')).toBeNull());
    expect(screen.getByTestId('chat-timeline')).toBeTruthy();
  });
});
