// Layout: the viewport, the density tier and where the picture sits under the hero text.
import { tierFor, WPP } from './config.js';
import { view } from './state.js';

/**
 * Measures the page into `view`. `D` is the derived field (null before it loads) and `geo` its frame.
 * Returns true when the density tier changed, which means the cloud has to be rebuilt.
 */
export function measure({ canvas, hero, copy }, D, geo) {
  view.W = innerWidth;
  view.H = canvas.clientHeight || innerHeight;
  view.DPR = Math.min(2, devicePixelRatio || 1);
  if (!D) return false;
  const tier = tierFor(view.W);
  const changed = tier !== view.tier;
  view.tier = tier;

  view.heroH = hero.offsetHeight;
  // The scroll that takes the camera into the gap: the hero's height, or what the page has if it is shorter.
  view.travel = Math.min(
    view.heroH,
    Math.max(240, document.documentElement.scrollHeight - innerHeight),
  );
  view.copyBottom = copy.offsetTop + copy.offsetHeight;
  const narrow = view.W < 600;
  const top = view.copyBottom + (narrow ? 10 : 14);
  const bottom = view.heroH - (narrow ? 60 : 20);
  const regionH = Math.max(120, bottom - top);
  const half = view.W < 900 ? 520 : 720;
  const yMax = geo.gy - D.y0 * WPP;
  const yMin = geo.gy - (D.y1 + 1) * WPP;
  view.S = Math.min(view.W / (2 * half), (regionH * 1.05) / (yMax - yMin));
  view.OX = view.W / 2;
  view.OY = top + regionH / 2 + ((yMin + yMax) / 2) * view.S;
  return changed;
}
