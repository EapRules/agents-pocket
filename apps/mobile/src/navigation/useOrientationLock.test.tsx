import { act, render } from '@testing-library/react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import { Dimensions } from 'react-native';
import { useOrientationLock } from './useOrientationLock';

jest.mock('expo-screen-orientation', () => ({
  OrientationLock: { PORTRAIT_UP: 3 },
  lockAsync: jest.fn(() => Promise.resolve()),
  unlockAsync: jest.fn(() => Promise.resolve()),
}));
const lock = ScreenOrientation.lockAsync as jest.Mock;
const unlock = ScreenOrientation.unlockAsync as jest.Mock;
const window = Dimensions.get('window');

function Probe() {
  useOrientationLock();
  return null;
}

const at = (width: number) => act(async () => Dimensions.set({ window: { ...window, width } }));

beforeEach(() => jest.clearAllMocks());
afterEach(() => at(window.width));

describe('useOrientationLock', () => {
  it('locks to portrait in a compact window', async () => {
    await at(402);
    await render(<Probe />);
    expect(lock).toHaveBeenCalledWith(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    expect(unlock).not.toHaveBeenCalled();
  });

  it.each([669, 951, 1200])('unlocks in a %s pt window', async (width) => {
    await at(width);
    await render(<Probe />);
    expect(unlock).toHaveBeenCalled();
    expect(lock).not.toHaveBeenCalled();
  });

  it('switches when the window changes mode', async () => {
    await at(402);
    await render(<Probe />);
    await at(669);
    expect(unlock).toHaveBeenCalledTimes(1);
    await at(402);
    expect(lock).toHaveBeenCalledTimes(2);
  });
});
