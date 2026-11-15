// Small numeric helpers and the scene's seeded random numbers (the same dots on every load).
export const TAU = Math.PI * 2;

let seed = 11;
export const setSeed = (value) => {
  seed = value;
};
export const rnd = () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const mix = (a, b, k) => a + (b - a) * k;
export const smooth = (a, b, v) => {
  const x = clamp((v - a) / (b - a), 0, 1);
  return x * x * (3 - 2 * x);
};
