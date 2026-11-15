import { nativeDetents, nativeMaxHeight } from './NativeSheet';

describe('nativeDetents', () => {
  it('maps the sheet detents to the native ones', () => {
    expect(nativeDetents('fit', 0.92)).toEqual(['auto']);
    expect(nativeDetents('medium', 0.92)).toEqual([0.5]);
    expect(nativeDetents('large', 0.92)).toEqual([0.92]);
    expect(nativeDetents({ fraction: 0.65 }, 0.92)).toEqual([0.65]);
    expect(nativeDetents({ fraction: 2 }, 0.92)).toEqual([0.92]);
  });
});

describe('nativeMaxHeight', () => {
  it('caps a fit sheet where large stops, and leaves fixed detents alone', () => {
    expect(nativeMaxHeight('fit', 1000, 0.92)).toBe(920);
    expect(nativeMaxHeight('large', 1000, 0.92)).toBeUndefined();
    expect(nativeMaxHeight({ fraction: 0.5 }, 1000, 0.92)).toBeUndefined();
  });
});
