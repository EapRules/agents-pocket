import type { AttachStatus } from '@openagentspocket/core';
import { ThemeProvider } from '@openagentspocket/ui';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { TerminalStatus } from './TerminalStatus';

const onRetry = jest.fn();
const onOther = jest.fn();
const actions = [
  { title: 'Retry', onPress: onRetry, testID: 'terminal-retry' },
  { title: 'Other', onPress: onOther, testID: 'terminal-other' },
];

async function show(status: AttachStatus, stopped?: 'hidden' | 'connecting') {
  await render(
    <ThemeProvider themeId="indigo">
      <TerminalStatus status={status} actions={actions} stopped={stopped} />
    </ThemeProvider>,
  );
}

describe('a terminal status', () => {
  it('draws nothing while live', async () => {
    await show({ kind: 'live' });
    expect(screen.queryByTestId('terminal-status')).toBeNull();
  });

  it('draws nothing when stopped for a surface that hides it (the Agent)', async () => {
    await show({ kind: 'stopped' });
    expect(screen.queryByTestId('terminal-status')).toBeNull();
  });

  it('shows the connecting state when stopped for a surface that asks for it (the Shell)', async () => {
    await show({ kind: 'stopped' }, 'connecting');
    expect(screen.getByTestId('terminal-connecting')).toBeTruthy();
    expect(screen.queryByTestId('terminal-retry')).toBeNull();
  });

  it.each(['waitingForSize', 'connecting', 'reconnecting'] as const)(
    'waits without actions while %s',
    async (kind) => {
      await show({ kind });
      expect(screen.getByTestId('terminal-status')).toBeTruthy();
      expect(screen.getByTestId('terminal-connecting')).toBeTruthy();
      expect(screen.queryByTestId('terminal-retry')).toBeNull();
    },
  );

  it('offers each of its surface actions once ended, each calling its own handler', async () => {
    await show({ kind: 'ended', message: 'gone' });
    expect(screen.getByTestId('terminal-ended')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('terminal-retry'));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onOther).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('terminal-other'));
    expect(onOther).toHaveBeenCalledTimes(1);
  });
});
