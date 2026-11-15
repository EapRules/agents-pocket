import Foundation

/// Which of the drawn states one update shows. The Lock Screen card and the
/// expanded island both pick their layout here, so a state means the same on
/// every presentation. Later stages (timers, offline since when, a summary
/// duration) add data to these states, not new branches in the views.
enum AgentActivityScene: Equatable, Sendable {
    /// A Blocked Agent this device answers from here: its prompt and buttons.
    case approval(AgentActivityApproval)
    /// The activity went stale: what it last knew, dimmed.
    case stale
    /// Every Agent finished.
    case allDone
    /// Exactly one Agent: the richer single card.
    case single(AgentActivityDetails.AgentDetail)
    /// Several Agents, or counts without details: a header with the counts
    /// and at most three rows, Blocked first.
    case list

    static func make(
        presentation: AgentActivityPresentation, approval: AgentActivityApproval?, isStale: Bool
    ) -> AgentActivityScene {
        let counts = presentation.counts
        if let approval { return .approval(approval) }
        if isStale { return .stale }
        if counts.blocked == 0, counts.working == 0, counts.done > 0 { return .allDone }
        if counts.total == 1, let only = presentation.primaryAgent { return .single(only) }
        return .list
    }

    /// The status the state is about: what tints the island and leads it.
    func leadStatus(counts: AgentActivityAttributes.ContentState.Counts) -> String {
        switch self {
        case .approval: "blocked"
        case .stale: "unknown"
        case .allDone: "done"
        case .single(let agent): agent.status
        case .list: counts.attentionItems.first?.status ?? "unknown"
        }
    }
}

extension AgentActivityPresentation {
    /// The list rows: Blocked first, then the sender's pin-aware order, at
    /// most `AgentActivityCopy.rowLimit` (three fit both the Lock Screen's and
    /// the expanded island's height with the overflow caption).
    var listAgents: [AgentActivityDetails.AgentDetail] {
        let blocked = agents.filter { $0.status == "blocked" }
        let rest = agents.filter { $0.status != "blocked" }
        return Array((blocked + rest).prefix(AgentActivityCopy.rowLimit))
    }

    /// Agents beyond the drawn rows, from the full inventory in `counts`
    /// (the envelope list is capped at 5). Zero in counts-only: there is
    /// nothing to overflow from.
    var listOverflowCount: Int {
        let shown = listAgents.count
        guard shown > 0 else { return 0 }
        return max(0, counts.total - shown)
    }

    /// Everyone but the asking Agent, for the Blocked card's "+N more".
    var othersThanOneCount: Int {
        max(0, counts.total - 1)
    }
}
