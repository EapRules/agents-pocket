import { TALL_CONTENT } from './atlasBlockedTall';

describe('the tall Blocked card atlas state', () => {
  it('reads as the store would: shown from its request, the whole command and its description', () => {
    if (TALL_CONTENT.kind !== 'generic') throw new Error('generic');
    expect(TALL_CONTENT.shown?.command.split('\n')).toHaveLength(39);
    expect(TALL_CONTENT.shown?.command.startsWith('cd /workspace/storefront && ')).toBe(true);
    expect(TALL_CONTENT.shown?.description).not.toBeNull();
  });
});
