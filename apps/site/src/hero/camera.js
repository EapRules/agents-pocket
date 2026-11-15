// Camera with inertia: two springs (yaw, pitch) chasing the pointer or an idle orbit, a shake that follows
// the gusts, and a dolly driven by the scroll that takes the camera through the gap between the fingers.
import { CAM_DIST, STORM } from './config.js';
import { smooth } from './math.js';
import { ptr, view } from './state.js';

export function createCameraRig(T) {
  const camera = new T.PerspectiveCamera(40, 1, 4, 7000);
  const spring = { yaw: STORM.stillYaw, pitch: 0, vy: 0, vp: 0 };
  const dir = new T.Vector3();
  const tmp = new T.Vector3();
  const { yaw: yawRange, pitch: pitchRange, idle } = STORM.cam;

  function target({ t, dt, still, ptrOn, p }) {
    const { W, H } = view;
    let ty;
    let tp;
    if (still) {
      ty = STORM.stillYaw;
      tp = 0.03;
    } else if (ptr.touch && ptrOn) {
      ty = ptr.dragYaw * yawRange;
      tp = ptr.dragPitch * pitchRange;
    } else if (ptrOn) {
      ty = (ptr.x / W - 0.5) * 2 * yawRange;
      tp = (ptr.y / H - 0.5) * -2 * pitchRange;
    } else {
      ty = (Math.sin(t * 0.23) + 0.35 * Math.sin(t * 0.61 + 1)) * idle;
      tp = Math.sin(t * 0.17 + 0.6) * idle * 0.28;
      ptr.dragYaw *= Math.exp(-dt);
      ptr.dragPitch *= Math.exp(-dt);
    }
    const settle = 1 - smooth(0.1, 0.6, p);
    return [ty * settle, tp * settle];
  }

  return {
    camera,
    /** Moves the camera for this frame; returns its distance to the gap (the focus distance). */
    update(frame) {
      const { dt, still, p, gapY, gust, t } = frame;
      const { W, H, S, OX } = view;
      const [ty, tp] = target(frame);
      if (still) {
        spring.yaw = ty;
        spring.pitch = tp;
        spring.vy = 0;
        spring.vp = 0;
      } else {
        spring.vy += (15 * (ty - spring.yaw) - 6.4 * spring.vy) * dt;
        spring.yaw += spring.vy * dt;
        spring.vp += (15 * (tp - spring.pitch) - 6.4 * spring.vp) * dt;
        spring.pitch += spring.vp * dt;
      }
      const e = smooth(0, 1, p);
      const dist = CAM_DIST * (1 - e) ** 1.6 - 240 * e * e;

      let yaw = spring.yaw;
      let pitch = spring.pitch;
      let roll = 0;
      if (STORM.cam.shake && !still) {
        const a = 0.006 * (0.3 + gust);
        yaw += Math.sin(t * 31) * a * 0.6 + Math.sin(t * 17.3) * a;
        pitch += Math.sin(t * 23.7) * a * 0.7;
        roll = Math.sin(t * 13.1) * a * 0.8;
      }
      dir.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
      camera.position.copy(dir).multiplyScalar(1000);
      camera.lookAt(0, 0, 0);
      camera.rotateZ(roll);
      camera.position.copy(dir).multiplyScalar(dist);
      camera.fov = (2 * Math.atan(H / (2 * S * CAM_DIST)) * 180) / Math.PI;
      camera.aspect = W / H;
      camera.setViewOffset(W, H, W / 2 - OX, H / 2 - gapY, W, H);
      camera.updateMatrixWorld();
      return dist;
    },
    /** Where the pointer lands on the focal plane (z = 0), written into `out`. */
    pointerOnPlane(out) {
      tmp
        .set((ptr.x / view.W) * 2 - 1, 1 - (ptr.y / view.H) * 2, 0.5)
        .unproject(camera)
        .sub(camera.position);
      if (Math.abs(tmp.z) > 1e-4) {
        const q = -camera.position.z / tmp.z;
        out.x = camera.position.x + tmp.x * q;
        out.y = camera.position.y + tmp.y * q;
      }
    },
  };
}
