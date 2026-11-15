// The still: the same volume, staged for a calm frame and drawn once on a 2D canvas.
// It is what the page shows before three.js arrives and all it shows if WebGL is missing or lost for good.
import { CAM_DIST, GAP_OPEN, U0, U1 } from './config.js';
import { clamp, TAU } from './math.js';
import { view } from './state.js';

// Its own staging (left bend, right bend, left z, right z), lens (aperture, largest blur) and fog.
const STAGE = [0.66, -0.85, 20, -20];
const LENS = [22, 13];
const FOG = 0.0015;

/** The forearm bends into depth between U0 and U1 from the fingertip; the hand itself stays flat. */
function bend(u, z, A) {
  if (Math.abs(A) < 0.001 || u <= U0) return [u, z];
  const rho = (U1 - U0) / A;
  const th = A * clamp((u - U0) / (U1 - U0), 0, 1);
  let cx = U0 + rho * Math.sin(th);
  let cz = rho * (1 - Math.cos(th));
  if (u > U1) {
    cx += (u - U1) * Math.cos(A);
    cz += (u - U1) * Math.sin(A);
  }
  return [cx - z * Math.sin(th), cz + z * Math.cos(th)];
}

export function drawStill(canvas, cloud, geo) {
  if (!cloud) return;
  const { W, H, DPR, S, OX, OY } = view;
  const ctx = canvas.getContext('2d', { alpha: false });
  canvas.width = Math.round(W * DPR);
  canvas.height = Math.round(H * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  const n = Math.min(cloud.nFront, 24000);
  const size = cloud.spacing * 0.62 * Math.sqrt(cloud.nFront / n);
  const sharp = Array.from({ length: 8 }, () => []);
  const soft = [];
  for (let i = 0; i < n; i++) {
    const h = cloud.aA[i * 4 + 2];
    const s = h ? 1 : -1;
    const tip = geo.tips[h];
    const bd = bend((cloud.pos[i * 3] - tip.x) * s, cloud.pos[i * 3 + 2], STAGE[h]);
    const x = tip.x + s * (bd[0] + GAP_OPEN);
    const y = cloud.pos[i * 3 + 1];
    const z = bd[1] + STAGE[2 + h];
    const k = CAM_DIST / (CAM_DIST - z);
    const g = clamp(cloud.aA[i * 4] ** 1.35 * 1.45, 0, 1);
    if (g < 0.04) continue;
    const X = OX + x * k * S;
    const Y = OY - y * k * S;
    const base = size * (0.55 + 0.75 * g) * k * S;
    const coc =
      Math.min(LENS[1], LENS[0] * Math.max(0, Math.abs(1 - 1 / k) - 0.06)) * clamp(S, 0.6, 1);
    const fog = Math.exp(-Math.max(0, -z) * FOG);
    if (coc < 0.6) sharp[Math.min(7, (g * fog * 8) | 0)].push(X, Y, base);
    else
      soft.push(X, Y, base / 2 + coc, (41 + 192 * g) * fog * 0.75 * (base / (base + 2 * coc)) ** 2);
  }

  sharp.forEach((arr, bucket) => {
    const v = Math.round(41 + (192 * (bucket + 0.5)) / 8);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.beginPath();
    for (let j = 0; j < arr.length; j += 3) {
      const r = arr[j + 2] * 0.42;
      ctx.moveTo(arr[j] + r, arr[j + 1]);
      ctx.arc(arr[j], arr[j + 1], r, 0, TAU);
    }
    ctx.fill();
  });
  ctx.globalCompositeOperation = 'lighter';
  for (let j = 0; j < soft.length; j += 4) {
    const v = clamp(soft[j + 3] / 255, 0, 1);
    if (v < 0.002) continue;
    ctx.fillStyle = `rgba(233,233,233,${v.toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(soft[j], soft[j + 1], soft[j + 2], 0, TAU);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  const glow = ctx.createRadialGradient(OX, OY, 0, OX, OY, 18);
  glow.addColorStop(0, 'rgba(255,255,255,0.5)');
  glow.addColorStop(0.2, 'rgba(233,233,233,0.08)');
  glow.addColorStop(1, 'rgba(233,233,233,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(OX - 18, OY - 18, 36, 36);
}
