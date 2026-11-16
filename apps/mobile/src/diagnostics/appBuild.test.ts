import { fakeInstallInfo, installInfo, readInstallInfo } from 'agentico-install-info';
import Constants from 'expo-constants';
import { disabledUpdates } from '@/updates/appUpdates';
import { appBuild, appVersionLabel } from './appBuild';

describe('appBuild', () => {
  it("names the binary's own version and build when the native module answers", () => {
    const build = appBuild(disabledUpdates, fakeInstallInfo({ version: '1.0.2', build: '8' }));
    expect(build.version).toBe('1.0.2');
    expect(build.build).toBe('8');
  });

  it("falls back to the config's version where the native module is absent", () => {
    const build = appBuild(disabledUpdates, fakeInstallInfo());
    expect(build.version).toBe(Constants.expoConfig?.version ?? '');
  });
});

describe('install info', () => {
  it('is all null where the native module is absent (tests included)', () => {
    expect(installInfo()).toEqual(fakeInstallInfo());
  });

  it('keeps only non-empty strings from the native constants', () => {
    expect(readInstallInfo({ storeReceiptName: 'receipt', version: '', build: 8 })).toEqual(
      fakeInstallInfo({ storeReceiptName: 'receipt' }),
    );
    expect(readInstallInfo(null)).toEqual(fakeInstallInfo());
  });
});

describe('appVersionLabel', () => {
  it('names version and build in the form releases use', () => {
    expect(appVersionLabel({ version: '1.0.2', build: '8', system: 'ios 26.1' })).toBe('1.0.2 (8)');
  });

  it('is the version alone when the build is empty', () => {
    expect(appVersionLabel({ version: '1.0.2', build: '', system: 'ios 26.1' })).toBe('1.0.2');
  });
});
