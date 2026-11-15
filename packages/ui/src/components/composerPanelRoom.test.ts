import {
  composerPanelMaxHeight,
  PANEL_HEAD,
  PANEL_MAX_SHARE,
  PANEL_MIN_ROWS,
  PANEL_ROW,
  STATUS_LINE_ROOM,
  TRANSCRIPT_STRIP,
} from './composerPanelRoom';

const base = { windowHeight: 874, topChrome: 110, keyboardHeight: 0, composerHeight: 60 };
const floor = PANEL_HEAD + PANEL_MIN_ROWS * PANEL_ROW;

describe('composerPanelMaxHeight', () => {
  it('is the window share with no keyboard', () => {
    expect(composerPanelMaxHeight(base)).toBeCloseTo(base.windowHeight * PANEL_MAX_SHARE);
  });

  it('is what the room allows with the keyboard up, keeping status line and strip', () => {
    const room = { ...base, keyboardHeight: 340 };
    const left = room.windowHeight - room.topChrome - room.keyboardHeight - room.composerHeight;
    expect(composerPanelMaxHeight(room)).toBe(left - STATUS_LINE_ROOM - TRANSCRIPT_STRIP);
    expect(composerPanelMaxHeight(room)).toBeLessThan(base.windowHeight * PANEL_MAX_SHARE);
  });

  it('gives up the transcript strip before shrinking under the floor', () => {
    const left = floor + STATUS_LINE_ROOM + 10;
    const room = { ...base, keyboardHeight: base.windowHeight - base.topChrome - 60 - left };
    expect(composerPanelMaxHeight(room)).toBe(floor + 10);
  });

  it('never goes under the head and three rows', () => {
    expect(composerPanelMaxHeight({ ...base, keyboardHeight: 700 })).toBe(floor);
  });
});
