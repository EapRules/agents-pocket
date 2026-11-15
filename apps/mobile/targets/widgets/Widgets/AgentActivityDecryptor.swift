import Foundation

/// Render-time view of one Live Activity update: decrypted Host details, or
/// the plaintext counts when the envelope cannot be opened.
enum AgentActivityPresentation: Equatable, Sendable {
    case detailed(details: AgentActivityDetails, counts: AgentActivityAttributes.ContentState.Counts)
    case countsOnly(counts: AgentActivityAttributes.ContentState.Counts)

    var counts: AgentActivityAttributes.ContentState.Counts {
        switch self {
        case .detailed(_, let counts), .countsOnly(let counts):
            return counts
        }
    }

    /// Fallback headline when a row cannot be drawn. Host identity is never
    /// rendered.
    var headerTitle: String {
        switch self {
        case .detailed:
            guard let primary = primaryAgent else { return AgentActivityCopy.genericAppName }
            return primary.displayIdentity
        case .countsOnly:
            return AgentActivityCopy.genericAppName
        }
    }

    var agents: [AgentActivityDetails.AgentDetail] {
        switch self {
        case .detailed(let details, _):
            return details.agents
        case .countsOnly:
            return []
        }
    }

    /// First Agent in envelope order (pinned eligible first, then status rank).
    var primaryAgent: AgentActivityDetails.AgentDetail? {
        agents.first
    }
}

/// Synchronous render-time helper. Failures degrade to counts-only so a
/// view body never has to throw (nil envelope, locked Keychain before
/// first unlock, unknown kid, decrypt or payload error).
enum AgentActivityDecryptor {
    static func presentation(
        for state: AgentActivityAttributes.ContentState,
        store: NotificationKeyStore = NotificationKeyStore(),
        mirror: NotificationKeyMirror = NotificationKeyMirror()
    ) -> AgentActivityPresentation {
        #if DEBUG
            lastFailureReason = nil
        #endif
        guard let envelope = state.envelope,
            let data = try? JSONEncoder().encode(envelope),
            let kid = SealedEnvelopeCodec.peekKeyID(in: data)
        else {
            breadcrumb("no envelope or unreadable kid")
            return .countsOnly(counts: state.counts)
        }

        // The Keychain is unreachable in the locked lock-screen rendering
        // context (errSecNotAvailable); the app-group mirror is maintained
        // for exactly that gap, so a kid missing from whichever Keychain
        // records did load falls through to it as well.
        let records = (try? store.allRecords()) ?? []
        guard
            let record = records.first(where: { $0.keyID == kid })
                ?? mirror.read().first(where: { $0.keyID == kid })
        else {
            breadcrumb("kid \(kid) not among \(records.map(\.keyID)) nor mirrored")
            return .countsOnly(counts: state.counts)
        }
        let opened: AgentActivityDetails
        do {
            opened = try AgentActivityEnvelope.open(data, using: record.key)
        } catch {
            breadcrumb("open failed: \(error)")
            return .countsOnly(counts: state.counts)
        }

        return .detailed(details: opened, counts: state.counts)
    }

    /// Debug-only: why the last `presentation(for:)` in this process fell
    /// back to counts-only, for on-lock-screen diagnosis of device-only
    /// failures. Rendered by the lock-screen view in Debug builds.
    #if DEBUG
        nonisolated(unsafe) static var lastFailureReason: String?
    #endif

    /// Debug-only render-time trace into the shared app-group container, so
    /// a countsOnly fallback on a physical device can name its cause
    /// (`devicectl device copy from --domain-type appGroupDataContainer`).
    private static func breadcrumb(_ reason: String) {
        #if DEBUG
            let container = FileManager.default.containerURL(
                forSecurityApplicationGroupIdentifier: NotificationKeyStore.sharedAccessGroup)
            lastFailureReason = "\(reason) | group: \(container == nil ? "nil" : "ok")"
            guard let url = container else { return }
            let line = "\(Date()) \(reason)\n"
            let file = url.appendingPathComponent("activity-decrypt-debug.txt")
            if let handle = try? FileHandle(forWritingTo: file) {
                _ = try? handle.seekToEnd()
                _ = try? handle.write(contentsOf: Data(line.utf8))
                try? handle.close()
            } else {
                try? Data(line.utf8).write(to: file)
            }
        #endif
    }
}

/// The Approve and Deny panel a Live Activity draws for one Blocked Agent
/// (spec F5, R5): its prompt and the buttons it may offer. Drawn only while
/// this device approves from outside the app for the Host
/// (`ApprovalOptInMirror`), for the first Blocked Agent in envelope order
/// that carries an `ask`.
struct AgentActivityApproval: Equatable, Sendable {
    let agent: AgentActivityDetails.AgentDetail
    let ask: ActivityApprovalAsk
    /// The one-time Yes label; nil hides Approve: the notification rules
    /// would hide it (a cut prompt, Deny only, format characters), or no
    /// label reads as a one-time Yes, which the Host would refuse.
    let approveLabel: String?
    /// The No label; nil hides Deny, which the Host would refuse.
    let denyLabel: String?
    /// False on a stale activity: its prompt may be gone.
    let isEnabled: Bool

    /// The panel for `presentation`, or nil when there is nothing to answer here.
    static func make(
        presentation: AgentActivityPresentation, hostID: String,
        isStale: Bool, isOptedIn: (UUID) -> Bool = { ApprovalOptInMirror().isEnabled(for: $0) }
    ) -> AgentActivityApproval? {
        guard case .detailed(let details, _) = presentation, let host = UUID(uuidString: hostID),
            let agent = details.agents.first(where: { $0.status == "blocked" && $0.ask != nil }),
            let ask = agent.ask, isOptedIn(host)
        else { return nil }
        let approveLabel = ask.offersApprove ? label(in: ask.options, role: .approve) : nil
        let denyLabel = label(in: ask.options, role: .decline)
        guard approveLabel != nil || denyLabel != nil || ask.result != nil else { return nil }
        return AgentActivityApproval(
            agent: agent, ask: ask, approveLabel: approveLabel, denyLabel: denyLabel, isEnabled: !isStale)
    }

    /// Whether the buttons show: not while an action runs or after one
    /// that settled the prompt.
    var showsButtons: Bool {
        !(ask.result?.hidesButtons ?? false) && (approveLabel != nil || denyLabel != nil)
    }

    enum Role { case approve, decline }

    /// How the Host's apply reads a label (`answerRole` in
    /// plugin/src/approval-preview.js): a plain No declines; a Yes that does
    /// not switch the permission mode or keep allowing approves once.
    static func role(of label: String) -> Role? {
        let folded = label.replacingOccurrences(of: "\u{2019}", with: "'").lowercased()
        if startsAnswer(folded, with: "no") { return .decline }
        if startsAnswer(folded, with: "yes"), !lastingPhrases.contains(where: folded.contains) { return .approve }
        return nil
    }

    private static func label(in options: [String], role: Role) -> String? {
        options.first { Self.role(of: $0) == role }
    }

    /// `word` alone, or followed by a space or a comma.
    private static func startsAnswer(_ text: String, with word: String) -> Bool {
        guard text.hasPrefix(word) else { return false }
        let rest = text.dropFirst(word.count)
        return rest.isEmpty || rest.hasPrefix(" ") || rest.hasPrefix(",")
    }

    private static let lastingPhrases = [
        "switch to auto mode", "switch to accept edits", "use auto mode", "auto-accept edits", "bypass",
        "don't ask again", "always allow", "for this session", "during this session", "from this project",
        "allow this host", "keep allowing", "in the future",
    ]
}

enum AgentActivityCopy {
    static let genericAppName = "Agents Pocket"
    /// List rows on the Lock Screen and in the expanded island.
    static let rowLimit = 3
}

extension AgentActivityAttributes.ContentState.Counts {
    /// Full eligible inventory carried in plaintext.
    var total: Int { working + blocked + done }

    /// Non-zero chips in contract urgency order (blocked, working, done).
    var chipItems: [(status: String, count: Int)] {
        var items: [(String, Int)] = []
        if blocked > 0 { items.append(("blocked", blocked)) }
        if working > 0 { items.append(("working", working)) }
        if done > 0 { items.append(("done", done)) }
        return items
    }

    /// Non-zero counts in attention order: blocked, done, working. The
    /// Dynamic Island leads with the first and trails with the rest.
    var attentionItems: [(status: String, count: Int)] {
        var items: [(String, Int)] = []
        if blocked > 0 { items.append(("blocked", blocked)) }
        if done > 0 { items.append(("done", done)) }
        if working > 0 { items.append(("working", working)) }
        return items
    }
}
