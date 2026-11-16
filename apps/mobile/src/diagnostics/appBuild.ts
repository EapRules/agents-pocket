import {
  formatAppVersion,
  runningUpdateReportText,
  summarizeRunningUpdate,
} from '@openagentspocket/core';
import { type InstallInfo, installInfo } from 'agentico-install-info';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type { AppUpdates } from '@/updates/appUpdates';
import { deviceUpdates } from '@/updates/deviceUpdates';
import type { AppBuild } from './problemReport';

/**
 * The running app's version, build, system and, in a build with over-the-air updates, the update it
 * runs: Settings shows the version, a problem report sends them all. Version and build are the
 * binary's own (read natively; under an update `Constants.expoConfig` is the update's config), the
 * `Constants` values as a fallback where the native module is absent.
 */
export function appBuild(
  updates: AppUpdates = deviceUpdates,
  install: InstallInfo = installInfo(),
): AppBuild {
  const build =
    install.build ??
    Constants.platform?.ios?.buildNumber ??
    Constants.expoConfig?.ios?.buildNumber ??
    String(Constants.platform?.android?.versionCode ?? '');
  return {
    version: install.version ?? Constants.expoConfig?.version ?? '',
    build,
    system: `${Platform.OS} ${Platform.Version}`,
    ...(updates.enabled
      ? { update: runningUpdateReportText(summarizeRunningUpdate(updates.running())) }
      : {}),
  };
}

/** The version and build in the form releases use (`1.0.2 (8)`): Settings and reports share it. */
export function appVersionLabel(build: AppBuild): string {
  return formatAppVersion(build.version, build.build);
}
