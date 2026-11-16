import { appVersionLabel } from './appBuild';

describe('appVersionLabel', () => {
  it('names version and build in the form releases use', () => {
    expect(appVersionLabel({ version: '1.0.2', build: '8', system: 'ios 26.1' })).toBe('1.0.2 (8)');
  });

  it('is the version alone when the build is empty', () => {
    expect(appVersionLabel({ version: '1.0.2', build: '', system: 'ios 26.1' })).toBe('1.0.2');
  });
});
