import { appBuild } from '@/diagnostics/appBuild';
import { problemReportBody } from '@/diagnostics/problemReport';
import { createAppUpdates, disabledUpdates, fakeUpdatesApi } from './appUpdates';
import { deviceUpdates } from './deviceUpdates';

const ID = '0f6a2b3c-1d2e-4f50-8a9b-0c1d2e3f4a5b';

describe('app updates', () => {
  it('is off without the native module or with updates disabled in the build', () => {
    expect(createAppUpdates(null)).toBe(disabledUpdates);
    expect(createAppUpdates(fakeUpdatesApi({ isEnabled: false })).enabled).toBe(false);
  });

  it('is off in tests, as in every build but an official store one', () => {
    expect(deviceUpdates.enabled).toBe(false);
  });

  it('reads what runs from expo-updates', () => {
    const createdAt = new Date('2026-11-14T00:00:00.000Z');
    const api = fakeUpdatesApi({ isEmbeddedLaunch: false, updateId: ID, createdAt });
    expect(createAppUpdates(api).running()).toEqual({ embedded: false, id: ID, createdAt });
  });
});

describe('the problem report names the running update only in a build with updates', () => {
  it('leaves it out without updates', () => {
    const build = appBuild(disabledUpdates);
    expect(build.update).toBeUndefined();
    expect(problemReportBody(build)).not.toMatch(/Update:/);
  });

  it('names the embedded JS or the update short id', () => {
    const embedded = appBuild(createAppUpdates(fakeUpdatesApi()));
    expect(embedded.update).toMatch(/embedded/);
    const api = fakeUpdatesApi({ isEmbeddedLaunch: false, updateId: ID, createdAt: new Date() });
    expect(problemReportBody(appBuild(createAppUpdates(api)))).toContain('0f6a2b3c');
  });
});
