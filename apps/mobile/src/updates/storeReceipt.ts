import { Platform } from 'react-native';

/**
 * Which StoreKit receipt file this install carries, if any: `sandboxReceipt` for TestFlight,
 * `receipt` for the App Store. Behind an interface so tests never touch the file system.
 */
export interface StoreReceiptProbe {
  /** The receipt file's name, or null (no receipt, not iOS, anything unreadable). Never throws. */
  storeReceiptName(): Promise<string | null>;
}

/** Candidates in the order they are looked for. */
const RECEIPT_NAMES = ['sandboxReceipt', 'receipt'] as const;

/** The directory the receipts sit in, from the document directory (`<container>/Documents`). */
export function receiptDirectory(documentUri: string): string {
  const documents = documentUri.replace(/\/+$/, '');
  return `${documents.slice(0, documents.lastIndexOf('/'))}/StoreKit`;
}

/** Test support: a probe answering a fixed name. */
export function fakeReceiptProbe(name: string | null): StoreReceiptProbe {
  return { storeReceiptName: async () => name };
}

/** iOS only: reads `<app data container>/StoreKit/` through expo-file-system. */
export const deviceReceiptProbe: StoreReceiptProbe = {
  async storeReceiptName() {
    if (Platform.OS !== 'ios') return null;
    try {
      const { File, Paths } = require('expo-file-system') as typeof import('expo-file-system');
      const dir = receiptDirectory(Paths.document.uri);
      for (const name of RECEIPT_NAMES) {
        if (new File(`${dir}/${name}`).exists) return name;
      }
    } catch {}
    return null;
  },
};
