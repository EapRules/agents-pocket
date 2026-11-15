// Shaders of the post chain: a bright-pass downsample, a separable blur and the final composite.
import { GLSL_COMMON } from './shaders-points.js';

export const POST_VERTEX = `varying vec2 vUv; void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

export const DOWN_FRAGMENT = `
varying vec2 vUv; uniform sampler2D tMap; uniform vec4 uD; // texel x, texel y, threshold, gain
void main() {
  vec3 c = texture2D(tMap, vUv + uD.xy * vec2(-1.0, -1.0)).rgb + texture2D(tMap, vUv + uD.xy * vec2(1.0, -1.0)).rgb
         + texture2D(tMap, vUv + uD.xy * vec2(-1.0, 1.0)).rgb + texture2D(tMap, vUv + uD.xy * vec2(1.0, 1.0)).rgb;
  gl_FragColor = vec4(min(max(c * 0.25 - uD.z, 0.0) * uD.w, vec3(4.0)), 1.0);
}`;

export const BLUR_FRAGMENT = `
varying vec2 vUv; uniform sampler2D tMap; uniform vec2 uDir;
void main() {
  vec3 c = texture2D(tMap, vUv).rgb * 0.227027;
  c += (texture2D(tMap, vUv + uDir * 1.384615).rgb + texture2D(tMap, vUv - uDir * 1.384615).rgb) * 0.316216;
  c += (texture2D(tMap, vUv + uDir * 3.230769).rgb + texture2D(tMap, vUv - uDir * 3.230769).rgb) * 0.070270;
  gl_FragColor = vec4(c, 1.0);
}`;

export const FINAL_FRAGMENT = `
varying vec2 vUv; uniform sampler2D tMap, tBloom, tBloom2; uniform vec4 uPost; uniform vec2 uCopy; // bloom, tear, tick, fade | bottom of the hero text (uv), dim
${GLSL_COMMON}
void main() {
  vec2 uv = vUv;
  if (uPost.y > 0.0) { // storm: a few screen bands tear sideways on top of the slices that tear in space
    float band = floor(uv.y * 54.0), hs = hash(vec2(band, uPost.z));
    uv.x += step(1.0 - 0.12 * uPost.y, hs) * (hash(vec2(band, uPost.z + 3.0)) - 0.5) * 0.035 * uPost.y;
  }
  vec3 c = texture2D(tMap, uv).rgb + (texture2D(tBloom, uv).rgb + texture2D(tBloom2, uv).rgb) * uPost.x;
  // shoulder: below 0.8 nothing changes (the grey stipple is untouched); piled-up light bends instead of clipping, and keeps its hue
  float l = max(c.r, max(c.g, c.b));
  if (l > 0.8) { c *= (0.8 + 0.2 * (1.0 - exp(-(l - 0.8) / 0.45))) / l; c = mix(c, vec3(1.0), 0.55 * smoothstep(1.6, 5.0, l)); }
  // whatever ends up behind the hero text is held back, so the text always reads
  c *= mix(1.0, uCopy.y, smoothstep(uCopy.x - 0.035, uCopy.x + 0.06, vUv.y));
  c += (hash(gl_FragCoord.xy + uPost.z) - 0.5) / 200.0;
  gl_FragColor = vec4(c * uPost.w, 1.0);
}`;
