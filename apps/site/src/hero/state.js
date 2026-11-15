// State shared by the entry, the input handlers, the engine and the still.
export const now = () => performance.now() / 1000;
export const reduce = matchMedia('(prefers-reduced-motion: reduce)');

/** Layout, measured by layout.js: viewport, device pixel ratio, scale of the picture and where its gap sits. */
export const view = {
  W: 0,
  H: 0,
  DPR: 1,
  S: 1,
  OX: 0,
  OY: 0,
  heroH: 600,
  travel: 600,
  copyBottom: 0,
  tier: null,
};

/** The pointer: position, speed, whether it is a finger (dragging steers) and the drag so far. */
export const ptr = {
  x: 0,
  y: 0,
  active: false,
  last: -1e9,
  speed: 0,
  pt: 0,
  touch: false,
  dragYaw: 0,
  dragPitch: 0,
  downX: 0,
  downY: 0,
  downT: 0,
};

/** When the last tap (the contact) happened; the engine starts a ripple when it changes. */
export const tap = { at: -1e9 };
