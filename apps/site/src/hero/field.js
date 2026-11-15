// The field: the hands as a picture (silhouette, painted light, fade) turned into a volume.
// The picture only knows the silhouette and the light; the volume comes from the largest circle that fits
// inside the silhouette at every pixel (a forearm becomes a tube, a finger a thin one).
import { WPP } from './config.js';
import { mix, smooth } from './math.js';

export const FIELD_URL = new URL('./field.png', import.meta.url).href;
// Printed by scripts/hero-field.py: the art grid (cols, rows, cell and origin in field pixels) and the fingertips.
export const FIELD_META = {
  w: 840,
  h: 200,
  adamMaxX: 348.3,
  tipL: [348.3, 115.88],
  tipR: [444.90000000000003, 96.08],
  cols: 177,
  rows: 24,
  cw: 4.2,
  ch: 7.92,
  x0: 48.0,
  y0: 5.0,
};

/** Decodes field.png: R = painted light, G = silhouette (soft edge), B = fade toward the arm ends. */
export function loadField(url = FIELD_URL) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const x = c.getContext('2d', { willReadFrequently: true });
      x.drawImage(img, 0, 0);
      const px = x.getImageData(0, 0, img.width, img.height).data;
      const N = img.width * img.height;
      const lum = new Float32Array(N);
      const alpha = new Float32Array(N);
      const fade = new Float32Array(N);
      const solid = new Uint8Array(N);
      for (let i = 0; i < N; i++) {
        const sil = px[i * 4 + 1] / 255;
        fade[i] = px[i * 4 + 2] / 255;
        alpha[i] = sil * fade[i];
        lum[i] = sil > 0 ? px[i * 4] / 255 : 0;
        solid[i] = sil > 0.5 ? 1 : 0;
      }
      resolve({ w: img.width, h: img.height, lum, alpha, fade, solid });
    };
    img.onerror = reject;
    img.src = url;
  });
}

function boxBlur(V, w, h, r) {
  const t = new Float32Array(V.length);
  const o = new Float32Array(V.length);
  for (let y = 0; y < h; y++) {
    let a = 0;
    let c = 0;
    const b = y * w;
    for (let x = -r; x < w; x++) {
      if (x + r < w) {
        a += V[b + x + r];
        c++;
      }
      if (x - r - 1 >= 0) {
        a -= V[b + x - r - 1];
        c--;
      }
      if (x >= 0) t[b + x] = a / c;
    }
  }
  for (let x = 0; x < w; x++) {
    let a = 0;
    let c = 0;
    for (let y = -r; y < h; y++) {
      if (y + r < h) {
        a += t[(y + r) * w + x];
        c++;
      }
      if (y - r - 1 >= 0) {
        a -= t[(y - r - 1) * w + x];
        c--;
      }
      if (y >= 0) o[y * w + x] = a / c;
    }
  }
  return o;
}

function heightNormals(Z, w, h) {
  const N = w * h;
  const nx = new Float32Array(N);
  const ny = new Float32Array(N);
  const nz = new Float32Array(N);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const zx = ((x + 1 < w ? Z[i + 1] : Z[i]) - (x > 0 ? Z[i - 1] : Z[i])) / (2 * WPP);
      const zy = ((y + 1 < h ? Z[i + w] : Z[i]) - (y > 0 ? Z[i - w] : Z[i])) / (2 * WPP);
      const l = Math.hypot(zx, zy, 1);
      nx[i] = -zx / l;
      ny[i] = -zy / l;
      nz[i] = 1 / l; // field space: y grows downwards
    }
  }
  return { nx, ny, nz };
}

/** Chamfer distance (3-4) to the silhouette edge, in field pixels. */
function edgeDistance({ w, h, solid }) {
  const N = w * h;
  const d = new Float32Array(N);
  for (let i = 0; i < N; i++) d[i] = solid[i] ? 1e6 : 0;
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : d[y * w + x]);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (solid[i]) {
        d[i] = Math.min(
          d[i],
          at(x - 1, y) + 3,
          at(x, y - 1) + 3,
          at(x - 1, y - 1) + 4,
          at(x + 1, y - 1) + 4,
        );
      }
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      if (solid[i]) {
        d[i] = Math.min(
          d[i],
          at(x + 1, y) + 3,
          at(x, y + 1) + 3,
          at(x + 1, y + 1) + 4,
          at(x - 1, y + 1) + 4,
        );
      }
    }
  }
  for (let i = 0; i < N; i++) d[i] /= 3;
  return d;
}

/** The largest circle inside the silhouette at every pixel: each ridge pixel of the distance map paints its own. */
function inscribedRadius(dp, w, h) {
  const R = Float32Array.from(dp);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const v = dp[i];
      if (v < 1.2) continue;
      const gx = (dp[i + 1] - dp[i - 1]) / 2;
      const gy = (dp[i + w] - dp[i - w]) / 2;
      if (gx * gx + gy * gy > 0.5) continue;
      if (v > 8 && (x | y) & 1) continue;
      const r = Math.ceil(v);
      const y0 = Math.max(0, y - r);
      const y1 = Math.min(h - 1, y + r);
      for (let yy = y0; yy <= y1; yy++) {
        const dy = yy - y;
        const span = Math.sqrt(Math.max(0, v * v - dy * dy)) | 0;
        const x0 = Math.max(0, x - span);
        const x1 = Math.min(w - 1, x + span);
        for (let j = yy * w + x0, e = yy * w + x1; j <= e; j++) if (R[j] < v) R[j] = v;
      }
    }
  }
  return boxBlur(R, w, h, 2);
}

/** Turns the decoded picture into everything the cloud reads: shading, both shells and their normals. */
export function deriveField(f) {
  const { w, h, lum, alpha, fade, solid } = f;
  const N = w * h;
  const dp = edgeDistance(f);
  const dist = Float32Array.from(dp, (v) => v * WPP);

  // An earlier relief, kept only because the approved shading (the finger definition) was computed from it.
  let z3 = new Float32Array(N);
  for (let i = 0; i < N; i++) z3[i] = solid[i] ? 6.5 * Math.sqrt(dist[i]) + 16 * lum[i] : 0;
  z3 = boxBlur(boxBlur(z3, w, h, 1), w, h, 1);
  const n3 = heightNormals(z3, w, h);
  const L = [-0.45, -0.6, 0.66];
  const shade = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const lam = Math.max(0, n3.nx[i] * L[0] + n3.ny[i] * L[1] + n3.nz[i] * L[2]);
    shade[i] = Math.min(1, lum[i] * (0.55 + 0.6 * lam) + 0.45 * Math.exp(-dist[i] / 2.6));
  }

  // Front and back shells: a circular section, a little flatter than it is tall, plus the painted relief in front.
  const R = inscribedRadius(dp, w, h);
  let zf = new Float32Array(N);
  let zb = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    if (!solid[i]) continue;
    const Rw = Math.max(R[i], dp[i]) * WPP;
    const dw = Math.max(0, dist[i] - 1);
    const prof = Math.sqrt(Math.max(0, dw * (2 * Rw - dw))) * 0.82 * (1 + 9 / (Rw + 9));
    zf[i] = prof + 13 * lum[i] * smooth(0, 5, dw);
    zb[i] = prof * 0.78;
  }
  zf = boxBlur(zf, w, h, 1);
  zb = boxBlur(zb, w, h, 1);
  const nf = heightNormals(zf, w, h);
  const nb = heightNormals(zb, w, h);

  // Vertical extent of the whole picture, for the layout.
  let y0 = h;
  let y1 = 0;
  for (let i = 0; i < N; i++) {
    if (alpha[i] > 0.1) {
      const y = (i / w) | 0;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return { w, h, lum, alpha, fade, dist, shade, zf, zb, nf, nb, y0, y1 };
}

/** Bilinear sample of a field-sized map at fractional pixel coordinates. */
export function sample(M, D, x, y) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const g = (xx, yy) => (xx < 0 || yy < 0 || xx >= D.w || yy >= D.h ? 0 : M[yy * D.w + xx]);
  const top = mix(g(x0, y0), g(x0 + 1, y0), x - x0);
  const bottom = mix(g(x0, y0 + 1), g(x0 + 1, y0 + 1), x - x0);
  return mix(top, bottom, y - y0);
}
