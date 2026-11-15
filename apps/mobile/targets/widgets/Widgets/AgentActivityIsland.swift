import ActivityKit
import SwiftUI
import UIKit
import WidgetKit

// MARK: - Dynamic Island

/// The island leads with the state's most urgent status. Compact and minimal
/// show the mark tinted by that status with its glyph as a corner badge (the
/// state reads without color); expanded spells the state out with the mark
/// small in the corner. The keyline takes the same status.
enum AgentActivityIsland {
    static func make(
        presentation: AgentActivityPresentation, hostID: String, approval: AgentActivityApproval? = nil
    ) -> DynamicIsland {
        // The island has no stale layout: a stale activity keeps its last
        // state here, and a stale prompt's buttons are disabled.
        let scene = AgentActivityScene.make(presentation: presentation, approval: approval, isStale: false)
        let lead = scene.leadStatus(counts: presentation.counts)
        return DynamicIsland {
            DynamicIslandExpandedRegion(.leading) {
                AgentActivityIslandLeading(scene: scene, counts: presentation.counts)
            }
            DynamicIslandExpandedRegion(.trailing) {
                AgentActivityIslandTrailing(scene: scene, presentation: presentation)
            }
            DynamicIslandExpandedRegion(.bottom) {
                AgentActivityIslandBottom(scene: scene, presentation: presentation, hostID: hostID)
            }
        } compactLeading: {
            AgentActivityCompact(slot: .leading, status: lead, counts: presentation.counts)
        } compactTrailing: {
            AgentActivityCompact(slot: .trailing, status: lead, counts: presentation.counts)
        } minimal: {
            AgentActivityMinimal(status: lead, counts: presentation.counts)
        }
        .contentMargins(
            [.leading, .trailing], AgentActivityIslandMetrics.expandedSideMargin, for: .expanded)
        .keylineTint(AgentActivityChrome.keyline(for: lead))
        .widgetURL(AgentActivityLink.consoleURL(hostID: hostID))
    }
}

enum AgentActivityIslandMetrics {
    /// Shared by the expanded leading and trailing regions so their contents
    /// sit on one center line beside the camera.
    static let headerHeight: CGFloat = 24
    /// The system clips expanded content to the island's shape inset about
    /// 15 pt, whose 27 pt corners cut into the default 18 pt side margins: the
    /// header glyph lost its top-left edge and the last trailing digit its
    /// right half. Measured on an iPhone 17 Pro simulator (iOS 27).
    static let expandedSideMargin: CGFloat = 25
}

/// One compact side. Where the island is limited in width (iOS 27:
/// landscape, and beside another app's activity) compact falls back to the
/// minimal content: the state mark alone in leading, nothing in trailing
/// (HIG: a 28 pt circle).
struct AgentActivityCompact: View {
    enum Slot { case leading, trailing }

    let slot: Slot
    let status: String
    let counts: AgentActivityAttributes.ContentState.Counts

    var body: some View {
        if #available(iOS 27.0, *) {
            AgentActivityCompactLimitedWidthReader(compact: self)
        } else {
            content(isLimitedInWidth: false)
        }
    }

    @ViewBuilder
    func content(isLimitedInWidth: Bool) -> some View {
        switch (slot, isLimitedInWidth) {
        case (.leading, false):
            AgentActivityCompactLeading(status: status, counts: counts)
        case (.leading, true):
            AgentActivityStateMark(status: status, size: AgentActivityMetrics.limitedWidthMark)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(AgentActivityNarration.countsLabel(counts.attentionItems))
        case (.trailing, false):
            AgentActivityCompactTrailing(status: status, counts: counts)
        case (.trailing, true):
            EmptyView()
        }
    }
}

@available(iOS 27.0, *)
private struct AgentActivityCompactLimitedWidthReader: View {
    let compact: AgentActivityCompact
    @Environment(\.isDynamicIslandLimitedInWidth) private var isLimitedInWidth

    var body: some View {
        compact.content(isLimitedInWidth: isLimitedInWidth)
    }
}

extension AgentActivityAttributes.ContentState.Counts {
    /// The count the island shows beside a status: that status's own count,
    /// or every Agent for a status the counts do not carry.
    func count(for status: String) -> Int {
        switch status {
        case "blocked": blocked
        case "working": working
        case "done": done
        default: total
        }
    }
}

struct AgentActivityCompactLeading: View {
    let status: String
    let counts: AgentActivityAttributes.ContentState.Counts

    var body: some View {
        AgentActivityStateMark(status: status, size: AgentActivityMetrics.compactMark)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(AgentActivityNarration.countsLabel(counts.attentionItems))
    }
}

/// The leading status's count, so leading and trailing read as one token.
/// A later stage shows a single working Agent's timer here instead.
struct AgentActivityCompactTrailing: View {
    let status: String
    let counts: AgentActivityAttributes.ContentState.Counts

    var body: some View {
        let count = counts.count(for: status)
        Text("\(count)")
            .font(.headline.weight(.bold).monospacedDigit())
            .foregroundStyle(AgentActivityStatusStyle.ink(for: status))
            .activityNumericTransition(count)
            // The leading side already speaks the counts.
            .accessibilityHidden(true)
    }
}

struct AgentActivityMinimal: View {
    let status: String
    let counts: AgentActivityAttributes.ContentState.Counts

    var body: some View {
        AgentActivityStateMark(status: status, size: AgentActivityMetrics.minimalMark)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(AgentActivityNarration.countsLabel(counts.attentionItems))
    }
}

// MARK: - Expanded

/// The state word: the Agent's name, "All done", or "2 blocked".
struct AgentActivityIslandLeading: View {
    let scene: AgentActivityScene
    let counts: AgentActivityAttributes.ContentState.Counts

    var body: some View {
        HStack(spacing: 8) {
            AgentActivityStatusGlyph(
                status: scene.leadStatus(counts: counts), size: AgentActivityMetrics.titleGlyph)
            title
                .font(.headline)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
        .frame(maxWidth: .infinity, minHeight: AgentActivityIslandMetrics.headerHeight, alignment: .leading)
        .accessibilityElement(children: .combine)
        .activityTypeSize()
    }

    @ViewBuilder
    private var title: some View {
        switch scene {
        case .approval(let approval):
            Text(AgentActivityAgentText(approval.agent).plainName)
        case .single(let agent):
            Text(AgentActivityAgentText(agent).plainName)
        case .allDone:
            Text("All done")
        case .stale, .list:
            if let top = counts.attentionItems.first {
                Text(AgentActivityCountText.text(count: top.count, status: top.status))
                    .activityNumericTransition(top.count)
            }
        }
    }
}

/// The rest of the state, then the mark small in the corner. A later stage
/// puts a single Agent's timer or the summary duration before the mark.
struct AgentActivityIslandTrailing: View {
    let scene: AgentActivityScene
    let presentation: AgentActivityPresentation

    var body: some View {
        HStack(spacing: 8) {
            switch scene {
            case .approval:
                if presentation.othersThanOneCount > 0 {
                    Text("+\(presentation.othersThanOneCount) more")
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(AgentActivityChrome.secondary)
                        .lineLimit(1)
                }
            case .stale, .list:
                let rest = Array(presentation.counts.attentionItems.dropFirst())
                if !rest.isEmpty {
                    AgentActivityCountTokens(counts: presentation.counts, items: rest)
                }
            case .single, .allDone:
                EmptyView()
            }
            AgentActivityCornerMark()
        }
        .frame(maxWidth: .infinity, minHeight: AgentActivityIslandMetrics.headerHeight, alignment: .trailing)
        .activityTypeSize()
    }
}

/// Below the camera: the Blocked prompt with its two buttons, the one
/// Agent's lines, the finished Agents, or up to three rows.
struct AgentActivityIslandBottom: View {
    let scene: AgentActivityScene
    let presentation: AgentActivityPresentation
    let hostID: String

    var body: some View {
        Group {
            switch scene {
            case .approval(let approval):
                VStack(alignment: .leading, spacing: 8) {
                    AgentActivityPromptBox(
                        prompt: approval.ask.displayPrompt, font: .footnote.monospaced().weight(.medium))
                    if approval.showsButtons {
                        AgentActivityAnswerButtons(
                            hostID: hostID, approval: approval, stretches: true,
                            height: AgentActivityMetrics.islandButtonHeight)
                    }
                    if let result = approval.ask.result?.message {
                        Text(result)
                            .font(.footnote.weight(.medium))
                            .foregroundStyle(AgentActivityChrome.secondary)
                            .lineLimit(1)
                    }
                }
            case .single(let agent):
                let text = AgentActivityAgentText(agent)
                AgentActivityAgentLink(hostID: hostID, agent: agent) {
                    VStack(alignment: .leading, spacing: 3) {
                        text.text(.detail)?.lineLimit(1)
                        text.text(.task)?.lineLimit(1)
                    }
                }
            case .allDone:
                // A later stage gives each Agent its time here.
                Text(presentation.agents.map { AgentActivityAgentText($0).plainName }.joined(separator: " · "))
                    .font(.footnote.monospaced())
                    .foregroundStyle(AgentActivityChrome.secondary)
                    .lineLimit(1)
                    .frame(maxWidth: .infinity, alignment: .leading)
            case .stale, .list:
                rows
            }
        }
        .padding(.top, 4)
        .activityTypeSize()
    }

    private var rows: some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(presentation.listAgents, id: \.paneID) { @Sendable [hostID] agent in
                AgentActivityListRow(
                    hostID: hostID, agent: agent, glyphSize: AgentActivityMetrics.islandRowGlyph,
                    height: AgentActivityMetrics.islandRowHeight)
            }
            if presentation.listOverflowCount > 0 {
                Text("+\(presentation.listOverflowCount) more")
                    .font(.footnote.weight(.medium))
                    .foregroundStyle(AgentActivityChrome.secondary)
            }
        }
    }
}
