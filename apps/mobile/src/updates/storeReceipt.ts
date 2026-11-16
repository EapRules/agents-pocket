import { type InstallInfo, installInfo } from 'agentico-install-info';

/**
 * The name of this install's StoreKit receipt: `sandboxReceipt` for TestFlight, `receipt` for the App
 * Store. Behind an interface so tests never touch the native module.
 */
export interface StoreReceiptProbe {
  /** The receipt's name, or null (not iOS, anything unreadable). Never throws. */
  storeReceiptName(): Promise<string | null>;
}

/** Test support: a probe answering a fixed name. */
export function fakeReceiptProbe(name: string | null): StoreReceiptProbe {
  return { storeReceiptName: async () => name };
}

/**
 * A probe over the installed binary's facts. The name is the receipt URL's, read natively, so it is
 * known before the receipt file exists (a fresh TestFlight install has none until StoreKit is used).
 */
export function installReceiptProbe(read: () => InstallInfo = installInfo): StoreReceiptProbe {
  return {
    async storeReceiptName() {
      try {
        return read().storeReceiptName;
      } catch {
        return null;
      }
    },
  };
}

export const deviceReceiptProbe: StoreReceiptProbe = installReceiptProbe();
