import ActivityKit
import SwiftUI
import UIKit
import WidgetKit

// MARK: - Previews

/// Style gallery: every drawn state (one working, several, Blocked, all
/// done, stale) on the Lock Screen and in the compact, minimal and expanded
/// island, without a device, a push, or a live Agent. Open this file's
/// canvas in Xcode.
#if DEBUG
    private let previewHostID = "6D8EC348-4DAF-455C-BA8F-5FCC41799C0E"

    private func agent(
        _ status: String, kind: String, name: String? = nil, workspace: String? = nil,
        pane: String, title: String? = nil, ask: ActivityApprovalAsk? = nil
    ) -> AgentActivityDetails.AgentDetail {
        AgentActivityDetails.AgentDetail(
            paneID: pane, kind: kind, name: name, workspace: workspace, status: status, title: title,
            ask: ask)
    }

    private enum PreviewFixtures {
        static let ask = ActivityApprovalAsk(
            episodeID: "preview-episode", prompt: "Bash wants to run: pnpm test settings",
            options: ["Yes", "No"], timestamp: 1_763_200_000)

        /// Near the notification body's 120-character cut: the prompt box's worst case.
        static let longAsk = ActivityApprovalAsk(
            episodeID: "preview-long", prompt: "Bash wants to run: pnpm --filter @openagentspocket/core test -- --run src/live-activity/coordinator.test.ts",
            options: ["Yes", "No, and tell Claude what to do differently"], timestamp: 1_763_200_000)

        static let codex = agent(
            "working", kind: "codex", name: "codex", workspace: "storefront", pane: "w1:p1",
            title: "Running pnpm test settings")
        static let claude = agent(
            "working", kind: "claude", name: "claude", workspace: "api", pane: "w1:p2",
            title: "Editing schema.prisma")
        static let opencode = agent(
            "working", kind: "opencode", name: "opencode", workspace: "docs", pane: "w1:p3",
            title: "Writing CHANGELOG.md")

        static func with(_ base: AgentActivityDetails.AgentDetail, status: String, ask: ActivityApprovalAsk? = nil)
            -> AgentActivityDetails.AgentDetail
        {
            var copy = base
            copy.status = status
            copy.ask = ask
            return copy
        }

        static func detailed(
            _ agents: [AgentActivityDetails.AgentDetail], working: Int, blocked: Int, done: Int
        ) -> AgentActivityPresentation {
            .detailed(
                details: .init(hostName: "demo", agents: agents),
                counts: .init(working: working, blocked: blocked, done: done))
        }

        static let oneWorking = detailed([codex], working: 1, blocked: 0, done: 0)
        static let several = detailed(
            [with(codex, status: "blocked"), claude, opencode], working: 2, blocked: 1, done: 0)
        static let blocked = detailed(
            [with(codex, status: "blocked", ask: ask), claude, opencode], working: 2, blocked: 1, done: 0)
        static let blockedLongPrompt = detailed(
            [with(codex, status: "blocked", ask: longAsk), claude, opencode], working: 2, blocked: 1, done: 0)
        static let allDone = detailed(
            [with(codex, status: "done"), with(claude, status: "done"), with(opencode, status: "done")],
            working: 0, blocked: 0, done: 3)
        static let oneBlockedNoPrompt = detailed([with(codex, status: "blocked")], working: 0, blocked: 1, done: 0)
        static let unnamed = detailed(
            [agent("working", kind: "claude", pane: "w1:p1")], working: 1, blocked: 0, done: 0)
        static let overflow = detailed(
            [
                claude, with(opencode, status: "done"), with(codex, status: "blocked"),
                agent("working", kind: "grok", pane: "w1:p4", title: "Research ActivityKit budgets"),
                agent("working", kind: "droid", workspace: "web", pane: "w1:p5"),
            ], working: 4, blocked: 1, done: 1)
        static let longNames = detailed(
            [
                agent(
                    "blocked", kind: "claude", name: String(repeating: "屏", count: 80),
                    workspace: String(repeating: "锁", count: 80), pane: "w1:p1"),
                claude,
            ], working: 1, blocked: 1, done: 0)
        static let configuredFields = detailed(
            (1...3).map { index in
                AgentActivityDetails.AgentDetail(
                    paneID: "w1:p\(index)", kind: "claude", workspace: "Agentico",
                    status: index == 1 ? "blocked" : "working", title: nil,
                    rows: [
                        [.init(text: "Agentico"), .init(text: " · "), .init(text: "Claude", dim: true)],
                        [.init(text: "~/Projects/Agentico", fg: "#8ab4ff")],
                        [.init(text: "Review sidebar fields")],
                    ])
            }, working: 2, blocked: 1, done: 0)
        static let countsOnly = AgentActivityPresentation.countsOnly(
            counts: .init(working: 2, blocked: 1, done: 0))

        static func approval(_ presentation: AgentActivityPresentation, isStale: Bool = false)
            -> AgentActivityApproval?
        {
            AgentActivityApproval.make(
                presentation: presentation, hostID: previewHostID, isStale: isStale, isOptedIn: { _ in true })
        }
    }

    /// A busy wallpaper behind the card, like the mockup's legibility test.
    private var previewWallpaper: some View {
        LinearGradient(
            colors: [.pink, .orange, .yellow, .green, .blue, .purple], startPoint: .topLeading,
            endPoint: .bottomTrailing)
    }

    private func lockScreen(
        _ presentation: AgentActivityPresentation, isStale: Bool = false, approves: Bool = false
    ) -> some View {
        AgentActivityLockScreenView(
            presentation: presentation, hostID: previewHostID, isStale: isStale,
            approval: approves ? PreviewFixtures.approval(presentation, isStale: isStale) : nil)
            .frame(width: 371)
            .frame(minHeight: 84)
            .fixedSize(horizontal: false, vertical: true)
            .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
            .padding()
            .background(previewWallpaper)
    }

    private func islandParts(_ presentation: AgentActivityPresentation, approves: Bool)
        -> (scene: AgentActivityScene, lead: String)
    {
        let scene = AgentActivityScene.make(
            presentation: presentation, approval: approves ? PreviewFixtures.approval(presentation) : nil,
            isStale: false)
        return (scene, scene.leadStatus(counts: presentation.counts))
    }

    private func compact(_ presentation: AgentActivityPresentation, approves: Bool = false) -> some View {
        let lead = islandParts(presentation, approves: approves).lead
        return HStack(spacing: 0) {
            AgentActivityCompact(slot: .leading, status: lead, counts: presentation.counts)
                .frame(width: 52.33)
            // Stands in for the camera housing between the two sides.
            Color.clear.frame(width: 126)
            AgentActivityCompact(slot: .trailing, status: lead, counts: presentation.counts)
                .frame(width: 52.33)
        }
        .frame(height: 36.67)
        .background(Color.black, in: Capsule())
        .overlay(Capsule().stroke(AgentActivityChrome.keyline(for: lead), lineWidth: 1))
        .padding()
    }

    private func minimal(_ presentation: AgentActivityPresentation, approves: Bool = false) -> some View {
        let lead = islandParts(presentation, approves: approves).lead
        return AgentActivityMinimal(status: lead, counts: presentation.counts)
            .frame(width: 36.67, height: 36.67)
            .background(Color.black, in: Circle())
            .overlay(Circle().stroke(AgentActivityChrome.keyline(for: lead), lineWidth: 1))
            .padding()
    }

    private func expanded(_ presentation: AgentActivityPresentation, approves: Bool = false) -> some View {
        let (scene, lead) = islandParts(presentation, approves: approves)
        return VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 0) {
                AgentActivityIslandLeading(scene: scene, counts: presentation.counts)
                AgentActivityIslandTrailing(scene: scene, presentation: presentation)
            }
            AgentActivityIslandBottom(scene: scene, presentation: presentation, hostID: previewHostID)
        }
        .padding(.horizontal, AgentActivityIslandMetrics.expandedSideMargin)
        .padding(.top, 13)
        .padding(.bottom, 18)
        .frame(width: 371)
        .foregroundStyle(AgentActivityChrome.primary)
        .background(Color.black, in: RoundedRectangle(cornerRadius: 44, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 44, style: .continuous)
                .stroke(AgentActivityChrome.keyline(for: lead), lineWidth: 1))
        .environment(\.colorScheme, .dark)
        .padding()
    }

    // MARK: Lock Screen, one per drawn state

    #Preview("Lock · One working") { lockScreen(PreviewFixtures.oneWorking) }
    #Preview("Lock · Several") { lockScreen(PreviewFixtures.several) }
    #Preview("Lock · Blocked") { lockScreen(PreviewFixtures.blocked, approves: true) }
    #Preview("Lock · Blocked, stale") { lockScreen(PreviewFixtures.blocked, isStale: true, approves: true) }
    #Preview("Lock · All done") { lockScreen(PreviewFixtures.allDone) }
    #Preview("Lock · Stale") { lockScreen(PreviewFixtures.several, isStale: true) }

    // MARK: Lock Screen, edge cases

    #Preview("Lock · Blocked, long prompt") { lockScreen(PreviewFixtures.blockedLongPrompt, approves: true) }
    #Preview("Lock · One blocked, no prompt") { lockScreen(PreviewFixtures.oneBlockedNoPrompt) }
    #Preview("Lock · Unnamed Agent") { lockScreen(PreviewFixtures.unnamed) }
    #Preview("Lock · Overflow") { lockScreen(PreviewFixtures.overflow) }
    #Preview("Lock · Long names") { lockScreen(PreviewFixtures.longNames) }
    #Preview("Lock · Configured fields") { lockScreen(PreviewFixtures.configuredFields) }
    #Preview("Lock · Counts only") { lockScreen(PreviewFixtures.countsOnly) }

    // MARK: Compact

    #Preview("Compact · Working") { compact(PreviewFixtures.oneWorking) }
    #Preview("Compact · Several") { compact(PreviewFixtures.several) }
    #Preview("Compact · Blocked") { compact(PreviewFixtures.blocked, approves: true) }
    #Preview("Compact · All done") { compact(PreviewFixtures.allDone) }

    // MARK: Minimal

    #Preview("Minimal · Working") { minimal(PreviewFixtures.oneWorking) }
    #Preview("Minimal · Several") { minimal(PreviewFixtures.several) }
    #Preview("Minimal · Blocked") { minimal(PreviewFixtures.blocked, approves: true) }
    #Preview("Minimal · All done") { minimal(PreviewFixtures.allDone) }

    // MARK: Expanded

    #Preview("Expanded · Working") { expanded(PreviewFixtures.oneWorking) }
    #Preview("Expanded · Several") { expanded(PreviewFixtures.several) }
    #Preview("Expanded · Blocked") { expanded(PreviewFixtures.blocked, approves: true) }
    #Preview("Expanded · Blocked, long prompt") { expanded(PreviewFixtures.blockedLongPrompt, approves: true) }
    #Preview("Expanded · All done") { expanded(PreviewFixtures.allDone) }
    #Preview("Expanded · Overflow") { expanded(PreviewFixtures.overflow) }
#endif
