import { resolveThemeId, summarizeRunningUpdate } from '@openagentspocket/core';
import { t } from '@openagentspocket/i18n';
import { themes } from '@openagentspocket/ui';
import { useCallback, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { appBuild, appVersionLabel } from '@/diagnostics/appBuild';
import type { AppUpdates } from '@/updates/appUpdates';
import {
  useAppUpdates,
  useAuthenticator,
  useDictationLanguagesSource,
  useSettings,
} from './SettingsProvider';
import type { SettingsContext } from './schema';
import { useSettingsSummary } from './useSettingsSummary';

/** The theme in force: the chosen one, or the Dark/Light pair slot of the system scheme. */
export function useResolvedThemeId() {
  const values = useSettings();
  const scheme = useColorScheme();
  return resolveThemeId(values, scheme === 'light' ? 'light' : 'dark');
}

/**
 * The running update as Settings shows it: the binary's own JS, or an update's short id as the
 * value with its date as the row's secondary line (both on one line do not fit a phone row).
 */
export function runningUpdateRow(updates: AppUpdates): { running: string; runningDate?: string } {
  const summary = summarizeRunningUpdate(updates.running());
  if (summary.kind === 'embedded') return { running: t('Built In') };
  return { running: summary.shortId, runningDate: summary.date ?? undefined };
}

const NO_LANGUAGES: readonly string[] = [];

/** The value `load` resolves to, `initial` until then; loads again when `load` changes. */
function useAsyncValue<T>(load: () => Promise<T>, initial: T): T {
  const [value, setValue] = useState(initial);
  useEffect(() => {
    let alive = true;
    load().then((next) => {
      if (alive) setValue(next);
    });
    return () => {
      alive = false;
    };
  }, [load]);
  return value;
}

/** What schema rows read: the values, the device's authentication kind, version, theme name. */
export function useSettingsContext(): SettingsContext {
  const values = useSettings();
  const authenticator = useAuthenticator();
  const themeId = useResolvedThemeId();
  const summary = useSettingsSummary();
  const updates = useAppUpdates();
  const authKind = useAsyncValue(
    useCallback(() => authenticator.kind(), [authenticator]),
    null,
  );
  const dictationLanguages = useAsyncValue(useDictationLanguagesSource(), NO_LANGUAGES);

  return {
    values,
    authKind,
    version: appVersionLabel(appBuild()),
    updates: { enabled: updates.enabled, ...runningUpdateRow(updates) },
    themeName: themes[themeId].name,
    themeId,
    summary,
    dictationLanguages,
  };
}
