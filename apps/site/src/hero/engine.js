// The three.js engine: the hands' points (base pass plus a cyan and a magenta ghost pass), the dust,
// the light in the gap, the camera rig and the post chain. Everything here is Tormenta; the scene is
// one point cloud staged by uniforms and torn by the storm shader.
import { createCameraRig } from './camera.js';
import { CAM_DIST, PHONE_PULL, STORM } from './config.js';
import { clamp, mix, rnd, setSeed, smooth } from './math.js';
import { createPost } from './post.js';
import {
  DUST_VERTEX,
  GLOW_FRAGMENT,
  GLOW_VERTEX,
  POINT_FRAGMENT,
  POINT_VERTEX,
} from './shaders-points.js';
import { ptr, reduce, tap, view } from './state.js';
import { createStormState, updateStorm } from './storm.js';

export function createEngine(T, canvas, geo) {
  const attrs = {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    powerPreference: 'high-performance',
  };
  const gl = canvas.getContext('webgl2', attrs);
  if (!gl) return null;
  const renderer = new T.WebGLRenderer({ canvas, context: gl, ...attrs });
  renderer.autoClear = false;
  renderer.sortObjects = false;
  renderer.setClearColor(0x000000, 1);
  const scene = new T.Scene();
  const rig = createCameraRig(T);
  const post = createPost(T, renderer);

  const v4 = (a = 0, b = 0, c = 0, d = 0) => ({ value: new T.Vector4(a, b, c, d) });
  const [bendL, bendR, zL, zR] = STORM.stage;
  const U = {
    uTime: { value: 0 },
    uStill: { value: 0 },
    uFade: { value: 1 },
    uSize: { value: 1 },
    uFlash: { value: 0 },
    uStage: v4(bendL, bendR, zL, zR),
    uTips: v4(geo.tips[0].x, geo.tips[0].y, geo.tips[1].x, geo.tips[1].y),
    uMotion: v4(),
    uPtr: v4(),
    uP: v4(),
    uLens: v4(CAM_DIST, 0, 0, 1),
    uFog: v4(STORM.fog, 2, 18, 120),
    uView: { value: new T.Vector3(1, 1, 1.3) },
    uRip: {
      value: [new T.Vector4(0, 0, -9, 0), new T.Vector4(0, 0, -9, 0), new T.Vector4(0, 0, -9, 0)],
    },
    uDust: v4(STORM.dust),
    uDrift: { value: new T.Vector3() },
  };
  const blend = {
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: T.CustomBlending,
    blendEquation: T.AddEquation,
    blendSrc: T.OneFactor,
    blendDst: T.OneFactor,
    blendSrcAlpha: T.OneFactor,
    blendDstAlpha: T.OneFactor,
  };

  // Dust and the light in the gap outlive a cloud rebuild.
  const dustGeo = new T.BufferGeometry();
  let dustN = 0;
  function setDust(n) {
    setSeed(5);
    dustN = n;
    const pos = new Float32Array(n * 3);
    const a = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      pos.set([(rnd() - 0.5) * 3200, (rnd() - 0.5) * 1500, (rnd() - 0.5) * 2700], i * 3);
      a.set([1.3 + rnd() * rnd() * 3.4, 0.2 + rnd() * 0.5, rnd(), rnd()], i * 4);
    }
    dustGeo.setAttribute('position', new T.BufferAttribute(pos, 3));
    dustGeo.setAttribute('aA', new T.BufferAttribute(a, 4));
  }
  const glowU = { uG: v4(0, 0, 1, 0) };
  const glow = new T.Mesh(
    new T.PlaneGeometry(720, 720),
    new T.ShaderMaterial({
      uniforms: glowU,
      vertexShader: GLOW_VERTEX,
      fragmentShader: GLOW_FRAGMENT,
      ...blend,
    }),
  );
  glow.frustumCulled = false;
  scene.add(glow);
  const dustMat = new T.ShaderMaterial({
    uniforms: U,
    vertexShader: DUST_VERTEX,
    fragmentShader: POINT_FRAGMENT,
    ...blend,
  });
  const dust = new T.Points(dustGeo, dustMat);
  dust.frustumCulled = false;
  scene.add(dust);

  // The hands: one geometry, drawn three times (base, cyan ghost, magenta ghost) through groups.
  let cloud = null;
  let points = null;
  let pointGeo = null;
  let mats = [];
  function disposePoints() {
    if (points) scene.remove(points);
    points = null;
    pointGeo?.dispose();
    pointGeo = null;
    for (const m of mats) m.dispose();
    mats = [];
  }
  function buildPoints() {
    disposePoints();
    const nBase = cloud.nFront + cloud.nBack + cloud.nInner;
    const nGhost = Math.round(cloud.nFront * view.tier.ghost);
    pointGeo = new T.BufferGeometry();
    pointGeo.setAttribute('position', new T.BufferAttribute(cloud.pos, 3));
    pointGeo.setAttribute('aA', new T.BufferAttribute(cloud.aA, 4));
    pointGeo.setAttribute('aN', new T.BufferAttribute(cloud.aN, 3));
    pointGeo.setAttribute('aB', new T.BufferAttribute(cloud.aB, 4));
    pointGeo.addGroup(0, nBase, 0);
    pointGeo.addGroup(0, nGhost, 1);
    pointGeo.addGroup(0, nGhost, 2);
    mats = [0, 1, -1].map(
      (ghost) =>
        new T.ShaderMaterial({
          uniforms: { ...U, uGhost: { value: ghost } },
          vertexShader: POINT_VERTEX,
          fragmentShader: POINT_FRAGMENT,
          ...blend,
        }),
    );
    points = new T.Points(pointGeo, mats);
    points.frustumCulled = false;
    scene.add(points);
  }

  function resize() {
    const { W, H, DPR } = view;
    renderer.setPixelRatio(DPR);
    renderer.setSize(W, H, false);
    post.resize(Math.round(W * DPR), Math.round(H * DPR));
  }

  // Per-engine animation state.
  const storm = createStormState();
  const ptrW = { x: 0, y: 0 };
  const drift = new T.Vector3();
  const tmp = new T.Vector3();
  let light = 0;
  let reach = 0;
  let lastT = 0;
  let ripI = 0;
  let ripSeen = tap.at;

  function render(t) {
    const { W, H, DPR, S, OX, OY, heroH, travel, copyBottom, tier } = view;
    const still = reduce.matches;
    const dt = clamp(t - (lastT || t), 0.001, 0.05);
    lastT = t;
    // No travel under reduced motion: the still just fades.
    const p = still ? 0 : clamp(scrollY / travel, 0, 1);
    const fade = 1 - smooth(still ? 0.25 : 0.75, still ? 0.75 : 1, scrollY / heroH);
    const ptrOn = ptr.active && t - ptr.last < 3;

    // Pointer: light near the gap, and speed for the glitch.
    ptr.speed *= Math.exp(-dt * 3);
    const gapY = mix(OY, H * 0.5, smooth(0, 0.6, p));
    let near = 0;
    if (ptr.active && t - ptr.last < 6) {
      const R = 60 + W * 0.08;
      const d = Math.hypot(ptr.x - OX, ptr.y - gapY);
      near = Math.exp(-(d * d) / (2 * R * R));
    }
    light += (near - light) * (still ? 1 : 1 - Math.exp(-dt * 4));
    reach += ((still ? 0 : near) - reach) * (1 - Math.exp(-dt * 2.2));

    const st = {
      t: still ? STORM.still : t,
      still,
      speed: Math.min(1, ptr.speed / 1800),
      flash: 0,
      wind: 1,
      tear: 0,
    };
    const u = updateStorm(st, storm);
    U.uP.value.set(u[0], u[1], u[2], u[3]);

    // Camera, and the pointer on the focal plane.
    const dist = rig.update({ t, dt, still, ptrOn, p, gapY, gust: u[0] });
    glow.quaternion.copy(rig.camera.quaternion);
    rig.pointerOnPlane(ptrW);

    // Uniforms.
    const part = 36 * smooth(0.1, 0.7, p); // the hands part as the camera goes in
    U.uTime.value = st.t;
    U.uStill.value = still ? 1 : 0;
    U.uFade.value = fade;
    U.uFlash.value = st.flash;
    U.uSize.value = cloud.spacing;
    if (tap.at !== ripSeen) {
      ripSeen = tap.at;
      if (!still) {
        ripI = (ripI + 1) % 3;
        U.uRip.value[ripI].set(ptrW.x, ptrW.y, st.t, 0);
      }
    }
    U.uMotion.value.set(part - (W < 600 ? PHONE_PULL : 0), reach * 12, light, 0);
    U.uPtr.value.set(ptrW.x, ptrW.y, ptrOn && !still ? 1 : 0, Math.min(1, ptr.speed / 1800));
    const px = DPR * clamp(S, 0.6, 1.1);
    const [aperture, maxBlur] = STORM.lens;
    U.uLens.value.set(
      Math.max(70, dist),
      aperture * px,
      maxBlur * px * tier.maxBlur,
      S * CAM_DIST * DPR,
    );
    U.uView.value.set(W * DPR, H * DPR, 1.3);
    if (!still) drift.add(tmp.set(-9, 4, 6).multiplyScalar(dt * st.wind * 14));
    U.uDrift.value.copy(drift);
    glowU.uG.value.set(light, 0, fade, still ? 0.5 : 0.5 + 0.5 * Math.sin(t * 2.1));

    // Draw: scene, then bloom and the composite.
    renderer.setRenderTarget(post.scene);
    renderer.clear();
    if (fade > 0.001) renderer.render(scene, rig.camera);
    post.run({
      w: Math.round(W * DPR),
      h: Math.round(H * DPR),
      bloom2: tier.bloom2,
      bloom: STORM.bloom,
      tear: still ? 0 : st.tear,
      tick: Math.floor(t * 15),
      copyY: 1 - (copyBottom - scrollY) / H,
    });
    return { lightDelta: Math.abs(light - near) };
  }

  return {
    render,
    resize,
    /** A new cloud (a new tier): rebuilds the points and the dust that fits the tier. */
    setCloud(next) {
      cloud = next;
      if (dustN !== view.tier.dust) setDust(view.tier.dust);
      buildPoints();
    },
    /** After a restored WebGL context: new GPU objects from the same cloud. */
    rebuild: buildPoints,
    dispose() {
      disposePoints();
      dustGeo.dispose();
      dustMat.dispose();
      glow.geometry.dispose();
      glow.material.dispose();
      post.dispose();
      renderer.dispose();
    },
  };
}
