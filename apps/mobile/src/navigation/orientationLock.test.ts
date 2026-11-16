import { orientationPolicyFor } from './orientationLock';

describe('orientationPolicyFor', () => {
  it('locks a compact window to portrait', () => {
    expect(orientationPolicyFor('compact')).toBe('portrait');
  });

  it.each(['regular', 'wide', 'expansive'] as const)('lets a %s window rotate', (mode) => {
    expect(orientationPolicyFor(mode)).toBe('free');
  });
});
