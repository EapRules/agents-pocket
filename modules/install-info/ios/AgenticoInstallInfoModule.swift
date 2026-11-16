import ExpoModulesCore
import Foundation

/// Facts about the installed binary, exported as constants: no calls.
public final class AgenticoInstallInfoModule: Module {
    public func definition() -> ModuleDefinition {
        Name("AgenticoInstallInfo")

        /// The App Store receipt URL's last path component: `sandboxReceipt` for TestFlight (and
        /// development) installs, `receipt` for the App Store. Set whether or not the file exists.
        Constant("storeReceiptName") {
            Self.storeReceiptName()
        }

        /// The binary's marketing version (`CFBundleShortVersionString`), never an update's.
        Constant("version") {
            Self.infoString("CFBundleShortVersionString")
        }

        /// The binary's build (`CFBundleVersion`).
        Constant("build") {
            Self.infoString("CFBundleVersion")
        }
    }

    private static func storeReceiptName() -> String? {
        Bundle.main.appStoreReceiptURL?.lastPathComponent
    }

    private static func infoString(_ key: String) -> String? {
        Bundle.main.object(forInfoDictionaryKey: key) as? String
    }
}
