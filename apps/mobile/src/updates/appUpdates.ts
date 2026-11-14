import type { RunningUpdate } from '@openagentspocket/core';

/**
 * Over-the-air updates as the app uses them (docs/guides/updates.md): whether this build has them,
 * and what runs. Updates download at launch and apply on the next cold start, which
 * expo-updates does by itself (`ON_LOAD`, timeout 0): nothing here checks, fetches or reloads.
 */
export interface AppUpdates {
  /** False in a build from source, a development build, on web and in tests. */
  readonly enabled: boolean;
  running(): RunningUpdate;
}

/** The slice of `expo-updates` this uses; tests pass a fake. */
export interface UpdatesApi {
  readonly isEnabled: boolean;
  readonly isEmbeddedLaunch: boolean;
  readonly updateId: string | null;
  readonly createdAt: Date | null;
}

const EMBEDDED: RunningUpdate = { embedded: true, id: null, createdAt: null };

/** A build without updates: Settings shows nothing about them. */
export const disabledUpdates: AppUpdates = {
  enabled: false,
  running: () => EMBEDDED,
};

export function createAppUpdates(api: UpdatesApi | null): AppUpdates {
  if (!api?.isEnabled) return disabledUpdates;
  return {
    enabled: true,
    running: () => ({
      embedded: api.isEmbeddedLaunch,
      id: api.updateId,
      createdAt: api.createdAt,
    }),
  };
}

/** Test support: an updates-enabled build. */
export function fakeUpdatesApi(over: Partial<UpdatesApi> = {}): UpdatesApi {
  return {
    isEnabled: true,
    isEmbeddedLaunch: true,
    updateId: null,
    createdAt: null,
    ...over,
  };
}
