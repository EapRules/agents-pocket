// Shaders of the scene proper: the hands' points (with the storm spliced in), the dust and the light in the gap.
import { GAP_OPEN, RIP_SPEED, U0, U1 } from './config.js';
import { STORM_GLSL } from './storm.js';

export const GLSL_COMMON = `
const vec3 CY = vec3(0.302, 0.890, 0.878); const vec3 MG = vec3(0.878, 0.290, 0.886);
const vec3 WH = vec3(0.914);
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float gauss(float x) { return exp(-x * x); }
// Lens: circle of confusion in device pixels for a view depth, and the resulting sprite.
uniform vec4 uLens;   // focus distance, aperture, largest blur radius, focal length (all in device px but the first)
uniform vec4 uFog;    // density, energy exponent, near fade start, near fade end
uniform vec3 uView;   // device px width, height, smallest point
float lens(float zv, float basePx, float spread, out float blur, out float energy) {
  float coc = min(uLens.z, uLens.y * max(0.0, abs(1.0 - uLens.x / zv) - 0.06)); // a slab around the focus stays sharp
  float size = basePx + 2.0 * coc;
  blur = clamp(2.0 * coc / size, 0.0, 1.0);
  // spread 2 keeps the light of a surface when it goes out of focus; less than 2 keeps single motes visible
  energy = pow(basePx / size, spread) * exp(-max(0.0, zv - uLens.x) * uFog.x) * smoothstep(uFog.z, uFog.w, zv);
  return size;
}`;

export const POINT_VERTEX = `
attribute vec4 aA; attribute vec3 aN; attribute vec4 aB;
uniform float uTime, uStill, uFade, uGhost, uSize, uFlash;
uniform vec4 uStage, uTips, uMotion, uPtr, uP;
uniform vec4 uRip[3];
varying vec3 vCol; varying float vA; varying float vBlur;
${GLSL_COMMON}
vec3 bend(float u, float z, float A) {
  if (abs(A) < 0.001 || u <= ${U0}.0) return vec3(u, z, 0.0);
  float rho = ${U1 - U0}.0 / A, th = A * clamp((u - ${U0}.0) / ${U1 - U0}.0, 0.0, 1.0);
  vec2 c = vec2(${U0}.0 + rho * sin(th), rho * (1.0 - cos(th)));
  if (u > ${U1}.0) c += (u - ${U1}.0) * vec2(cos(A), sin(A));
  return vec3(c.x - z * sin(th), c.y + z * cos(th), th);
}
void main() {
  float t = uTime;
  float b = aA.x, dt = aA.y, h = aA.z, r = aA.w, kind = aB.x, e = aB.y, level = aB.z, r2 = aB.w;
  float s = h > 0.5 ? 1.0 : -1.0;
  vec2 tip = h > 0.5 ? uTips.zw : uTips.xy;
  vec3 q = position - vec3(tip, 0.0);
  if (uStill < 0.5) {
    float a = t * 0.8 + position.x * 0.0065 + r * 0.6, amp = h < 0.5 ? 1.0 : 0.45;
    q.y += (sin(a) * 1.1 + sin(t * 0.45) * 1.5) * amp; q.z += cos(a) * 2.0 * amp;
  }
  vec3 bd = bend(q.x * s, q.z, h > 0.5 ? uStage.y : uStage.x);
  float cs = cos(bd.z), sn = sin(bd.z), nu = aN.x * s;
  vec3 n = vec3((nu * cs - aN.z * sn) * s, aN.y, nu * sn + aN.z * cs);
  vec3 p = vec3(tip.x + bd.x * s, tip.y + q.y, bd.y + (h > 0.5 ? uStage.w : uStage.z));
  p.x += s * (${GAP_OPEN}.0 + uMotion.x - uMotion.y * exp(-dt / 300.0));

  float act = 0.0; vec3 push = vec3(0.0); vec3 sep = vec3(0.0, 0.0, 40.0);
  float show = kind > 1.5 && kind < 2.5 ? 0.0 : 1.0; float gain = 1.0; float sizeK = 1.0;
  ${STORM_GLSL}
  act = clamp(act, 0.0, 1.0);
  if (show < 0.02 || (uGhost != 0.0 && act < 0.02)) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 1.0; vA = 0.0; vBlur = 0.0; vCol = vec3(0.0); return; }
  p += push + uGhost * sep * act;
  // Tap ripples on the dot grid: swell and brighten at the wavefront (cyan leading edge, magenta trailing), lift toward the camera.
  float rip = 0.0, ripC = 0.0, ripM = 0.0;
  for (int i = 0; i < 3; i++) {
    float age = uTime - uRip[i].z;
    if (age > 0.0 && age < 2.5) {
      float x = age * ${RIP_SPEED}.0 - length(p.xy - uRip[i].xy), env = 1.0 - smoothstep(1.5, 2.4, age);
      rip = max(rip, (x > 0.0 ? exp(-x / 75.0) : exp(x / 12.0)) * env);
      ripC = max(ripC, exp(-pow((x + 4.0) / 15.0, 2.0)) * env);
      ripM = max(ripM, exp(-pow((x - 52.0) / 26.0, 2.0)) * env);
    }
  }
  p.z += 30.0 * rip; sizeK *= 1.0 + 0.8 * rip;

  vec4 mv = viewMatrix * vec4(p, 1.0);
  float zv = max(1.0, -mv.z);
  gl_Position = projectionMatrix * mv;

  // Light: the painting's own light, plus the gap (pointer close, and the flash).
  float g = kind < 0.5 ? clamp(pow(b, 1.35) * 1.45, 0.0, 1.0) : b;
  vec3 Lg = -p; float dg = max(1.0, length(Lg));
  float lit = (uMotion.z * 0.55 * exp(-dg / 90.0) + uFlash * 1.5 * exp(-dg / (90.0 + 420.0 * uFlash))) * (0.3 + 0.7 * max(0.0, dot(n, Lg / dg)));
  g = min(1.0, g * gain + lit + 0.5 * rip);
  // A solid, not a relief: what faces away from the camera is hidden.
  float facing = dot(n, normalize(cameraPosition - p));
  float vis = kind < 0.5 ? smoothstep(-0.42, -0.1, facing) : kind < 1.5 ? smoothstep(-0.1, 0.22, facing) : 1.0;

  vec3 col = mix(vec3(0.16), WH, g);
  col = mix(col, MG, ripM * 0.6); col = mix(col, CY, ripC * 0.9);
  float a = uFade * smoothstep(0.0, 0.07, g) * vis * show;
  if (uGhost != 0.0) { col = (uGhost > 0.0 ? CY : MG) * (0.13 + 0.76 * g); a *= act; }
  else a *= 1.0 - 0.85 * act;

  // dot art: front dots are big (level 1) or small (0) as in the art; back shell and interior are smaller
  float dotK = kind < 0.5 ? (level > 0.5 ? 0.85 : 0.5) : kind < 1.5 ? 0.5 : 0.4;
  float basePx = max(uView.z, uSize * dotK * sizeK * uLens.w / zv);
  float blur, energy;
  gl_PointSize = lens(zv, basePx, mix(uFog.y, 1.4, act), blur, energy);
  vec2 ndc = abs(gl_Position.xy / gl_Position.w);
  a *= energy * (1.0 - blur * smoothstep(0.9, 1.0, max(ndc.x, ndc.y)));
  vCol = col; vA = a; vBlur = blur;
}`;

export const POINT_FRAGMENT = `
varying vec3 vCol; varying float vA; varying float vBlur;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float sharp = 1.0 - smoothstep(0.5, 1.0, d);
  float bokeh = (1.0 - smoothstep(0.84, 1.0, d)) * (0.72 + 0.34 * smoothstep(0.5, 0.86, d));
  float a = mix(sharp, bokeh, vBlur) * vA;
  if (a < 0.003) discard;
  gl_FragColor = vec4(vCol * a, 0.0);
}`;

export const DUST_VERTEX = `
attribute vec4 aA;
uniform float uTime, uFade, uFlash, uStill;
uniform vec4 uDust, uRip[3]; uniform vec3 uDrift;
varying vec3 vCol; varying float vA; varying float vBlur;
${GLSL_COMMON}
void main() {
  float t = uTime;
  vec3 box = vec3(3200.0, 1500.0, 2700.0);
  vec3 p = position + uDrift * (0.5 + aA.z);
  p += vec3(cos(t * 0.17 + aA.z * 40.0), sin(t * 0.2 + aA.w * 40.0), sin(t * 0.13 + aA.w * 17.0)) * 16.0 * (1.0 - uStill);
  p = mod(p + box * 0.5, box) - box * 0.5 + vec3(0.0, 0.0, -260.0);
  float g = aA.y + uFlash * 0.5 * exp(-length(p) / 320.0);
  for (int i = 0; i < 3; i++) { float age = uTime - uRip[i].z; if (age > 0.0 && age < 2.5) g += 0.35 * gauss((length(p - vec3(uRip[i].xy, 0.0)) - age * ${RIP_SPEED}.0) / 90.0) * (1.0 - smoothstep(1.5, 2.4, age)); }
  vec4 mv = viewMatrix * vec4(p, 1.0);
  float zv = max(1.0, -mv.z);
  gl_Position = projectionMatrix * mv;
  float basePx = max(uView.z * 0.8, aA.x * uLens.w / zv);
  float blur, energy;
  gl_PointSize = lens(zv, basePx, 1.65, blur, energy);
  vec2 ndc = abs(gl_Position.xy / gl_Position.w);
  vCol = vec3(min(1.0, g)); vBlur = blur;
  vA = uFade * uDust.x * energy * (1.0 - blur * smoothstep(0.88, 1.0, max(ndc.x, ndc.y)));
}`;

export const GLOW_VERTEX = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

export const GLOW_FRAGMENT = `
varying vec2 vUv; uniform vec4 uG; // light, 0, fade, pulse
void main() {
  float r = length(vUv - 0.5) * 2.0 * 360.0;
  float c = (0.05 + 0.04 * uG.w + 0.3 * uG.x) * exp(-pow(r / (16.0 + 44.0 * uG.x), 2.0));
  c += (0.45 + 0.25 * uG.w + 0.4 * uG.x) * exp(-pow(r / (2.6 + 3.0 * uG.x), 2.0));
  gl_FragColor = vec4(vec3(c) * uG.z * (1.0 - smoothstep(0.8, 1.0, length(vUv - 0.5) * 2.0)), 0.0);
}`;
