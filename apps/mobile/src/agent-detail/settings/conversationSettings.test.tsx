import { ComposerRegistry, FakeClock, MemoryStorage } from '@openagentspocket/core';
import { OverlayHost, ThemeProvider } from '@openagentspocket/ui';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { setDemoMode } from '@/connections/mode';
import { createDemoConsoleStore } from '@/console/demo';
import { ConsoleStoreProvider } from '@/console/hooks';
import { goldenScreen, PaneTransport } from '@/console/paneTransport.testkit';
import { TestSettings } from '@/settings/TestSettings';
import { AgentDetailScreen } from '../AgentDetailScreen';
import { ComposerRegistryProvider } from '../composer/composerContext';
import { type Surface, saveTerminalInput, type TerminalInput } from '../surface';

// The demo's scripted conversations carry the values the sheet reads.
beforeAll(() => setDemoMode(true));
afterAll(() => setDemoMode(undefined));

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn() }) }));
jest.mock('expo-clipboard', () => ({ getStringAsync: async () => '' }));

// The demo's Agents: p5 Claude Code idle, p2 Codex working, p1 Claude Code blocked.
async function renderDetail(paneId: string, surface: Surface = 'chat', input?: TerminalInput) {
  const transport = new PaneTransport();
  transport.text = goldenScreen('claude-01-ready', 'claude');
  const storage = new MemoryStorage();
  if (input) saveTerminalInput(storage, input);
  const registry = new ComposerRegistry({ storage, clock: new FakeClock() });
  await render(
    <ThemeProvider themeId="indigo">
      <TestSettings>
        <ConsoleStoreProvider store={createDemoConsoleStore(undefined, transport)}>
          <ComposerRegistryProvider registry={registry}>
            <AgentDetailScreen
              hostId="demo"
              paneId={paneId}
              storage={storage}
              surface={surface}
              onSwitch={jest.fn()}
            />
          </ComposerRegistryProvider>
          <OverlayHost />
        </ConsoleStoreProvider>
      </TestSettings>
    </ThemeProvider>,
  );
  return { transport, registry };
}

const press = async (testID: string) => fireEvent.press(await screen.findByTestId(testID));

/** Chat's "..." menu (it shows once the Composer has focus). */
async function openMenu() {
  fireEvent(await screen.findByTestId('composer-input'), 'focus');
  await press('composer-more');
}

async function openSheet() {
  await openMenu();
  await press('composer-more-conversation-settings');
  await screen.findByTestId('conversation-settings-sheet');
}

describe('the conversation settings entry and sheet', () => {
  it("the entry carries the Agent's known values", async () => {
    await renderDetail('p5');
    await openMenu();
    const entry = await screen.findByTestId('composer-more-conversation-settings');
    expect(entry).toHaveTextContent(/claude-opus-5-5/);
    expect(entry).toHaveTextContent(/High/);
  });

  it("lists the program's settings in its order", async () => {
    await renderDetail('p5');
    await openSheet();
    for (const id of ['setting-model', 'setting-effort', 'setting-fast']) {
      expect(screen.getByTestId(id)).toBeTruthy();
    }
  });

  it('a program that writes nothing shows its values, a picker and a read-only row', async () => {
    await renderDetail('p2');
    await openSheet();
    expect(screen.queryByTestId('setting-fast')).toBeNull();
    expect(screen.getByTestId('setting-model-value')).toHaveTextContent(/gpt-6-luna/);
    expect(screen.getByTestId('setting-model-terminal')).toBeTruthy();
    expect(screen.getByTestId('setting-effort-value')).toHaveTextContent(/xhigh/);
    expect(screen.queryByTestId('setting-effort-terminal')).toBeNull();
  });

  it('choosing a value shows the command and its notes and sends nothing', async () => {
    const { transport } = await renderDetail('p5');
    await openSheet();
    await press('setting-effort-xhigh');
    expect(await screen.findByTestId('setting-pending-command')).toHaveTextContent(
      /\/effort xhigh/,
    );
    expect(screen.getByTestId('setting-pending')).toHaveTextContent(/default for new sessions/);
    expect(transport.prompts).toEqual([]);
  });

  it('Apply sends exactly the planned text through the Composer, after reading the box', async () => {
    const { transport } = await renderDetail('p5');
    await openSheet();
    await press('setting-effort-xhigh');
    const reads = transport.reads;
    await press('setting-apply');
    await waitFor(() =>
      expect(transport.prompts).toEqual([{ target: 'p5', text: '/effort xhigh' }]),
    );
    expect(transport.reads).toBeGreaterThan(reads);
  });

  it('a blocked Agent shows every change disabled, with the reason', async () => {
    const { transport } = await renderDetail('p1');
    await openSheet();
    expect(screen.getByTestId('setting-effort-low')).toBeDisabled();
    expect(screen.getByTestId('setting-model-terminal')).toBeDisabled();
    expect(screen.getByTestId('setting-effort')).toHaveTextContent(/waiting for an answer/);
    expect(transport.prompts).toEqual([]);
  });

  it("a picker setting hands its draft to the terminal's Composer", async () => {
    await renderDetail('p5');
    await openSheet();
    await press('setting-model-terminal');
    await waitFor(() => expect(screen.getByTestId('slot-terminal')).toBeTruthy());
    expect((await screen.findByTestId('composer-input')).props.value).toBe('/model ');
  });

  it('the terminal\'s Compose reaches the sheet from its "..." menu', async () => {
    await renderDetail('p5', 'terminal', 'compose');
    await openSheet();
    expect(screen.getByTestId('setting-effort')).toBeTruthy();
  });

  it("the terminal's Keys reach the sheet from the key toolbar's More", async () => {
    await renderDetail('p5', 'terminal', 'keys');
    const slot = await screen.findByTestId('terminal-slot');
    await fireEvent(slot, 'layout', { nativeEvent: { layout: { width: 400, height: 300 } } });
    await press('toolbar-more');
    fireEvent.press(await screen.findByLabelText('Model and Effort'));
    expect(await screen.findByTestId('setting-effort')).toBeTruthy();
  });
});
