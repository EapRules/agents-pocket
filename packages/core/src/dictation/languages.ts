/**
 * Which language the system speech recognizer starts in. The recognizer accepts only an identifier
 * from its own list (iOS: exactly one of `SFSpeechRecognizer.supportedLocales()`), so a device tag
 * such as `en-AR` must be matched to one of them first. Pure: the lists come from the caller.
 */

interface ParsedTag {
  language: string;
  region: string | undefined;
}

/** `en_US`, `zh-Hans-CN`, `es-419`: the language and the region (two letters or three digits). */
function parse(tag: string): ParsedTag {
  const parts = tag.trim().toLowerCase().split(/[-_]/);
  const region = parts.slice(1).find((part) => /^([a-z]{2}|\d{3})$/.test(part));
  return { language: parts[0] ?? '', region };
}

const sameTag = (a: string, b: string) =>
  a.trim().toLowerCase().replace(/_/g, '-') === b.trim().toLowerCase().replace(/_/g, '-');

/** Spanish outside Spain: the Latin American variants come before Spain's. */
const LATIN_AMERICAN_SPANISH = ['es-419', 'es-MX', 'es-US', 'es-ES'];

/** The most common variants of a language, tried in order when the device's region has none. */
const COMMON: Readonly<Record<string, readonly string[]>> = {
  ar: ['ar-SA'],
  de: ['de-DE'],
  en: ['en-US', 'en-GB'],
  es: ['es-ES', 'es-MX', 'es-419', 'es-US'],
  fr: ['fr-FR', 'fr-CA'],
  it: ['it-IT'],
  ja: ['ja-JP'],
  ko: ['ko-KR'],
  nl: ['nl-NL'],
  pt: ['pt-BR', 'pt-PT'],
  ru: ['ru-RU'],
  zh: ['zh-CN', 'zh-TW', 'zh-HK'],
};

function commonVariants({ language, region }: ParsedTag): readonly string[] {
  if (language === 'es' && region !== undefined && region !== 'es') return LATIN_AMERICAN_SPANISH;
  return COMMON[language] ?? [];
}

/** The supported identifier (verbatim, as the recognizer wants it) for one device tag, if any. */
function match(supported: readonly string[], tag: string): string | undefined {
  const exact = supported.find((locale) => sameTag(locale, tag));
  if (exact) return exact;
  const wanted = parse(tag);
  const sameLanguage = supported.filter((locale) => parse(locale).language === wanted.language);
  if (sameLanguage.length === 0) return undefined;
  if (wanted.region) {
    const sameRegion = sameLanguage.find((locale) => parse(locale).region === wanted.region);
    if (sameRegion) return sameRegion;
  }
  for (const common of commonVariants(wanted)) {
    const found = sameLanguage.find((locale) => sameTag(locale, common));
    if (found) return found;
  }
  return sameLanguage[0];
}

/**
 * The languages dictation can offer: one supported locale per preferred device language, in the
 * device's order, without repeats. Languages the recognizer lacks are left out.
 */
export function dictationLanguages(
  supported: readonly string[],
  preferred: readonly string[],
): string[] {
  const choices: string[] = [];
  for (const tag of preferred) {
    const locale = match(supported, tag);
    if (locale && !choices.includes(locale)) choices.push(locale);
  }
  return choices;
}

/**
 * The locale dictation starts in: the stored choice while the recognizer still supports it, else
 * the first device language it supports; null when it supports none of them.
 */
export function dictationLocale(
  supported: readonly string[],
  preferred: readonly string[],
  stored: string | null,
): string | null {
  const chosen = stored ? supported.find((locale) => sameTag(locale, stored)) : undefined;
  return chosen ?? dictationLanguages(supported, preferred)[0] ?? null;
}

/** Why dictation stopped, as the Composer tells it. */
export type DictationFailure = 'permission' | 'language' | 'stopped';

const FAILURES: Readonly<Record<string, DictationFailure | null>> = {
  'not-allowed': 'permission',
  'service-not-allowed': 'permission',
  'language-not-supported': 'language',
  // Nothing went wrong that the person needs to hear about: dictation just stops.
  'no-speech': null,
  aborted: null,
};

/** What a recognizer error code (expo-speech-recognition's) means for the person; null says nothing. */
export function dictationFailure(code: string): DictationFailure | null {
  return Object.hasOwn(FAILURES, code) ? (FAILURES[code] ?? null) : 'stopped';
}
