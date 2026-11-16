import { t } from '@openagentspocket/i18n';
import { toast } from '@openagentspocket/ui';
import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { useSettingsStore } from '@/settings/SettingsProvider';
import { DictationController, type DictationFailure } from './dictation';
import { systemSpeechEngine } from './speechEngine';

const FAILURE_TEXT: Record<DictationFailure, () => string> = {
  permission: () => t('Microphone access is off. Turn it on in Settings to dictate.'),
  language: () => t('Dictation is not available in this language.'),
  stopped: () => t('Dictation stopped unexpectedly.'),
};

const never = () => () => {};
const idle = () => false;

/** Dictation into the draft; `toggle` is undefined where this build has no recognizer. */
export function useDictation(insert: (text: string) => void) {
  const latest = useRef(insert);
  latest.current = insert;
  const settings = useSettingsStore();
  const controller = useMemo(() => {
    const engine = systemSpeechEngine(() => settings.get('dictationLanguage'));
    return engine
      ? new DictationController(
          engine,
          (text) => latest.current(text),
          // An unexpected stop shows the recognizer's code under the message: without it the cause
          // of a failure on someone's phone cannot be told from a report.
          (reason, code) =>
            toast({
              title: FAILURE_TEXT[reason](),
              message: reason === 'stopped' ? code : undefined,
            }),
        )
      : null;
  }, [settings]);
  useEffect(() => () => controller?.stop(), [controller]);
  const listening = useSyncExternalStore(
    controller?.subscribe ?? never,
    controller?.getSnapshot ?? idle,
    controller?.getSnapshot ?? idle,
  );
  const toggle = useMemo(
    () => (controller ? () => void controller.toggle() : undefined),
    [controller],
  );
  return { listening, toggle };
}
