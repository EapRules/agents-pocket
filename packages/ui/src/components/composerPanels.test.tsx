import { fireEvent, screen } from '@testing-library/react-native';
import type { ComponentProps, ReactElement } from 'react';
import { StyleSheet } from 'react-native';
import { renderThemed } from '../test-utils';
import { ThemeProvider } from '../theme/theme';
import { ComposerCard } from './agentBar';

const rerenderThemed = (rerender: (ui: ReactElement) => Promise<void>, ui: ReactElement) =>
  rerender(<ThemeProvider themeId="indigo">{ui}</ThemeProvider>);

describe('ComposerCard growth', () => {
  const inputStyle = () =>
    StyleSheet.flatten(screen.getByTestId('composer-card-input').props.style);

  it('lets a long draft take its content height, up to six lines', async () => {
    await renderThemed(
      <ComposerCard value={'line\n'.repeat(12)} onChange={jest.fn()} onSend={jest.fn()} />,
    );
    const style = inputStyle();
    // flex: 1 in the stacked column is basis 0 and pins the field at minHeight.
    expect(style.flex).toBeUndefined();
    expect(style.flexGrow ?? 0).toBe(0);
    expect(style.height).toBeUndefined();
    expect(style.alignSelf).toBe('stretch');
    expect(style.maxHeight).toBeGreaterThan(style.minHeight as number);
    expect(style.maxHeight).toBeGreaterThanOrEqual(6 * 22);
  });

  it('keeps a short draft on one line, filling the row', async () => {
    await renderThemed(<ComposerCard value="hi" onChange={jest.fn()} onSend={jest.fn()} />);
    const style = inputStyle();
    expect(style.height).toBe(style.minHeight);
    expect(style.flexGrow).toBe(1);
  });
});

describe('ComposerCard panels', () => {
  const item = (key: string) => ({ key, title: key, onPress: jest.fn() });
  const card = (value = '', extra: Partial<ComponentProps<typeof ComposerCard>> = {}) => (
    <ComposerCard
      value={value}
      expanded
      onChange={jest.fn()}
      onSend={jest.fn()}
      addMenu={[item('file')]}
      moreMenu={[item('paste')]}
      shortcutsMenu={[item('esc')]}
      commands={[{ name: '/clear', description: 'Clear' }]}
      {...extra}
    />
  );
  const rowOf = (panel: string, key: string) => `composer-card-${panel}-${key}`;

  it('opens a panel from its button and closes it from the same button', async () => {
    await renderThemed(card());
    await fireEvent.press(screen.getByTestId('composer-card-add'));
    expect(screen.getByTestId(rowOf('add', 'file'))).toBeTruthy();
    expect(screen.getByTestId('composer-card-add').props.accessibilityState.expanded).toBe(true);
    await fireEvent.press(screen.getByTestId('composer-card-add'));
    expect(screen.queryByTestId(rowOf('add', 'file'))).toBeNull();
    expect(screen.getByTestId('composer-card-add').props.accessibilityState.expanded).toBe(false);
  });

  it('keeps one panel open at a time', async () => {
    await renderThemed(card());
    await fireEvent.press(screen.getByTestId('composer-card-add'));
    await fireEvent.press(screen.getByTestId('composer-card-more'));
    expect(screen.queryByTestId(rowOf('add', 'file'))).toBeNull();
    expect(screen.getByTestId(rowOf('more', 'paste'))).toBeTruthy();
    await fireEvent.press(screen.getByTestId('composer-card-shortcuts'));
    expect(screen.queryByTestId(rowOf('more', 'paste'))).toBeNull();
    expect(screen.getByTestId(rowOf('shortcuts', 'esc'))).toBeTruthy();
  });

  it('runs the picked row and closes; Close closes too', async () => {
    const file = item('file');
    await renderThemed(card('', { addMenu: [file] }));
    await fireEvent.press(screen.getByTestId('composer-card-add'));
    await fireEvent.press(screen.getByTestId(rowOf('add', 'file')));
    expect(file.onPress).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('composer-card-add-panel')).toBeNull();
    await fireEvent.press(screen.getByTestId('composer-card-more'));
    await fireEvent.press(screen.getByTestId('composer-card-more-panel-close'));
    expect(screen.queryByTestId('composer-card-more-panel')).toBeNull();
  });

  it('closes on Send', async () => {
    await renderThemed(card('hello'));
    await fireEvent.press(screen.getByTestId('composer-card-add'));
    await fireEvent.press(screen.getByTestId('composer-card-send'));
    expect(screen.queryByTestId('composer-card-add-panel')).toBeNull();
  });

  it('shows the "/" list over an open panel', async () => {
    const { rerender } = await renderThemed(card());
    await fireEvent.press(screen.getByTestId('composer-card-add'));
    await rerenderThemed(rerender, card('/'));
    expect(screen.queryByTestId('composer-card-add-panel')).toBeNull();
    expect(screen.getByTestId('composer-card-skills')).toBeTruthy();
  });

  it('draws an item as a row: icon, subtitle, destructive, disabled', async () => {
    const press = jest.fn();
    await renderThemed(
      card('', {
        moreMenu: [
          { key: 'a', title: 'Alpha', subtitle: 'Does a', icon: 'note', onPress: press },
          { key: 'b', title: 'Beta', disabled: true, onPress: press },
          { key: 'c', title: 'Close', destructive: true, section: '', onPress: press },
        ],
      }),
    );
    await fireEvent.press(screen.getByTestId('composer-card-more'));
    expect(screen.getByText('Does a')).toBeTruthy();
    await fireEvent.press(screen.getByTestId(rowOf('more', 'b')));
    expect(press).not.toHaveBeenCalled();
    expect(screen.getByTestId('composer-card-more-c')).toBeTruthy();
  });
});
