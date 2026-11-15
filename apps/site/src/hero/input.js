// Input: Pointer Events only. A mouse steers by position, a finger steers by dragging; a tap is the contact
// (it starts a ripple on the dot grid). `kick` asks the loop for a frame.
import { clamp } from './math.js';
import { now, ptr, reduce, tap, view } from './state.js';

export function attachInput(hero, kick) {
  const contact = () => {
    tap.at = now();
    kick();
  };

  addEventListener(
    'pointermove',
    (e) => {
      const t = now();
      if (ptr.active && t > ptr.pt) {
        const speed =
          Math.hypot(e.clientX - ptr.x, e.clientY - ptr.y) / Math.max(0.008, t - ptr.pt);
        ptr.speed = Math.max(ptr.speed * 0.8, speed);
      }
      ptr.touch = e.pointerType === 'touch';
      if (ptr.touch && ptr.active) {
        ptr.dragYaw = clamp(ptr.dragYaw + ((e.clientX - ptr.x) / view.W) * 3, -1, 1);
        ptr.dragPitch = clamp(ptr.dragPitch - ((e.clientY - ptr.y) / view.H) * 3, -1, 1);
      }
      ptr.x = e.clientX;
      ptr.y = e.clientY;
      ptr.pt = t;
      ptr.active = true;
      ptr.last = t;
      kick();
    },
    { passive: true },
  );
  document.documentElement.addEventListener('pointerleave', () => {
    ptr.active = false;
    kick();
  });

  hero.addEventListener('pointerdown', (e) => {
    if (e.target.closest('a, button')) return;
    const t = now();
    ptr.touch = e.pointerType === 'touch';
    ptr.x = ptr.downX = e.clientX;
    ptr.y = ptr.downY = e.clientY;
    ptr.downT = t;
    ptr.pt = t;
    ptr.active = true;
    ptr.last = t;
    if (!ptr.touch) contact();
    else kick();
  });
  hero.addEventListener('pointerup', (e) => {
    const quick = now() - ptr.downT < 0.5;
    const still = Math.hypot(e.clientX - ptr.downX, e.clientY - ptr.downY) < 12;
    if (e.pointerType === 'touch' && quick && still && !e.target.closest('a, button')) contact();
  });

  addEventListener('scroll', kick, { passive: true });
  document.addEventListener('visibilitychange', kick);
  reduce.addEventListener?.('change', kick);
}
