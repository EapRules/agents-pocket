import { fireEvent, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { renderThemed } from '../test-utils';
import { KeyboardDock, type KeySpec } from './KeyboardDock';

const ROWS: KeySpec[][] = [
  [
    { id: 'a', label: 'a' },
    { id: 'b', label: 'b', weight: 3 },
  ],
  [{ id: 'c', label: 'c' }],
];

describe('KeyboardDock fit mode', () => {
  it('scrolls each row by default', async () => {
    await renderThemed(<KeyboardDock rows={ROWS} onKey={jest.fn()} />);
    expect(screen.getAllByTestId('key-row-scroll')).toHaveLength(ROWS.length);
    expect(screen.queryAllByTestId('key-row-fit')).toHaveLength(0);
  });

  it('fits each row to the width: no scroll views, weights reach the style', async () => {
    const onKey = jest.fn();
    await renderThemed(<KeyboardDock rows={ROWS} onKey={onKey} fit />);
    expect(screen.queryAllByTestId('key-row-scroll')).toHaveLength(0);
    expect(screen.getAllByTestId('key-row-fit')).toHaveLength(ROWS.length);
    const grow = (id: string) =>
      StyleSheet.flatten(screen.getByTestId(`key-${id}`).props.style)?.flexGrow;
    expect(grow('a')).toBe(1);
    expect(grow('b')).toBe(3);
    await fireEvent.press(screen.getByTestId('key-b'));
    expect(onKey).toHaveBeenCalledTimes(1);
  });
});
