// Agents Pocket hero: the hands as a real volume of dots inside a three.js space.
// Boot order: decode the field, show the 2D still at once, then bring three.js in.
// Any failure (no three.js, no WebGL, a lost context) leaves the still in place.
import { createCloudBuilder, geoFrame } from './cloud.js';
import { createEngine } from './engine.js';
import { deriveField, loadField } from './field.js';
import { attachInput } from './input.js';
import { measure } from './layout.js';
import { now, reduce, view } from './state.js';
import { drawStill } from './still.js';

const sceneCv = document.getElementById('scene');
const stillCv = document.getElementById('still');
const hero = document.getElementById('hero');
const copy = document.getElementById('copy');

const geo = geoFrame();
let D = null;
let buildCloud = null;
let cloud = null;
let engine = null;
let glState = 'wait'; // wait, on, lost (the context is gone, the still shows) or none (no 3D at all)
let heroVisible = true;

function showGL(on) {
  glState = on ? 'on' : glState === 'on' ? 'lost' : glState;
  sceneCv.classList.toggle('on', on);
  stillCv.classList.toggle('off', on);
  if (!on) drawStill(stillCv, cloud, geo);
}

function layout() {
  const tierChanged = measure({ canvas: sceneCv, hero, copy }, D, geo);
  if (!D) return;
  if (tierChanged) {
    cloud = buildCloud(view.tier.xLim);
    engine?.setCloud(cloud);
  }
  engine?.resize();
  if (glState !== 'on') drawStill(stillCv, cloud, geo);
}

// Loop: only while the hero and the tab are visible; under reduced motion only while something changes.
let rafId = 0;
let lastFrame = { lightDelta: 0 };
let dirty = true;
function needsFrames() {
  if (!engine || glState !== 'on' || document.hidden || !heroVisible) return false;
  if (!reduce.matches) return true;
  return dirty || lastFrame.lightDelta > 0.01;
}
function schedule() {
  if (!rafId && needsFrames()) rafId = requestAnimationFrame(frame);
}
function frame(ms) {
  rafId = 0;
  if (!engine || glState !== 'on' || document.hidden || !heroVisible) return;
  lastFrame = engine.render(ms / 1000);
  dirty = false;
  schedule();
}
function kick() {
  dirty = true;
  schedule();
}

let lostTimer = 0;
async function boot() {
  D = deriveField(await loadField());
  buildCloud = createCloudBuilder(D, geo);
  layout(); // builds the cloud for this width and draws the still
  try {
    engine = createEngine(await import('three'), sceneCv, geo);
  } catch {
    engine = null;
  }
  if (!engine) {
    glState = 'none';
    showGL(false);
    return;
  }
  sceneCv.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    showGL(false);
    // If the browser does not give the context back, the still stays and the GPU objects are released.
    lostTimer = setTimeout(() => {
      glState = 'none';
      showGL(false);
      engine.dispose();
      engine = null;
    }, 6000);
  });
  sceneCv.addEventListener('webglcontextrestored', () => {
    clearTimeout(lostTimer);
    if (!engine) return;
    engine.resize();
    engine.rebuild();
    showGL(true);
    kick();
  });
  engine.setCloud(cloud);
  engine.resize();
  engine.render(now()); // compile and draw one frame before the canvas fades in
  showGL(true);
  kick();
}

attachInput(hero, kick);
new IntersectionObserver((entries) => {
  heroVisible = entries[0].isIntersecting;
  kick();
}).observe(hero);
new ResizeObserver(() => {
  layout();
  kick();
}).observe(document.documentElement);
document.fonts?.ready.then(() => {
  layout(); // the text block moves when the web fonts arrive
  kick();
});
boot();
