import SwiftUI
import UIKit
import WidgetKit

// MARK: - Direction A ("Sobrio")

/// The Live Activity's chrome, from the approved mockup's direction A: a
/// near-black card on every wallpaper and appearance, color only in the
/// status glyphs and the island keyline, white primary action.
enum AgentActivityChrome {
    /// `.A-card` rgba(16, 16, 18, 0.94).
    static let background = Color(red: 16 / 255, green: 16 / 255, blue: 18 / 255)
    static let backgroundOpacity = 0.94
    static let primary = AgenticoTheme.default.colors.textPrimary.color
    /// The mockup's rgba(235, 235, 245, .62) and .38: iOS's dark labels.
    static let secondary = Color(red: 235 / 255, green: 235 / 255, blue: 245 / 255).opacity(0.62)
    static let tertiary = Color(red: 235 / 255, green: 235 / 255, blue: 245 / 255).opacity(0.38)
    static let hairline = Color.white.opacity(0.08)
    /// The box a Blocked Agent's prompt sits in.
    static let commandFill = Color(red: 28 / 255, green: 28 / 255, blue: 30 / 255)
    static let commandStroke = Color.white.opacity(0.08)
    /// Deny: secondary.
    static let secondaryButtonFill = Color(red: 44 / 255, green: 44 / 255, blue: 46 / 255)
    /// Approve: primary, white like the app's "Yes".
    static let primaryButtonFill = Color(red: 242 / 255, green: 242 / 255, blue: 247 / 255)
    static let primaryButtonText = Color.black
    static let mark = Color.white.opacity(0.6)

    /// The Lock Screen tint ActivityKit draws behind the card.
    static var tint: Color { background.opacity(backgroundOpacity) }

    /// The island keyline: the most urgent status, strongest for Blocked.
    static func keyline(for status: String) -> Color {
        AgentActivityStatusStyle.ink(for: status).opacity(status == "blocked" ? 0.75 : 0.45)
    }
}

enum AgentActivityMetrics {
    static let lockScreenHorizontalPadding: CGFloat = 14
    /// Under the mockup's 14 so the Blocked card with a three-line prompt
    /// (the 120-character worst case) stays inside ActivityKit's 160 pt.
    static let lockScreenVerticalPadding: CGFloat = 10
    /// Status glyph of the one-Agent, All done and stale cards.
    static let heroGlyph: CGFloat = 24
    /// Status glyph beside a Blocked title and in the expanded island header.
    static let titleGlyph: CGFloat = 20
    /// Status glyph of a list row (the mockup's 17 px, was a 7 pt dot).
    static let rowGlyph: CGFloat = 17
    static let islandRowGlyph: CGFloat = 15
    static let tokenGlyph: CGFloat = 15
    static let cornerMark: CGFloat = 15
    static let compactMark: CGFloat = 20
    static let minimalMark: CGFloat = 22
    /// The limited-width island is a 28 pt circle.
    static let limitedWidthMark: CGFloat = 18
    static let rowHeight: CGFloat = 28
    static let islandRowHeight: CGFloat = 24
    static let buttonHeight: CGFloat = 36
    static let islandButtonHeight: CGFloat = 32
    static let commandRadius: CGFloat = 10
}

// MARK: - Status colors

/// The app's status colors (`AgenticoTheme`, compiled into this target),
/// always the dark-surface ones: both the near-black card and the island
/// are dark whatever the system appearance.
enum AgentActivityStatusStyle {
    /// The extension cannot read the theme chosen in the app; it shows the
    /// default theme, the only one so far.
    private static let theme = AgenticoTheme.default

    static func ink(for status: String) -> Color {
        theme.status(knownStatus(for: status), on: .dark).color
    }

    private static func knownStatus(for status: String) -> AgentStatus {
        switch status {
        case "blocked", "done", "working":
            return AgentStatus(rawValue: status)
        default:
            return .unknown
        }
    }
}

// MARK: - Status glyph

/// Status shapes, so a state never relies on color alone: an exclamation
/// mark asks for the user, a check mark has a result to read, an open ring
/// is still running, a dashed ring is unknown or out of date.
struct AgentActivityStatusGlyph: View {
    let status: String
    let size: CGFloat
    @Environment(\.isLuminanceReduced) private var isLuminanceReduced

    var body: some View {
        Group {
            if status == "working" {
                openRing
            } else {
                // One image for every symbol state, so a change replaces the
                // symbol in place instead of cross-fading two views.
                Image(systemName: Self.symbolName(for: status))
                    .resizable()
                    .scaledToFit()
                    .contentTransition(isLuminanceReduced ? .identity : .symbolEffect(.replace))
            }
        }
        .frame(width: size, height: size)
        .foregroundStyle(AgentActivityStatusStyle.ink(for: status))
        .accessibilityHidden(true)
    }

    static func symbolName(for status: String) -> String {
        switch status {
        case "blocked": "exclamationmark.circle.fill"
        case "done": "checkmark.circle.fill"
        default: "circle.dashed"
        }
    }

    /// Drawn rather than a symbol: a Live Activity cannot spin, so the ring
    /// stays open to read as unfinished at rest (the mockup's 3/4 arc, radius
    /// 7.4 and stroke 2.8 of 20).
    private var openRing: some View {
        Circle()
            .trim(from: 0, to: 0.75)
            .stroke(style: StrokeStyle(lineWidth: size * 0.14, lineCap: .round))
            .rotationEffect(.degrees(-90))
            .padding(size * 0.13)
    }
}

// MARK: - Motion

extension View {
    /// Counts roll to their new value; nothing moves in Always-On.
    func activityNumericTransition(_ value: Int) -> some View {
        modifier(AgentActivityNumericTransition(value: value))
    }

    /// The activity's glyphs and budgets are sized for the default text size,
    /// and ActivityKit cuts the Lock Screen at 160 pt and the expanded island
    /// at its 160 pt, so larger Dynamic Type sizes stop here.
    func activityTypeSize() -> some View {
        dynamicTypeSize(...DynamicTypeSize.large)
    }
}

private struct AgentActivityNumericTransition: ViewModifier {
    let value: Int
    @Environment(\.isLuminanceReduced) private var isLuminanceReduced

    func body(content: Content) -> some View {
        content.contentTransition(
            isLuminanceReduced ? .identity : .numericText(value: Double(value)))
    }
}
