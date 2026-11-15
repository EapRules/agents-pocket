import ActivityKit
import SwiftUI
import UIKit
import WidgetKit

/// Live Activity for one Host, drawn as the approved direction A ("Sobrio"):
/// a near-black card, color only in the status glyphs, names semibold and
/// workspaces monospaced. One Agent gets a single card, several a header with
/// the counts and at most three rows (Blocked first), a Blocked Agent this
/// device answers its prompt and buttons. Agent rows deep-link to their
/// detail while the surrounding chrome opens the Console.
struct AgentLiveActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: AgentActivityAttributes.self) { context in
            let presentation = AgentActivityDecryptor.presentation(for: context.state)
            AgentActivityLockScreenContainer(
                presentation: presentation,
                hostID: context.attributes.hostID,
                isStale: context.isStale,
                approval: AgentActivityApproval.make(
                    presentation: presentation, hostID: context.attributes.hostID,
                    isStale: context.isStale)
            )
        } dynamicIsland: { context in
            let presentation = AgentActivityDecryptor.presentation(for: context.state)
            return AgentActivityIsland.make(
                presentation: presentation,
                hostID: context.attributes.hostID,
                approval: AgentActivityApproval.make(
                    presentation: presentation, hostID: context.attributes.hostID,
                    isStale: context.isStale))
        }
    }
}

// MARK: - Lock screen

private struct AgentActivityLockScreenContainer: View {
    let presentation: AgentActivityPresentation
    let hostID: String
    let isStale: Bool
    let approval: AgentActivityApproval?

    var body: some View {
        AgentActivityLockScreenView(
            presentation: presentation,
            hostID: hostID,
            isStale: isStale,
            approval: approval
        )
        // Not the system background: the card is near-black on every
        // wallpaper and in both appearances, so the dismiss button the
        // system draws takes the card's white.
        .activityBackgroundTint(AgentActivityChrome.tint)
        .activitySystemActionForegroundColor(AgentActivityChrome.primary)
    }
}

struct AgentActivityLockScreenView: View {
    let presentation: AgentActivityPresentation
    let hostID: String
    let isStale: Bool
    /// The Blocked Agent to answer from here (spec F5, R5); the card then
    /// shows that Agent with its prompt and buttons instead of the list.
    var approval: AgentActivityApproval? = nil

    var body: some View {
        ZStack {
            AgentActivityChrome.tint.ignoresSafeArea()
            content
                .padding(.horizontal, AgentActivityMetrics.lockScreenHorizontalPadding)
                .padding(.vertical, AgentActivityMetrics.lockScreenVerticalPadding)
        }
        .foregroundStyle(AgentActivityChrome.primary)
        .activityTypeSize()
        .widgetURL(AgentActivityLink.consoleURL(hostID: hostID))
    }

    @ViewBuilder
    private var content: some View {
        switch AgentActivityScene.make(presentation: presentation, approval: approval, isStale: isStale) {
        case .approval(let approval):
            AgentActivityBlockedCard(
                presentation: presentation, hostID: hostID, isStale: isStale, approval: approval)
        case .stale:
            staleCard
        case .allDone:
            doneCard
        case .single(let agent):
            AgentActivitySingleCard(hostID: hostID, agent: agent)
        case .list:
            listCard
        }
    }

    // MARK: Several Agents

    private var listCard: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 8) {
                // The Host's own name is never rendered on this public surface.
                Text(AgentActivityCopy.genericAppName)
                    .font(.subheadline.weight(.semibold))
                    .lineLimit(1)
                Spacer(minLength: 8)
                AgentActivityCountTokens(counts: presentation.counts)
                AgentActivityCornerMark()
            }
            let rows = presentation.listAgents
            if !rows.isEmpty {
                AgentActivityChrome.hairline.frame(height: 1).padding(.vertical, 7)
            }
            ForEach(rows, id: \.paneID) { @Sendable [hostID] agent in
                AgentActivityListRow(hostID: hostID, agent: agent)
            }
            if presentation.listOverflowCount > 0 {
                Text("+\(presentation.listOverflowCount) more")
                    .font(.footnote.weight(.medium))
                    .foregroundStyle(AgentActivityChrome.secondary)
            }
            #if DEBUG
                if let reason = AgentActivityDecryptor.lastFailureReason {
                    Text(reason)
                        .font(.caption2)
                        .foregroundStyle(AgentActivityChrome.secondary)
                        .lineLimit(3)
                }
            #endif
        }
    }

    // MARK: All done

    private var doneCard: some View {
        HStack(alignment: .top, spacing: 12) {
            AgentActivityStatusGlyph(status: "done", size: AgentActivityMetrics.heroGlyph)
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 8) {
                    Text("All done").font(.headline).lineLimit(1)
                    Spacer(minLength: 8)
                    // A later stage puts the time it finished here.
                    AgentActivityCornerMark()
                }
                // A later stage adds the total duration to this line.
                Text("\(presentation.counts.done) agents")
                    .activityNumericTransition(presentation.counts.done)
                let names = presentation.agents.map { AgentActivityAgentText($0).plainName }
                if !names.isEmpty {
                    Text(names.joined(separator: " · ")).lineLimit(1)
                }
            }
            .font(.subheadline.weight(.medium))
            .foregroundStyle(AgentActivityChrome.secondary)
        }
        .accessibilityElement(children: .combine)
    }

    // MARK: Stale

    /// What the activity last knew, dimmed. A later stage says since when
    /// and whether the Host is offline; today only staleness is known.
    private var staleCard: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .top, spacing: 12) {
                AgentActivityStatusGlyph(status: "unknown", size: AgentActivityMetrics.heroGlyph)
                VStack(alignment: .leading, spacing: 3) {
                    HStack(spacing: 8) {
                        Text("May be out of date").font(.headline).lineLimit(1)
                        Spacer(minLength: 8)
                        AgentActivityCornerMark()
                    }
                    Text(AgentActivityNarration.countsLabel(presentation.counts.chipItems))
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(AgentActivityChrome.secondary)
                        .lineLimit(1)
                }
            }
            ForEach(presentation.listAgents.prefix(2), id: \.paneID) { @Sendable [hostID] agent in
                AgentActivityListRow(hostID: hostID, agent: agent, statusOverride: "unknown")
            }
            .opacity(0.45)
        }
    }
}

// MARK: - One Agent

/// The richer single card: the status glyph, the name with its program, the
/// workspace and the task. A later stage puts the Agent's timer at the top
/// right, before the mark.
struct AgentActivitySingleCard: View {
    let hostID: String
    let agent: AgentActivityDetails.AgentDetail

    var body: some View {
        let text = AgentActivityAgentText(agent)
        AgentActivityAgentLink(hostID: hostID, agent: agent) {
            HStack(alignment: .top, spacing: 12) {
                AgentActivityStatusGlyph(status: agent.status, size: AgentActivityMetrics.heroGlyph)
                VStack(alignment: .leading, spacing: 3) {
                    HStack(spacing: 8) {
                        AgentActivityAgentTitle(agent: agent, text: text)
                        Spacer(minLength: 8)
                        AgentActivityCornerMark()
                    }
                    text.text(.detail)?.lineLimit(1)
                    text.text(.task)?.lineLimit(1)
                }
            }
        }
    }
}

/// "codex · Codex", or "codex needs you" while it is Blocked.
struct AgentActivityAgentTitle: View {
    let agent: AgentActivityDetails.AgentDetail
    let text: AgentActivityAgentText
    var font: Font = .headline

    var body: some View {
        if agent.status == "blocked" {
            Text("\(text.plainName) needs you").font(font).lineLimit(1)
        } else {
            HStack(alignment: .firstTextBaseline, spacing: 0) {
                Text(text.plainName).font(font).lineLimit(1).layoutPriority(1)
                if let program = text.program {
                    Text(verbatim: " · \(program)")
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(AgentActivityChrome.secondary)
                        .lineLimit(1)
                }
            }
        }
    }
}

// MARK: - Blocked

/// The dominant state: "<agent> needs you", the prompt in a monospaced box,
/// Deny secondary and Approve primary in white, "+N more" for the rest.
struct AgentActivityBlockedCard: View {
    let presentation: AgentActivityPresentation
    let hostID: String
    let isStale: Bool
    let approval: AgentActivityApproval

    var body: some View {
        let text = AgentActivityAgentText(approval.agent)
        VStack(alignment: .leading, spacing: 8) {
            AgentActivityAgentLink(hostID: hostID, agent: approval.agent) {
                HStack(spacing: 10) {
                    AgentActivityStatusGlyph(status: "blocked", size: AgentActivityMetrics.titleGlyph)
                    Text("\(text.plainName) needs you")
                        .font(.callout.weight(.semibold))
                        .lineLimit(1)
                        .layoutPriority(1)
                    Spacer(minLength: 8)
                    text.text(.detail)?.lineLimit(1)
                    AgentActivityCornerMark()
                }
            }
            AgentActivityPromptBox(prompt: approval.ask.displayPrompt)
            HStack(spacing: 8) {
                if let caption {
                    Text(caption)
                        .font(.footnote.weight(.medium))
                        .foregroundStyle(AgentActivityChrome.secondary)
                        .lineLimit(2)
                }
                Spacer(minLength: 0)
                if approval.showsButtons {
                    AgentActivityAnswerButtons(hostID: hostID, approval: approval)
                }
            }
        }
    }

    /// What the last tap came to, the rest of the inventory, staleness.
    private var caption: String? {
        let others = presentation.othersThanOneCount
        let parts = [
            approval.ask.result?.message,
            others > 0 ? String(localized: "+\(others) more") : nil,
            isStale ? String(localized: "May be out of date") : nil,
        ].compactMap(\.self)
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }
}
