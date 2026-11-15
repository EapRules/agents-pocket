import { fireEvent, screen } from '@testing-library/react-native';
import { Banner } from '../primitives/Banner';
import { renderThemed } from '../test-utils';
import { BackgroundWorkList, sectionOpen } from './BackgroundWorkList';
import { agentPadKeys, KeyPad, swipedPage } from './KeyPad';
import {
  afterKey,
  dpadDirection,
  NO_MODIFIERS,
  nextModifierState,
  TerminalToolbar,
} from './TerminalToolbar';

describe('BackgroundWorkList sections', () => {
  const row = (id: string, kind: 'subagent' | 'command', state: 'running' | 'completed') => ({
    id,
    kind,
    title: id,
    state,
    caption: `${kind} · ${state}`,
  });
  const labels = { running: 'Running', finished: 'Finished', finishedFooter: '' };

  it('opens Finished only when nothing runs, and the user’s choice wins', () => {
    expect(sectionOpen('running', {}, 2)).toBe(true);
    expect(sectionOpen('finished', {}, 2)).toBe(false);
    expect(sectionOpen('finished', {}, 0)).toBe(true);
    expect(sectionOpen('finished', { finished: true }, 2)).toBe(true);
    expect(sectionOpen('running', { running: false }, 2)).toBe(false);
  });

  it('draws an icon by kind, hides collapsed rows, and reports a section toggle', async () => {
    const onToggleSection = jest.fn();
    await renderThemed(
      <BackgroundWorkList
        unfinished={[row('a', 'subagent', 'running')]}
        finished={[row('b', 'command', 'completed')]}
        expanded={new Set()}
        onToggle={jest.fn()}
        onToggleSection={onToggleSection}
        labels={labels}
      />,
    );
    expect(screen.getByTestId('work-sheet-a')).toBeTruthy();
    expect(screen.getByTestId('work-kind-subagent')).toBeTruthy();
    expect(screen.queryByTestId('work-sheet-b')).toBeNull();
    await fireEvent.press(screen.getByText('Finished'));
    expect(onToggleSection).toHaveBeenCalledWith('finished', true);
  });

  it('shows a row’s action only when it has one', async () => {
    const onPress = jest.fn();
    await renderThemed(
      <BackgroundWorkList
        unfinished={[]}
        finished={[
          { ...row('s', 'subagent', 'completed'), action: { label: 'View', onPress } },
          row('c', 'command', 'completed'),
        ]}
        expanded={new Set()}
        onToggle={jest.fn()}
        labels={labels}
      />,
    );
    await fireEvent.press(screen.getByTestId('work-open-s'));
    expect(onPress).toHaveBeenCalled();
    expect(screen.queryByTestId('work-open-c')).toBeNull();
    expect(screen.getByTestId('work-kind-command')).toBeTruthy();
  });
});

describe('Banner looks', () => {
  it('runs the row action and renders the floating look with its question', async () => {
    const onPress = jest.fn();
    await renderThemed(
      <Banner look="row" message="Failed" actionLabel="Retry" onAction={onPress} />,
    );
    await fireEvent.press(screen.getByTestId('banner-action'));
    expect(onPress).toHaveBeenCalled();
    await renderThemed(<Banner look="floating" title="Agent" message="Blocked" question="Edit?" />);
    expect(screen.getByTestId('banner-question')).toBeTruthy();
  });
});

describe('TerminalToolbar', () => {
  it('cycles a modifier off, armed, locked, off and releases armed after a key', () => {
    expect(nextModifierState('off')).toBe('armed');
    expect(nextModifierState('armed')).toBe('locked');
    expect(nextModifierState('locked')).toBe('off');
    expect(afterKey({ ...NO_MODIFIERS, ctrl: 'armed', alt: 'locked' })).toEqual({
      ctrl: 'off',
      alt: 'locked',
      shift: 'off',
    });
  });

  it('maps a drag to a direction outside the dead zone', () => {
    expect(dpadDirection(5, 5)).toBeNull();
    expect(dpadDirection(40, 3)).toBe('right');
    expect(dpadDirection(-40, 3)).toBe('left');
    expect(dpadDirection(2, -50)).toBe('up');
    expect(dpadDirection(2, 50)).toBe('down');
  });

  it('sends Esc with Ctrl armed, and the d-pad direction', async () => {
    const onKey = jest.fn();
    const onDpad = jest.fn();
    await renderThemed(
      <TerminalToolbar
        onKey={onKey}
        onDpad={onDpad}
        onToggleKeyboard={jest.fn()}
        moreItems={[]}
        defaultDpadOpen
      />,
    );
    await fireEvent.press(screen.getByTestId('toolbar-key-ctrl'));
    await fireEvent(screen.getByTestId('toolbar-key-esc'), 'pressIn');
    await fireEvent(screen.getByTestId('toolbar-key-esc'), 'pressOut');
    expect(onKey.mock.calls[0]?.[1]).toMatchObject({ ctrl: true });
    await fireEvent.press(screen.getByTestId('dpad-up'));
    expect(onDpad).toHaveBeenCalledWith('up', expect.objectContaining({ ctrl: false }));
  });
});

describe('KeyPad', () => {
  it('swipes between pages, changes tabs and sends a key', async () => {
    expect(swipedPage(0, 2, -60)).toBe(1);
    expect(swipedPage(1, 2, -60)).toBe(1);
    expect(swipedPage(1, 2, 60)).toBe(0);
    expect(swipedPage(0, 2, 10)).toBe(0);
    const onKey = jest.fn();
    const onPageChange = jest.fn();
    const onTabChange = jest.fn();
    await renderThemed(
      <KeyPad
        pages={[
          { id: 'agent', title: 'Agent', keys: agentPadKeys },
          { id: 'terminal', title: 'Terminal', keys: agentPadKeys },
        ]}
        page="agent"
        onPageChange={onPageChange}
        onKey={onKey}
        tabs={[{ id: 'keys', label: 'Keys', icon: 'keyboard' }]}
        tab="keys"
        onTabChange={onTabChange}
      />,
    );
    await fireEvent(screen.getByTestId('keypad-key-enter'), 'pressIn');
    await fireEvent(screen.getByTestId('keypad-key-enter'), 'pressOut');
    expect(onKey).toHaveBeenCalledWith(expect.objectContaining({ id: 'enter' }), 'agent');
    await fireEvent.press(screen.getByTestId('keypad-page-terminal'));
    expect(onPageChange).toHaveBeenCalledWith('terminal');
    await fireEvent.press(screen.getByTestId('keypad-tab-keys'));
    expect(onTabChange).toHaveBeenCalledWith('keys');
  });
});
