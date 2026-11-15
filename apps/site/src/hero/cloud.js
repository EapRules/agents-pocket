// The point cloud: one point per cell of the dot-art grid, on the front shell, the back shell and the interior.
// One record per point: x y z | light, distance to its fingertip, hand, random | normal | kind, edge, level, random.
// kind: 0 front shell (the approved stipple), 1 back shell, 2 interior.
import { WPP } from './config.js';
import { FIELD_META, sample } from './field.js';
import { mix, rnd, setSeed, smooth } from './math.js';

const REC = 14;

/** Where the gap between the hands sits in world units, and each fingertip relative to it. */
export function geoFrame() {
  const tl = FIELD_META.tipL;
  const tr = FIELD_META.tipR;
  const gx = ((tl[0] + tr[0]) / 2) * WPP;
  const gy = ((tl[1] + tr[1]) / 2) * WPP;
  return {
    gx,
    gy,
    splitPx: (tl[0] + tr[0]) / 2,
    tips: [
      { x: tl[0] * WPP - gx, y: gy - tl[1] * WPP },
      { x: tr[0] * WPP - gx, y: gy - tr[1] * WPP },
    ],
  };
}

function unpack(parts) {
  let n = 0;
  for (const p of parts) n += p.length / REC;
  const pos = new Float32Array(n * 3);
  const aA = new Float32Array(n * 4);
  const aN = new Float32Array(n * 3);
  const aB = new Float32Array(n * 4);
  let i = 0;
  for (const p of parts) {
    for (let o = 0; o < p.length; o += REC, i++) {
      pos.set([p[o], p[o + 1], p[o + 2]], i * 3);
      aA.set([p[o + 3], p[o + 4], p[o + 5], p[o + 6]], i * 4);
      aN.set([p[o + 7], p[o + 8], p[o + 9]], i * 3);
      aB.set([p[o + 10], p[o + 11], p[o + 12], p[o + 13]], i * 4);
    }
  }
  return { n, pos, aA, aN, aB };
}

function shuffle(arr) {
  const n = arr.length / REC;
  const t = new Array(REC);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    for (let k = 0; k < REC; k++) {
      t[k] = arr[i * REC + k];
      arr[i * REC + k] = arr[j * REC + k];
      arr[j * REC + k] = t[k];
    }
  }
}

/** Builds clouds from the derived field D and the frame geo. */
export function createCloudBuilder(D, geo) {
  function putPoint(arr, x, y, z, b, kind, n, nzSign, e, level) {
    const h = x > geo.splitPx ? 1 : 0;
    const wx = x * WPP - geo.gx;
    const wy = geo.gy - y * WPP;
    const tip = geo.tips[h];
    arr.push(wx, wy, z, b, Math.hypot(wx - tip.x, wy - tip.y), h, rnd());
    arr.push(sample(n.nx, D, x, y), -sample(n.ny, D, x, y), sample(n.nz, D, x, y) * nzSign);
    arr.push(kind, e, level, rnd());
  }

  // Narrow screens never see the forearms: xLim (world units from the gap) keeps the points where the picture is.
  const reachOf = (x, xLim) => smooth(xLim, xLim - 90, Math.abs(x * WPP - geo.gx));

  return function buildCloud(xLim) {
    setSeed(11);
    // Front shell = the art's own dots (level 1 big, 0 small); back shell and interior sit on the same cells, dimmer.
    const { cw, ch, x0, y0, rows, cols } = FIELD_META;
    const front = [];
    const back = [];
    const inner = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = x0 + (c + 0.5) * cw;
        const y = y0 + (r + 0.5) * ch;
        const i = Math.floor(y) * D.w + Math.floor(x);
        const a = D.alpha[i] * reachOf(x, xLim);
        if (a < 0.04) continue;
        const lum = D.lum[i];
        const sh = D.shade[i];
        const big = lum > 0.7 ? 1 : 0;
        const zf = D.zf[i];
        const zb = D.zb[i];
        const fd = Math.max(0.02, D.fade[i]);
        const ed = Math.exp(-D.dist[i] / 4);
        if (lum > 0.2) {
          const light = (big ? 1 : 0.64) * (0.8 + 0.2 * sh) * a;
          putPoint(front, x, y, zf, light, 0, D.nf, 1, ed * fd, big);
        }
        const backLight = 0.42 * (0.5 + 0.5 * (big ? 1 : 0.6)) * (0.6 + 0.4 * sh) * a;
        putPoint(back, x, y, -zb, backLight, 1, D.nb, -1, ed, zf);
        if (a > 0.2) {
          for (let k = 1; k <= 3; k++) {
            const z = mix(-zb, zf, k / 4);
            putPoint(inner, x, y, z, a * (0.35 + 0.4 * D.lum[i]), 2, D.nf, 1, 0, zf);
          }
        }
      }
    }
    shuffle(front); // any prefix is an even subsample (the ghost passes, the 2D still)
    const c = unpack([front, back, inner]);
    return Object.assign(c, {
      nFront: front.length / REC,
      nBack: back.length / REC,
      nInner: inner.length / REC,
      spacing: cw * WPP,
    });
  };
}
