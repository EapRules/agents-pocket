import ActivityKit
import SwiftUI
import UIKit
import WidgetKit

// MARK: - Shared pieces

/// Wraps content in a deep link to that Agent's detail. The outer widgetURL
/// remains the fallback for taps on the surrounding chrome.
struct AgentActivityAgentLink<Content: View>: View {
    let hostID: String
    let agent: AgentActivityDetails.AgentDetail
    var minimumHeight: CGFloat = 0
    @ViewBuilder let content: Content

    var body: some View {
        if let url = AgentActivityLink.agentURL(hostID: hostID, paneID: agent.paneID) {
            Link(destination: url) {
                content
                    .frame(maxWidth: .infinity, minHeight: minimumHeight, alignment: .leading)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .tint(AgentActivityChrome.primary)
            .accessibilityLabel(AgentActivityNarration.rowLabel(for: agent))
            .accessibilityHint("Opens this Agent in Agents Pocket")
        } else {
            content
                .frame(maxWidth: .infinity, minHeight: minimumHeight, alignment: .leading)
        }
    }
}

/// An Agent's three lines as direction A sets them: the name (semibold),
/// the detail (workspace or path, monospaced) and the task. Configured Agent
/// List Fields fill the same three lines, in order, with their own colors.
struct AgentActivityAgentText {
    enum Line { case name, detail, task }

    let name: [AgentActivityDetails.Field]
    /// The program beside a custom name ("codex · Codex"); nil otherwise.
    let program: String?
    let detail: [AgentActivityDetails.Field]?
    let task: [AgentActivityDetails.Field]?

    init(_ agent: AgentActivityDetails.AgentDetail) {
        let kind = AgentNotificationIdentity.kindLabel(agent.kind)
        if let rows = agent.rows, let first = rows.first {
            name = first
            program = nil
            detail = rows.count > 1 ? rows[1] : nil
            task = rows.count > 2 ? rows[2] : nil
        } else {
            name = [.init(text: agent.name ?? kind)]
            program = agent.name == nil ? nil : kind
            detail = agent.displayWorkspace.map { [.init(text: $0)] }
            task = agent.title.map { [.init(text: $0)] }
        }
    }

    var plainName: String { name.map(\.text).joined() }

    /// Every line as plain text, for VoiceOver.
    var plainLines: [String] {
        let first = [plainName, program].compactMap(\.self).joined(separator: " · ")
        return ([first] + [detail, task].compactMap { $0?.map(\.text).joined() })
            .filter { !$0.isEmpty }
    }

    func text(_ line: Line) -> Text? {
        let fields: [AgentActivityDetails.Field]? = switch line {
        case .name: name
        case .detail: detail
        case .task: task
        }
        guard let fields, !fields.isEmpty else { return nil }
        return Text(AgentActivityFields.attributedText(fields, line: line))
    }
}

enum AgentActivityFields {
    static func font(for line: AgentActivityAgentText.Line) -> Font {
        switch line {
        case .name: .subheadline
        case .detail: .footnote.monospaced()
        case .task: .subheadline
        }
    }

    static func attributedText(
        _ fields: [AgentActivityDetails.Field], line: AgentActivityAgentText.Line
    ) -> AttributedString {
        var result = AttributedString()
        for field in fields {
            var span = AttributedString(field.text)
            let weight: Font.Weight = if let bold = field.bold {
                bold ? .bold : .regular
            } else {
                line == .name ? .semibold : .medium
            }
            span.font = font(for: line).weight(weight)
            span.foregroundColor = foreground(for: field, line: line)
            result.append(span)
        }
        return result
    }

    static func foreground(
        for field: AgentActivityDetails.Field, line: AgentActivityAgentText.Line
    ) -> Color {
        if let hex = field.fg, let color = hexColor(hex) {
            return Color(uiColor: color).opacity(field.dim == true ? 0.6 : 1)
        }
        if field.dim == true {
            return line == .name ? AgentActivityChrome.secondary : AgentActivityChrome.tertiary
        }
        return line == .detail ? AgentActivityChrome.secondary : AgentActivityChrome.primary
    }

    private static func hexColor(_ value: String) -> UIColor? {
        guard value.first == "#", value.utf8.count == 4 || value.utf8.count == 7 else { return nil }
        let digits = value.dropFirst()
        guard digits.utf8.allSatisfy({
            (48...57).contains($0) || (65...70).contains($0) || (97...102).contains($0)
        }) else { return nil }
        let expanded = digits.count == 3 ? digits.map { "\($0)\($0)" }.joined() : String(digits)
        guard let rgb = UInt32(expanded, radix: 16) else { return nil }
        return UIColor(
            red: CGFloat((rgb >> 16) & 0xff) / 255,
            green: CGFloat((rgb >> 8) & 0xff) / 255,
            blue: CGFloat(rgb & 0xff) / 255, alpha: 1)
    }
}

/// One list row: status glyph, name, then the detail line truncating first.
/// A later stage puts the Agent's timer on the trailing edge.
struct AgentActivityListRow: View {
    let hostID: String
    let agent: AgentActivityDetails.AgentDetail
    var glyphSize = AgentActivityMetrics.rowGlyph
    var height = AgentActivityMetrics.rowHeight
    /// Draws the row as unknown (the stale card) instead of its last status.
    var statusOverride: String? = nil

    var body: some View {
        let text = AgentActivityAgentText(agent)
        AgentActivityAgentLink(hostID: hostID, agent: agent, minimumHeight: height) {
            HStack(spacing: 10) {
                AgentActivityStatusGlyph(status: statusOverride ?? agent.status, size: glyphSize)
                text.text(.name)
                    .lineLimit(1)
                    .layoutPriority(1)
                text.text(.detail)
                    .lineLimit(1)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .frame(height: height)
        }
    }
}

/// The counts as the list header draws them: each status's glyph, then its
/// count, Blocked first.
struct AgentActivityCountTokens: View {
    let counts: AgentActivityAttributes.ContentState.Counts
    var items: [(status: String, count: Int)]? = nil

    var body: some View {
        let shown = items ?? counts.chipItems
        HStack(spacing: 10) {
            ForEach(shown, id: \.status) { item in
                HStack(spacing: 4) {
                    AgentActivityStatusGlyph(status: item.status, size: AgentActivityMetrics.tokenGlyph)
                    Text("\(item.count)")
                        .activityNumericTransition(item.count)
                }
            }
        }
        .font(.subheadline.weight(.semibold).monospacedDigit())
        .foregroundStyle(AgentActivityChrome.primary)
        .fixedSize()
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(AgentActivityNarration.countsLabel(shown))
    }
}

// MARK: - Blocked

/// The whole prompt the buttons answer, in a monospaced box: at most the
/// notification body's 120 characters, so three lines hold it; it shrinks
/// rather than cut, because Approve answers all of it.
struct AgentActivityPromptBox: View {
    let prompt: String
    var font: Font = .subheadline.monospaced().weight(.medium)

    var body: some View {
        Text(prompt)
            .font(font)
            .foregroundStyle(AgentActivityChrome.primary)
            .lineLimit(3)
            .minimumScaleFactor(0.7)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(
                AgentActivityChrome.commandFill,
                in: RoundedRectangle(cornerRadius: AgentActivityMetrics.commandRadius, style: .continuous)
            )
            .overlay(
                RoundedRectangle(cornerRadius: AgentActivityMetrics.commandRadius, style: .continuous)
                    .strokeBorder(AgentActivityChrome.commandStroke, lineWidth: 1))
    }
}

/// Deny (secondary) and Approve (primary, white). Both are links that open
/// the app, which reads the prompt from the Host again and answers through
/// the notification's gates (`AgentActivityLink.answerURL`). Labels are the
/// prompt's own option labels. `stretches` fills the width (the island).
struct AgentActivityAnswerButtons: View {
    let hostID: String
    let approval: AgentActivityApproval
    var stretches = false
    var height = AgentActivityMetrics.buttonHeight

    var body: some View {
        HStack(spacing: 8) {
            if let deny = approval.denyLabel, let url = answerURL(.deny) {
                Link(destination: url) {
                    label(deny, fill: AgentActivityChrome.secondaryButtonFill, ink: AgentActivityChrome.primary)
                }
                .accessibilityLabel("Deny: \(deny)")
            }
            if let approve = approval.approveLabel, let url = answerURL(.approve) {
                Link(destination: url) {
                    label(
                        approve, fill: AgentActivityChrome.primaryButtonFill,
                        ink: AgentActivityChrome.primaryButtonText)
                }
                .accessibilityLabel("Approve: \(approve)")
            }
        }
        .buttonStyle(.plain)
        .disabled(!approval.isEnabled)
        .opacity(approval.isEnabled ? 1 : 0.45)
    }

    private func label(_ text: String, fill: Color, ink: Color) -> some View {
        Text(text)
            .font(.subheadline.weight(.semibold))
            .lineLimit(1)
            .foregroundStyle(ink)
            .padding(.horizontal, 16)
            .frame(maxWidth: stretches ? .infinity : nil, minHeight: height, maxHeight: height)
            .background(fill, in: Capsule())
    }

    private func answerURL(_ answer: AgentActivityLink.Answer) -> URL? {
        AgentActivityLink.answerURL(
            hostID: hostID, paneID: approval.agent.paneID, episodeID: approval.ask.episodeID, answer: answer)
    }
}

enum AgentActivityNarration {
    static func rowLabel(for agent: AgentActivityDetails.AgentDetail) -> String {
        (AgentActivityAgentText(agent).plainLines + [agent.status]).joined(separator: ", ")
    }

    static func countsLabel(_ items: [(status: String, count: Int)]) -> String {
        items.map { AgentActivityCountText.text(count: $0.count, status: $0.status) }
            .joined(separator: ", ")
    }
}

/// "2 blocked" for a label: one whole phrase per status, so a translation
/// can make the status agree with the count. Unknown wire statuses read as
/// they arrive.
enum AgentActivityCountText {
    static func text(count: Int, status: String) -> String {
        switch status {
        case "blocked": String(localized: "\(count) blocked")
        case "working": String(localized: "\(count) working")
        case "done": String(localized: "\(count) done")
        case "idle": String(localized: "\(count) idle")
        default: "\(count) \(status)"
        }
    }
}
