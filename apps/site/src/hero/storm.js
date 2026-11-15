// Tormenta: gusts tear slices of the hands toward the camera, the wind takes part of the cloud with it
// and the gap flashes. The GLSL says which slices of space glitch (act), where they are pushed (push)
// and how far apart the cyan and magenta ghosts sit (sep).
// GLSL inputs: p (world position), position (rest position in the hand), dt (distance to the fingertip),
// h (hand), r/r2 (randoms), kind, t, uP (the four values update() returns), uPtr (pointer on the focal
// plane, on, speed).
import { clamp, rnd } from './math.js';

export const STORM_GLSL = `
  float gust = uP.x;
  float tick = floor(t * 16.0), s1 = floor(position.y / 5.0), s2 = floor(position.y / 27.0);
  float h1 = hash(vec2(s1, tick)), h2 = hash(vec2(s2 + h * 9.0, floor(t * 7.0)));
  float thin = step(1.0 - 0.2 * gust, h1), thick = step(1.0 - 0.16 * gust, h2);
  act = max(thin, thick * 0.8);
  act = max(act, uPtr.z * step(0.9 - uPtr.w * 0.7, h1) * exp(-abs(p.y - uPtr.y) / 70.0));
  push = thin * vec3((hash(vec2(s1, tick + 7.0)) - 0.5) * 110.0, 0.0, hash(vec2(s1, tick + 2.0)) * 170.0)
       + thick * vec3((hash(vec2(s2, tick + 1.0)) - 0.5) * 40.0, 0.0, (hash(vec2(s2, floor(t * 7.0) + 4.0)) - 0.3) * 120.0);
  sep = vec3(6.0, 0.0, 62.0);
  // the wind takes part of the cloud with it and brings it back
  float deb = step(r2, 0.13 * gust) * (0.5 + 0.5 * sin(t * (1.0 + r * 2.0) + r * 40.0));
  push += deb * vec3(-1.0, 0.25, 0.9) * (60.0 + 300.0 * r) * gust;
  if (kind > 1.5) show = deb * 0.8;
  gain = 1.0 + uP.y * 0.8 * exp(-dt / 320.0);`;

export const createStormState = () => ({ gust: 0.4, flashAt: 2, flash: -9 });

/**
 * One step of the storm. `st` is the frame: t, still, speed (pointer, 0..1) in; flash, wind, tear out.
 * Returns the four values the shaders read as uP: gust, flash level, 0, 0.
 */
export function updateStorm(st, s) {
  const n = 0.5 + 0.5 * Math.sin(st.t * 1.3) * Math.sin(st.t * 0.47 + 1.3);
  s.gust = st.still ? 0.7 : clamp(0.04 + 0.6 * n * n + st.speed * 0.7, 0, 1.2);
  if (!st.still && st.t > s.flashAt) {
    s.flash = st.t;
    s.flashAt = st.t + 1.4 + rnd() * 3.2;
  }
  const fl = st.still ? 0.25 : Math.exp(-(st.t - s.flash) * 7) * (0.6 + 0.4 * Math.sin(st.t * 90));
  st.flash = Math.max(st.flash, fl * 0.55);
  st.wind = 1 + 5 * s.gust;
  st.tear = s.gust;
  return [s.gust, fl, 0, 0];
}
