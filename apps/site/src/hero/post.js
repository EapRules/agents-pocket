// Post chain: the scene renders into a float target, two small bloom levels are blurred from it,
// and a final pass composites everything onto the screen (tear bands, tone shoulder, text dimming, grain).
import { BLUR_FRAGMENT, DOWN_FRAGMENT, FINAL_FRAGMENT, POST_VERTEX } from './shaders-post.js';

export function createPost(T, renderer) {
  const v4 = (a = 0, b = 0, c = 0, d = 0) => ({ value: new T.Vector4(a, b, c, d) });
  const opt = {
    depthBuffer: false,
    stencilBuffer: false,
    minFilter: T.LinearFilter,
    magFilter: T.LinearFilter,
    format: T.RGBAFormat,
    type: T.UnsignedByteType,
  };
  const hdr =
    renderer.extensions.has('EXT_color_buffer_float') ||
    renderer.extensions.has('EXT_color_buffer_half_float');
  const target = (o) => new T.WebGLRenderTarget(4, 4, o);
  const rt = {
    scene: target({ ...opt, type: hdr ? T.HalfFloatType : T.UnsignedByteType }),
    q1: target(opt),
    q2: target(opt),
    e1: target(opt),
    e2: target(opt),
  };

  const tri = new T.BufferGeometry();
  tri.setAttribute('position', new T.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  const postScene = new T.Scene();
  const postCam = new T.Camera();
  const mat = (fragmentShader, uniforms) =>
    new T.ShaderMaterial({
      uniforms,
      vertexShader: POST_VERTEX,
      fragmentShader,
      depthTest: false,
      depthWrite: false,
    });
  const M = {
    down: mat(DOWN_FRAGMENT, { tMap: { value: null }, uD: v4() }),
    blur: mat(BLUR_FRAGMENT, { tMap: { value: null }, uDir: { value: new T.Vector2() } }),
    final: mat(FINAL_FRAGMENT, {
      tMap: { value: null },
      tBloom: { value: null },
      tBloom2: { value: null },
      uPost: v4(),
      uCopy: { value: new T.Vector2(2, 0.3) },
    }),
  };
  const quad = new T.Mesh(tri, M.final);
  quad.frustumCulled = false;
  postScene.add(quad);
  const pass = (material, to, map, set) => {
    quad.material = material;
    if (map) material.uniforms.tMap.value = map.texture;
    set?.(material.uniforms);
    renderer.setRenderTarget(to);
    renderer.render(postScene, postCam);
  };

  return {
    /** The target the scene is drawn into. */
    scene: rt.scene,
    resize(w, h) {
      rt.scene.setSize(w, h);
      rt.q1.setSize(w >> 2, h >> 2);
      rt.q2.setSize(w >> 2, h >> 2);
      rt.e1.setSize(w >> 3, h >> 3);
      rt.e2.setSize(w >> 3, h >> 3);
    },
    /** Bloom from the scene target, then the final composite to the screen. */
    run({ w, h, bloom2, bloom, tear, tick, copyY }) {
      pass(M.down, rt.q1, rt.scene, (u) => u.uD.value.set(1 / w, 1 / h, 0.42, 1.6));
      pass(M.blur, rt.q2, rt.q1, (u) => u.uDir.value.set(4 / w, 0));
      pass(M.blur, rt.q1, rt.q2, (u) => u.uDir.value.set(0, 4 / h));
      if (bloom2) {
        pass(M.down, rt.e1, rt.q1, (u) => u.uD.value.set(4 / w, 4 / h, 0, 1));
        pass(M.blur, rt.e2, rt.e1, (u) => u.uDir.value.set(8 / w, 0));
        pass(M.blur, rt.e1, rt.e2, (u) => u.uDir.value.set(0, 8 / h));
      }
      pass(M.final, null, rt.scene, (u) => {
        u.tBloom.value = rt.q1.texture;
        u.tBloom2.value = (bloom2 ? rt.e1 : rt.q1).texture;
        u.uPost.value.set(bloom * (bloom2 ? 0.5 : 0.8), tear, tick, 1);
        u.uCopy.value.set(copyY, 0.3);
      });
    },
    dispose() {
      tri.dispose();
      for (const m of Object.values(M)) m.dispose();
      for (const r of Object.values(rt)) r.dispose();
    },
  };
}
