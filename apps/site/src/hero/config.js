// Scene constants: world units, the Tormenta staging and the density tiers.
export const WPP = 2; // world units per field pixel
export const GAP_OPEN = 7; // each hand sits this far back from the source pose at rest
export const CAM_DIST = 1200; // camera to the gap at rest
export const U0 = 270; // the forearm bends into depth between these distances from the fingertip
export const U1 = 560; // (the hand itself stays flat)
export const RIP_SPEED = 430; // world units per second; a ripple lives about 2.4 s
export const PHONE_PULL = 75; // phones: each hand moves this far toward the centre

// Tormenta: gusts tear slices of the hands toward the camera and the gap flashes.
export const STORM = {
  stage: [0.3, -0.25, 12, -12], // left bend, right bend, left z, right z
  lens: [10, 8], // aperture, largest blur radius
  fog: 0.0012,
  cam: { yaw: 0.3, pitch: 0.1, idle: 0.16, shake: 1 },
  bloom: 0.5,
  dust: 1.2,
  still: 5.0, // the time the scene is frozen at under reduced motion
  stillYaw: 0.2,
};

// Density tiers: narrower screens get fewer points (kept near the hands), fewer ghosts,
// smaller blur discs, one bloom level and a smaller feedback buffer.
const TIERS = {
  desk: { name: 'desk', xLim: 1e4, dust: 4200, ghost: 0.7, maxBlur: 1, bloom2: true },
  tablet: { name: 'tablet', xLim: 800, dust: 2600, ghost: 0.6, maxBlur: 0.8, bloom2: true },
  phone: { name: 'phone', xLim: 700, dust: 1400, ghost: 0.5, maxBlur: 0.6, bloom2: false },
};
export const tierFor = (w) => (w >= 1200 ? TIERS.desk : w >= 600 ? TIERS.tablet : TIERS.phone);
