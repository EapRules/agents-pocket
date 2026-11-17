import { fireEvent, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { impact } from '../haptics';
import { renderThemed } from '../test-utils';
import { ThemeProvider } from '../theme/theme';
import { ComposerCard } from './agentBar';
import { defaultAgentBarLabels } from './agentBarLabels';

jest.mock('../haptics', () => ({ impact: jest.fn() }));

describe('ComposerCard microphone', () => {
  const toggle = jest.fn();
  const card = (value: string, options: { working?: boolean; listening?: boolean } = {}) => (
    <ComposerCard
      value={value}
      onChange={jest.fn()}
      onSend={jest.fn()}
      onStop={jest.fn()}
      working={options.working}
      dictation={{ listening: options.listening ?? false, onToggle: toggle }}
    />
  );

  it("stands in Send's place with an empty draft and starts dictation", async () => {
    await renderThemed(card(''));
    expect(screen.queryByTestId('composer-card-send')).toBeNull();
    await fireEvent.press(screen.getByTestId('composer-card-mic'));
    expect(toggle).toHaveBeenCalled();
  });

  it('gives way to Send once the draft has text', async () => {
    await renderThemed(card('Run the tests'));
    expect(screen.queryByTestId('composer-card-mic')).toBeNull();
    expect(screen.getByTestId('composer-card-send')).toBeTruthy();
  });

  it('sits beside Stop while the Agent works, and keeps Send away while it listens', async () => {
    await renderThemed(card('', { working: true }));
    expect(screen.getByTestId('composer-card-mic')).toBeTruthy();
    expect(screen.getByTestId('composer-card-stop')).toBeTruthy();
    // Live words fill the draft while it listens: a tap meant to stop never sends half a phrase.
    await renderThemed(card('Run the', { listening: true }));
    expect(screen.getByTestId('composer-card-mic')).toBeTruthy();
    expect(screen.queryByTestId('composer-card-send')).toBeNull();
    await renderThemed(card('Run the', { listening: true, working: true }));
    expect(screen.queryByTestId('composer-card-send')).toBeNull();
  });

  it('shows that it is listening, and says so to assistive tech', async () => {
    await renderThemed(card(''));
    const idle = screen.getByTestId('composer-card-mic');
    expect(idle.props.accessibilityState).toMatchObject({ selected: false });
    expect(idle.props.accessibilityLabel).toBe(defaultAgentBarLabels.dictate);
    expect(screen.queryByTestId('composer-card-mic-listening')).toBeNull();

    await renderThemed(card('', { listening: true }));
    const live = screen.getByTestId('composer-card-mic');
    expect(live.props.accessibilityState).toMatchObject({ selected: true });
    expect(live.props.accessibilityLabel).toBe(defaultAgentBarLabels.stopDictating);
    expect(screen.getByTestId('composer-card-mic-listening')).toBeTruthy();
  });

  it("puts the listening hint in the empty input, over the caller's placeholder", async () => {
    await renderThemed(card(''));
    const input = () => screen.getByTestId('composer-card-input');
    expect(input().props.placeholder).toBe(defaultAgentBarLabels.messagePlaceholder);
    await renderThemed(
      <ComposerCard
        value=""
        onChange={jest.fn()}
        onSend={jest.fn()}
        placeholder="Queued"
        dictation={{ listening: true, onToggle: toggle }}
      />,
    );
    expect(input().props.placeholder).toBe(defaultAgentBarLabels.listening);
  });

  it('taps lightly when listening starts and when it ends, not when drawn', async () => {
    const tap = jest.mocked(impact);
    tap.mockClear();
    const { rerender } = await renderThemed(card(''));
    const again = (ui: ReactElement) =>
      rerender(<ThemeProvider themeId="indigo">{ui}</ThemeProvider>);
    expect(tap).not.toHaveBeenCalled();
    await again(card('', { listening: true }));
    // A dictated draft takes the microphone away as it stops: the tap is still felt.
    await again(card('Run', { listening: false }));
    expect(tap.mock.calls).toEqual([['light'], ['light']]);
  });
});
