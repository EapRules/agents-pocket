import { act, screen } from '@testing-library/react-native';
import { useEffect } from 'react';
import { Dimensions, Text } from 'react-native';
import { type EdgeInsets, SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { Screen } from '../primitives/Screen';
import { renderThemed } from '../test-utils';
import { paneSafeArea, useInsets } from '../theme/insets';
import { useLayoutMode } from '../theme/layoutMode';
import { SplitView, splitListWidth } from './SplitView';

const window = Dimensions.get('window');
const setWidth = (width: number) => Dimensions.set({ window: { ...window, width } });

function Probe({ id }: { id: string }) {
  const insets = useInsets();
  return (
    <Text
      testID={id}
    >{`${useLayoutMode()} ${insets.top} ${insets.left} ${insets.bottom} ${insets.right}`}</Text>
  );
}

const mounts = jest.fn();
function Mounted({ id }: { id: string }) {
  useEffect(() => mounts(id), [id]);
  return <Probe id={id} />;
}

// A route as the app's: one pane alone in compact, both from regular up.
function Route({ kept }: { kept: 'list' | 'detail' }) {
  const alone = useLayoutMode() === 'compact' ? kept : undefined;
  return <SplitView single={alone} list={<Mounted id="list" />} detail={<Mounted id="detail" />} />;
}

const resize = (width: number) => act(async () => setWidth(width));

// A system column on the left only, as a closed iPhone Duo keeps one.
const ASYMMETRIC: EdgeInsets = { top: 47, left: 59, bottom: 34, right: 0 };

const renderSplit = (insets: EdgeInsets = ASYMMETRIC) =>
  renderThemed(
    <SafeAreaInsetsContext.Provider value={insets}>
      <Probe id="outside" />
      <SplitView list={<Probe id="list" />} detail={<Probe id="detail" />} />
    </SafeAreaInsetsContext.Provider>,
  );

describe('SplitView', () => {
  afterEach(async () => {
    await act(async () => Dimensions.set({ window }));
  });

  it('gives a pane the layout mode of its own width, not the window', async () => {
    setWidth(1000);
    await renderSplit();
    expect(screen.getByTestId('outside').props.children).toMatch(/^wide /);
    expect(screen.getByTestId('list').props.children).toMatch(/^compact /);
    expect(screen.getByTestId('detail').props.children).toMatch(/^regular /);
  });

  it('keeps the list pane at its metric and under its share of a narrow window', () => {
    expect(splitListWidth(1000)).toBe(300);
    expect(splitListWidth(600)).toBe(270);
  });

  it('shares the safe area: top and bottom in both panes, each side in one pane only', async () => {
    setWidth(1000);
    await renderSplit({ top: 47, left: 12, bottom: 34, right: 20 });
    expect(screen.getByTestId('list').props.children).toBe('compact 47 12 34 0');
    expect(screen.getByTestId('detail').props.children).toBe('regular 47 0 34 20');
  });

  it('copies each side as it is: an inset on one side is never mirrored to the other', () => {
    expect(paneSafeArea(ASYMMETRIC, 'leading').insets).toEqual(ASYMMETRIC);
    expect(paneSafeArea(ASYMMETRIC, 'trailing').insets).toEqual({ ...ASYMMETRIC, left: 0 });
    expect(paneSafeArea(ASYMMETRIC, 'leading', true).insets).toEqual({ ...ASYMMETRIC, left: 0 });
    expect(paneSafeArea(ASYMMETRIC, 'trailing', true).insets).toEqual(ASYMMETRIC);
  });

  it("lets a pane's Screen pad only the pane's own side", async () => {
    setWidth(900);
    await renderThemed(
      <SplitView
        list={<Screen testID="list-screen">{null}</Screen>}
        detail={<Screen testID="detail-screen">{null}</Screen>}
      />,
    );
    const edges = (id: string) => screen.getByTestId(id).props.edges;
    expect(edges('list-screen')).toMatchObject({ top: 'additive', left: 'additive', right: 'off' });
    expect(edges('detail-screen')).toMatchObject({
      top: 'additive',
      left: 'off',
      right: 'additive',
    });
  });

  it.each([
    ['detail', 'list'],
    ['list', 'detail'],
  ] as const)(
    'keeps the %s pane mounted when the window opens to two panes and back',
    async (kept, other) => {
      mounts.mockClear();
      setWidth(400);
      await renderThemed(<Route kept={kept} />);
      expect(screen.queryByTestId(other)).toBeNull();
      // Alone, the pane is no scope: it reads the window, as without a split.
      expect(screen.getByTestId(kept).props.children).toMatch(/^compact /);
      await resize(1000);
      expect(screen.getByTestId(other)).toBeTruthy();
      await resize(400);
      expect(screen.queryByTestId(other)).toBeNull();
      expect(mounts.mock.calls.filter(([id]) => id === kept)).toHaveLength(1);
    },
  );

  it('adds no scope to a pane shown alone', async () => {
    setWidth(1000);
    await renderThemed(
      <SafeAreaInsetsContext.Provider value={ASYMMETRIC}>
        <SplitView single="detail" list={null} detail={<Probe id="detail" />} />
      </SafeAreaInsetsContext.Provider>,
    );
    expect(screen.getByTestId('detail').props.children).toBe('wide 47 59 34 0');
    expect(screen.queryByTestId('split-view-hairline')).toBeNull();
  });
});
