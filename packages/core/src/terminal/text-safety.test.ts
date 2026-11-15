import { describe, expect, it } from 'vitest';
import { utf8Encode } from '../pairing/bytes';
import { pasteLineCount } from './paste-preview';
import {
  containsOnlySafeScalars,
  encodePaste,
  isMultiline,
  normalizingNewlines,
} from './text-safety';

describe('text safety', () => {
  it('allows tab, LF and CR and rejects other controls', () => {
    expect(containsOnlySafeScalars('a\tb\r\nc')).toBe(true);
    expect(containsOnlySafeScalars('日本語 🙂')).toBe(true);
    expect(containsOnlySafeScalars('a\u0007b')).toBe(false);
  });

  it('normalises CRLF and lone CR to LF, and sees CRLF as multiline', () => {
    expect(normalizingNewlines('a\r\nb\rc\nd')).toBe('a\nb\nc\nd');
    expect(isMultiline('a\r\nb')).toBe(true);
    expect(isMultiline('single')).toBe(false);
  });

  it('counts lines with CRLF as one break', () => {
    expect(pasteLineCount('a\r\nb\rc\nd')).toBe(4);
    expect(pasteLineCount('one')).toBe(1);
  });

  it('frames bracketed paste only when asked', () => {
    expect(encodePaste('hi', false)).toEqual(utf8Encode('hi'));
    const framed = encodePaste('hi', true);
    expect(Array.from(framed.slice(0, 6))).toEqual([0x1b, 0x5b, 0x32, 0x30, 0x30, 0x7e]);
    expect(Array.from(framed.slice(-6))).toEqual([0x1b, 0x5b, 0x32, 0x30, 0x31, 0x7e]);
    expect(framed).toHaveLength(14);
  });
});
