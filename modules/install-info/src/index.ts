import { requireOptionalNativeModule } from 'expo';

/** Facts about the installed binary (never an over-the-air update's). Null where unknown. */
export interface InstallInfo {
  /** The App Store receipt URL's name: `sandboxReceipt` (TestFlight), `receipt` (App Store). iOS only. */
  readonly storeReceiptName: string | null;
  /** The binary's marketing version (`CFBundleShortVersionString`). */
  readonly version: string | null;
  /** The binary's build (`CFBundleVersion`). */
  readonly build: string | null;
}

/** The native module's constants as they arrive: untrusted until read. */
export type NativeInstallInfo = Partial<Record<keyof InstallInfo, unknown>>;

/** Where the native module is absent (Android, web, tests): nothing is known. */
export const unknownInstallInfo: InstallInfo = {
  storeReceiptName: null,
  version: null,
  build: null,
};

/** Test support: an install with the given facts, the rest unknown. */
export function fakeInstallInfo(facts: Partial<InstallInfo> = {}): InstallInfo {
  return { ...unknownInstallInfo, ...facts };
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

/** The constants as an `InstallInfo`: anything missing, empty or not a string is null. */
export function readInstallInfo(native: NativeInstallInfo | null): InstallInfo {
  if (!native) return unknownInstallInfo;
  return {
    storeReceiptName: text(native.storeReceiptName),
    version: text(native.version),
    build: text(native.build),
  };
}

let info: InstallInfo | undefined;

/** Loaded on first use so importing this package never requires the native module. */
export function installInfo(): InstallInfo {
  if (!info) {
    try {
      info = readInstallInfo(requireOptionalNativeModule<NativeInstallInfo>('AgenticoInstallInfo'));
    } catch {
      info = unknownInstallInfo;
    }
  }
  return info;
}
