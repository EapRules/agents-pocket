import { dictationLanguages, dictationLocale } from '@openagentspocket/core';
import { deviceLocaleTag } from '@openagentspocket/i18n';
import { Platform, Settings } from 'react-native';
import type { SpeechEngine } from './dictation';

type Speech = typeof import('expo-speech-recognition').ExpoSpeechRecognitionModule;

/** The native module, loaded on first use: a build without it has no Dictate entry, not a crash. */
function speechModule(): Speech | null {
  try {
    return (require('expo-speech-recognition') as typeof import('expo-speech-recognition'))
      .ExpoSpeechRecognitionModule;
  } catch {
    return null;
  }
}

/**
 * The device's languages in the person's order. iOS keeps them in the `AppleLanguages` default
 * (read through React Native's Settings, no extra module); elsewhere, or when that is unreadable,
 * the one locale the JS engine reports.
 */
export function devicePreferredLocales(): string[] {
  if (Platform.OS === 'ios') {
    try {
      const languages: unknown = Settings.get('AppleLanguages');
      if (Array.isArray(languages)) {
        const tags = languages.filter(
          (tag): tag is string => typeof tag === 'string' && tag !== '',
        );
        if (tags.length > 0) return tags;
      }
    } catch {
      // Fall through to the engine's locale.
    }
  }
  return [deviceLocaleTag()];
}

let supported: Promise<readonly string[]> | undefined;

/** The recognizer's locales, asked once; empty when this build or OS cannot list them (Android 12 and below). */
function recognizerLocales(speech: Speech): Promise<readonly string[]> {
  supported ??= speech.getSupportedLocales({}).then(
    (result) => result.locales,
    () => [],
  );
  return supported;
}

/** The languages Settings offers for dictation; empty where this build has no recognizer. */
export async function systemDictationLanguages(): Promise<readonly string[]> {
  const speech = speechModule();
  if (!speech) return [];
  return dictationLanguages(await recognizerLocales(speech), devicePreferredLocales());
}

/**
 * The system recognizer, in `chosen()` (a stored recognizer locale, empty for Automatic) or the
 * first device language it supports; null where this build does not have it.
 */
export function systemSpeechEngine(chosen: () => string): SpeechEngine | null {
  const speech = speechModule();
  if (!speech) return null;
  return {
    requestPermission: async () => (await speech.requestPermissionsAsync()).granted,
    language: async () => {
      const locales = await recognizerLocales(speech);
      const preferred = devicePreferredLocales();
      // A list the recognizer cannot give is not a "no": start as before and let it answer.
      if (locales.length === 0) return chosen() || (preferred[0] ?? deviceLocaleTag());
      return dictationLocale(locales, preferred, chosen() || null);
    },
    start: (events, language) => {
      const listeners = [
        speech.addListener('result', (event) => {
          const text = event.results[0]?.transcript;
          if (event.isFinal && text) events.onFinal(text);
        }),
        speech.addListener('error', (event) => events.onError(event.error)),
        speech.addListener('end', () => {
          for (const listener of listeners) listener.remove();
          events.onEnd();
        }),
      ];
      speech.start({
        lang: language,
        continuous: true,
        addsPunctuation: true,
      });
    },
    stop: () => speech.stop(),
  };
}
