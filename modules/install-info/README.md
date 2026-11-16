# agentico-install-info

Expo Module for facts about the installed binary, exported as constants (synchronous, no calls).

| Constant | iOS | Elsewhere |
|---|---|---|
| `storeReceiptName` | `Bundle.main.appStoreReceiptURL?.lastPathComponent`: `sandboxReceipt` for TestFlight (and development builds), `receipt` for the App Store | null |
| `version` | `CFBundleShortVersionString` | null |
| `build` | `CFBundleVersion` | null |

- The receipt URL's name is set whether or not the receipt file exists. A fresh TestFlight install has
  no file until StoreKit is used, so a check for the file never matched there.
- These are the binary's own values: under an over-the-air update, `expo-constants`' config is the update's.
- `installInfo()` loads the module on first use and answers nulls where it is absent (Android, web, Jest).
  Tests pass `fakeInstallInfo({ ... })` instead.
- iOS only for now: Android has no native side, and callers fall back (`apps/mobile/src/diagnostics/appBuild.ts`).
