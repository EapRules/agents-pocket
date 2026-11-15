import { DRAG_THRESHOLD, panelSize, settleDetent } from './sheetDetents';

describe('settleDetent', () => {
  it('grows medium to large on a long upward drag', () => {
    expect(settleDetent('medium', -DRAG_THRESHOLD, 0)).toBe('large');
  });
  it('shrinks large to medium on a long downward drag', () => {
    expect(settleDetent('large', DRAG_THRESHOLD, 0)).toBe('medium');
  });
  it('closes from medium or fit on a downward drag', () => {
    expect(settleDetent('medium', DRAG_THRESHOLD, 0)).toBe('close');
    expect(settleDetent('fit', DRAG_THRESHOLD, 0)).toBe('close');
  });
  it('stays put on a short, slow drag', () => {
    expect(settleDetent('large', 10, 0.1)).toBe('large');
    expect(settleDetent('medium', -10, 0.1)).toBe('medium');
  });
  it('a fast flick counts', () => {
    expect(settleDetent('medium', -10, -1)).toBe('large');
  });
});

describe('panelSize', () => {
  const shares = { min: 0.3, max: 0.92 };
  it('a fit panel stops at the max share and shrinks when the room is smaller', () => {
    const size = panelSize('fit', 1000, 0, shares);
    expect(size.maxHeight).toBe(920);
    expect(size.minHeight).toBe(300);
    expect(size.flexShrink).toBe(1);
    expect(size.height).toBeUndefined();
  });
  it('a fixed panel takes its height, grows with the drag up to the max share', () => {
    expect(panelSize('medium', 1000, 0, shares).height).toBe(500);
    expect(panelSize('medium', 1000, 100, shares).height).toBe(600);
    expect(panelSize('large', 1000, 500, shares).height).toBe(920);
    expect(panelSize({ fraction: 0.1 }, 1000, 0, shares).height).toBe(200);
  });
});
