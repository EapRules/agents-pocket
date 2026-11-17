import { describe, expect, it } from 'vitest';
import { applyDictation, settleDictation } from './draft';

const partial = (text: string) => ({ text, final: false });
const final = (text: string) => ({ text, final: true });

describe('dictation into the end of the draft', () => {
  it('shows the phrase so far and revises it in place', () => {
    const first = applyDictation('', '', partial('fix'));
    expect(first).toEqual({ draft: 'fix', provisional: 'fix' });
    const revised = applyDictation(first.draft, first.provisional, partial('fix the tests'));
    expect(revised).toEqual({ draft: 'fix the tests', provisional: 'fix the tests' });
    const shorter = applyDictation(revised.draft, revised.provisional, partial('fixed'));
    expect(shorter.draft).toBe('fixed');
  });

  it('keeps a finished phrase, followed by a space, and clears the provisional', () => {
    const heard = applyDictation('fix', 'fix', final('fix the tests'));
    expect(heard).toEqual({ draft: 'fix the tests ', provisional: '' });
    const next = applyDictation(heard.draft, heard.provisional, partial('then'));
    expect(next).toEqual({ draft: 'fix the tests then', provisional: 'then' });
  });

  it('writes after what the person typed, with a space between', () => {
    expect(applyDictation('Please', '', partial('run it'))).toEqual({
      draft: 'Please run it',
      provisional: ' run it',
    });
    const revised = applyDictation('Please run it', ' run it', partial('run it now'));
    expect(revised.draft).toBe('Please run it now');
    expect(applyDictation('Please\n', '', final('run it')).draft).toBe('Please\nrun it ');
  });

  it('keeps what the person typed past the provisional, and appends the new text', () => {
    const next = applyDictation('fix the! ', 'fix the', partial('fix the tests'));
    expect(next.draft).toBe('fix the! fix the tests');
    expect(next.provisional).toBe('fix the tests');
    // A draft the person cleared starts over with the new text.
    expect(applyDictation('', 'fix the', partial('fix the tests')).draft).toBe('fix the tests');
  });

  it('never deletes visible text for a result with no words', () => {
    expect(applyDictation('fix', 'fix', partial('  '))).toEqual({
      draft: 'fix',
      provisional: 'fix',
    });
    expect(applyDictation('fix', 'fix', final(''))).toEqual({ draft: 'fix ', provisional: '' });
  });

  it('trims what the recognizer sends', () => {
    expect(applyDictation('one ', '', partial(' two')).draft).toBe('one two');
  });
});

describe('stopping dictation', () => {
  it('keeps the provisional phrase as finished', () => {
    expect(settleDictation('fix the', 'fix the')).toEqual({ draft: 'fix the ', provisional: '' });
  });

  it('leaves the draft alone when nothing is provisional or the person wrote past it', () => {
    expect(settleDictation('done ', '')).toEqual({ draft: 'done ', provisional: '' });
    expect(settleDictation('fix the!', 'fix the')).toEqual({ draft: 'fix the!', provisional: '' });
  });
});
