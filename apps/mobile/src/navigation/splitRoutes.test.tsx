import { agentKey } from '@openagentspocket/core';
import { ThemeProvider } from '@openagentspocket/ui';
import { act, render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { Dimensions } from 'react-native';
import AgentRoute from '@/app/agent/[hostId]/[paneId]';
import Index from '@/app/index';
import { hrefs } from './hrefs';

// The routes' own wiring is under test; the screens they mount are stand-ins that expose their props.
const mockRouter = { push: jest.fn(), setParams: jest.fn(), navigate: jest.fn(), back: jest.fn() };
const mockHome = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useIsFocused: () => true,
  useFocusEffect: () => {},
  useLocalSearchParams: () => ({ hostId: 'h1', paneId: 'p1' }),
}));
jest.mock('@/home/HomeScreen', () => ({
  HomeScreen: (props: object) => {
    mockHome(props);
    return require('react').createElement(require('react-native').View, { testID: 'home' });
  },
}));
jest.mock('@/agent-detail/AgentDetailScreen', () => ({
  AgentDetailScreen: () =>
    require('react').createElement(require('react-native').View, { testID: 'agent-detail' }),
}));
jest.mock('@/agent-detail/composer/AgentComposer', () => ({ COMPOSER_MORE_ANCHOR: 'more' }));
jest.mock('@/console/hooks', () => ({ useAgent: () => undefined, useConsoleStore: () => ({}) }));
jest.mock('@/navigation/entryMenus', () => ({ useEntryMenus: () => ({ agent: () => [] }) }));
jest.mock('@/features/hosts/useAddHostSheet', () => ({
  useAddHostSheet: () => ({ open: () => {}, sheet: null }),
}));
jest.mock('@/diagnostics/crashStorage', () => ({ crashStorage: {} }));
jest.mock('@/settings/deviceStorage', () => ({ deviceStorage: {} }));

const window = Dimensions.get('window');
const renderAt = async (width: number, ui: ReactElement) => {
  Dimensions.set({ window: { ...window, width } });
  await render(<ThemeProvider themeId="indigo">{ui}</ThemeProvider>);
};
const row = { hostId: 'h2', agent: { pane_id: 'p2' } };
const openAgent = () => mockHome.mock.lastCall?.[0].onOpenAgent(row);

describe('the split routes', () => {
  afterEach(async () => {
    jest.clearAllMocks();
    await act(async () => Dimensions.set({ window }));
  });

  it('/ in compact is Home alone, and an Agent is pushed', async () => {
    await renderAt(390, <Index />);
    expect(screen.getByTestId('split-view-list')).toContainElement(screen.getByTestId('home'));
    expect(screen.queryByTestId('split-view-hairline')).toBeNull();
    expect(screen.queryByTestId('split-view-detail')).toBeNull();
    openAgent();
    expect(mockRouter.push).toHaveBeenCalledWith(hrefs.agent('h2', 'p2'));
  });

  it('/ from regular up is Home in the list pane beside an empty detail', async () => {
    await renderAt(700, <Index />);
    expect(screen.getByTestId('split-view-list')).toContainElement(screen.getByTestId('home'));
    expect(screen.getByTestId('split-view-detail')).toContainElement(
      screen.getByTestId('split-empty-detail'),
    );
    openAgent();
    expect(mockRouter.push).toHaveBeenCalledWith(hrefs.agent('h2', 'p2'));
  });

  it('the Agent route in compact is the Agent alone', async () => {
    await renderAt(390, <AgentRoute />);
    expect(screen.getByTestId('split-view-detail')).toContainElement(
      screen.getByTestId('agent-detail'),
    );
    expect(screen.queryByTestId('split-view-hairline')).toBeNull();
    expect(screen.queryByTestId('split-view-list')).toBeNull();
    expect(screen.queryByTestId('home')).toBeNull();
  });

  it('the Agent route from regular up puts Home beside it and swaps the Agent in place', async () => {
    await renderAt(700, <AgentRoute />);
    expect(screen.getByTestId('split-view-list')).toContainElement(screen.getByTestId('home'));
    expect(screen.getByTestId('split-view-detail')).toContainElement(
      screen.getByTestId('agent-detail'),
    );
    expect(mockHome.mock.lastCall?.[0].selectedAgent).toBe(agentKey('h1', 'p1'));
    openAgent();
    expect(mockRouter.setParams).toHaveBeenCalledWith({ hostId: 'h2', paneId: 'p2' });
    expect(mockRouter.push).not.toHaveBeenCalled();
  });
});
