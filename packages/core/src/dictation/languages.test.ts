import { describe, expect, it } from 'vitest';
import { dictationFailure, dictationLanguages, dictationLocale } from './languages';

const IOS = [
  'de-DE',
  'en-AU',
  'en-GB',
  'en-US',
  'es-CL',
  'es-ES',
  'es-MX',
  'es-US',
  'pt-BR',
  'zh-CN',
];

describe('dictation languages', () => {
  it('prefers an exact match, ignoring case and separator, and returns the supported id verbatim', () => {
    expect(dictationLanguages(IOS, ['en_gb'])).toEqual(['en-GB']);
  });

  it('falls back to the same language and region, then the common variant, then any', () => {
    expect(dictationLanguages(IOS, ['zh-Hans-CN'])).toEqual(['zh-CN']);
    expect(dictationLanguages(IOS, ['en-AR'])).toEqual(['en-US']);
    expect(dictationLanguages(IOS, ['es-AR'])).toEqual(['es-MX']);
    expect(dictationLanguages(IOS, ['es'])).toEqual(['es-ES']);
    expect(dictationLanguages(['de-AT', 'de-CH'], ['de-LU'])).toEqual(['de-AT']);
  });

  it('keeps the device order, drops unsupported languages and repeats', () => {
    expect(dictationLanguages(IOS, ['en-AR', 'tlh', 'es-AR', 'en-US'])).toEqual(['en-US', 'es-MX']);
  });

  it('has no choice when the recognizer supports none of the device languages', () => {
    expect(dictationLanguages(IOS, ['tlh-AR'])).toEqual([]);
    expect(dictationLanguages([], ['en-US'])).toEqual([]);
  });
});

describe('dictation locale', () => {
  it('starts in the stored choice while it is supported', () => {
    expect(dictationLocale(IOS, ['en-AR'], 'es_mx')).toBe('es-MX');
  });

  it('falls back to the first device language when the choice is gone or automatic', () => {
    expect(dictationLocale(IOS, ['en-AR', 'es-AR'], 'fr-FR')).toBe('en-US');
    expect(dictationLocale(IOS, ['es-AR'], null)).toBe('es-MX');
  });

  it('is null when nothing the device speaks is supported', () => {
    expect(dictationLocale(IOS, ['tlh'], null)).toBeNull();
  });
});

describe('dictation failure', () => {
  it('maps recognizer codes to what the person is told', () => {
    expect(dictationFailure('not-allowed')).toBe('permission');
    expect(dictationFailure('service-not-allowed')).toBe('permission');
    expect(dictationFailure('language-not-supported')).toBe('language');
    expect(dictationFailure('no-speech')).toBeNull();
    expect(dictationFailure('aborted')).toBeNull();
    expect(dictationFailure('network')).toBe('stopped');
    expect(dictationFailure('toString')).toBe('stopped');
  });
});
