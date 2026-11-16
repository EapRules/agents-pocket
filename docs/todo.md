# To do

The working list. One line per item; tick it in the commit that closes it, and move what is done to
[roadmap.md](roadmap.md) when a group empties. "Done when" is the check that closes the item.
Items are worked from the top of each group; groups are in priority order.

## 1. In flight

- [ ] **1.0.2 (build 8) on the owner's iPhone, from TestFlight** (uploaded 2026-11-16, tag `ios-1.0.2-8`).
  It carries the Duo two panes, the terminal's native fix, the one input bar, the Model and Effort sheet.
  None of it has run on a real iPhone. Done when: he has tried the terminal (typing, paste, Keys/Compose,
  back to Chat), the Model and Effort sheet on a real Claude Agent, Chat, an approval, the Live Activity and
  the widgets, and says which build (7 or 8) goes to review in the 1.0.2 draft.
- [x] **iPhone Duo, stage 1 (closed, open, open-and-rotated).** Done and verified on the iPhone Duo
  simulator overnight 2026-11-16 (pushed, CI green). `SplitView` (`packages/ui`): wider windows show
  Home's list beside the selected Agent (the Agent lives in the route; ADR 0029); opening or closing the
  device no longer remounts the screen; the open Agent is marked in the list; Chat and Terminal side by
  side when the Agent's pane is wide. The terminal's iOS surface survives window changes (patch to
  `expo-libghostty`, fixed a blank terminal and a crash on rotate). One input bar on the terminal (Keys
  toolbar or Compose). Rotation: a portrait-only app already follows the opened device on the inner
  display, so no native change (the orientation package was tried and reverted). Duo store screenshots for
  the owner in `~/Downloads/agents-pocket-app-store/duo-{en,es}` (inner two-pane + outer screens); the Duo
  slot is optional until April 2027. **Left:** stage 2 (half-open) needs a native fold module; an
  "Agent open" inner-display store shot (the inner-display tap needs the owner or more fiddling).
- [x] **Model and Effort selector, per conversation, every program.** Done and pushed 2026-11-16. A generic
  `settings` capability on `ProgramDefinition` (`packages/core`): reads the current model, effort and fast
  mode per program; writes only verified argument-taking slash commands (Claude `/effort`, `/fast`; Hermes
  `/reasoning`), never a picker, never while blocked, with a two-step confirm that shows the exact command
  and the "applies after this turn / becomes the default / uses credits" notes before sending. Model is
  shown and "Change in Terminal" (its picker). Sheet in the Composer's "…" menu on Chat and terminal.
  **Not verified on a real iPhone.**
- [x] **Store panels into App Store Connect.** The owner pulled 1.0.2 from review and uploaded, per language,
  the eight panels, the header and the search results image from `docs/store/panels/{en,es}` (2026-11-16).
  Left: he sends 1.0.2 (7) back to review.
- [ ] **Spanish titles left in English:** the Usage screen's title ("Usage") and the Agents list's title
  ("Agents"), seen while capturing the Spanish store screens. Found, not fixed.
- [x] **Simulator suite on the new native build, then push.** The icon and the black native splash changed
  native inputs. Done when: every `pnpm sim:verify` flow passes on a rebuilt Debug app and main is pushed.
- [x] **Agent lab, OpenCode on the simulator** (`scripts/agent-lab.py`, `docs/e2e-live-backend.md`). Done
  when: Maestro flows under `e2e/` drive the app against a real OpenCode (Home, Chat, send, Reject, a
  question, modes, shortcuts) and their screenshots are in `design/atlas/sim/live-*`.
- [x] **Agent lab, Codex.** The login inside the lab is done by a person or the lead, never by a worker. Done
  when: Codex has the same captures, fixtures and flows as OpenCode. (Codex 0.167: `goldens/codex/lab`,
  `e2e/live` with `live-codex-*` screenshots; three findings in group 3.)
- [x] **Agent lab, Approve.** The flow asserts the exact harmless command and the throwaway repository
  before it taps the single-use approve option, and fails without tapping otherwise. Done when: the lead
  has read the flow and it passes for OpenCode and Codex. (Passed for both on 2026-11-13: the repository held
  only the one new empty file each time.)
- [x] **Device install.** Done when: the build with everything below is on the test iPhone.

## 2. Chat reads lighter (every program)

From comparing Chat with a first-party client on the same conversation. All of it works on Chat's own model,
so no program-specific branches.

- [x] **Tool calls as one quiet line.** Consecutive tool calls fold into a single borderless row ("Ran 3
  commands", "Read 4 files") that opens on tap; a card only when something needs attention (a failure, an
  approval, a diff). Done when: a turn with five tool calls takes one row, and the atlas shows it.
- [x] **The command's description, not its text.** When the program records what a command is for, the row
  shows that; the raw command shows on opening it. Done when: a long shell line no longer fills a row.
- [x] **One status line above the Composer.** Elapsed time, what the Agent is doing, and how much Background
  Work runs, as one line; finished work folds into it. The "Working for" row leaves the transcript. Done
  when: the line is the only live indicator and opens the Background Work sheet.
- [x] **Harness notices out of the conversation.** Records such as "Background command completed" are not
  messages. Done when: they show in the Background Work sheet and not as Chat rows.
- [x] **The Composer says what Send does.** While the Agent works and the program queues input, the
  placeholder says the message is queued for after this turn. A property of the program's send policy.
- [x] **Conversation title in the header**, with the program and Host under it; the mode chip moves next to
  the Composer.
- [x] **Dictation in reach.** The microphone shows in the Composer when the draft is empty.
- [x] **Message actions in sight.** Copy (and read aloud where the platform gives it) under the latest
  answer, not only on long press.

## 3. Found and not fixed

- [x] **Add Manually: "Trust this Host?" does not show on the first connection.** Found by the agent lab:
  after Save the Host's sheet says Connecting while SSH waits for the host-key answer, and the alert is
  not visible; later redials do not ask again. Blocks the lab's simulator flows and any user who adds a
  Host by hand. Done when: the prompt shows over whatever is on screen, and a redial asks again.
- [x] **Demo: the Codex Agent's Chat says "Conversation Not Readable".** It is what a store reviewer sees.
  Done when: every demo Agent opens a conversation, or says in plain words why it has none.
- [x] **An Agent screen whose Host was removed shows "Reconnecting…" forever.** Done when: it says the Host
  is gone and offers the way back.
- [x] **Terminal config files pile up in the app's temporary folder** (`ghostty-config-*.conf`, one per
  terminal opened). Written by the terminal library's native controller, which removes its file only
  when it is deallocated: it is not being released, or the app is killed first. Needs a native patch
  (sweep at start, and find why the controller outlives its view). Done when: each is removed with its
  terminal, and a start clears leftovers. Closed by `patches/expo-libghostty@0.8.1.patch`: the file goes right after
  ghostty loads it (the shared controller is never deallocated, so one stayed per process), and a start
  sweeps leftovers; proven on the simulator.
- [x] **Codex 0.167: herdr's hook is untrusted, and Chat says to send a prompt.** Found by the agent lab:
  Codex holds a new pane on "Hooks need review" until the user trusts herdr's SessionStart hook (`/hooks`,
  or "Trust all" on that screen). Until then herdr reports no session, and Chat keeps saying "Codex reports
  its conversation after a prompt" after every prompt (`goldens/codex/lab/no-session-without-hooks.ansi`).
  Done when: Chat, and the Setup Guide for Codex, say to trust herdr's hook in Codex.
- [x] **Codex 0.167: a command waiting for approval, or declined, has no row in Chat.** Found by the agent
  lab: Codex runs commands through code mode (`custom_tool_call` `exec` calling `tools.exec_command`); the
  reducer reads that call only for a patch. Done when: the skipped test in `chat/codex/lab.test.ts` passes.
- [x] **Codex: the mode chip says Default Mode while a Plan Mode question covers the footer.** Found by the
  agent lab. Done when: the skipped test in `blocked/codex-lab.test.ts` passes (keep the last mode read).
- [x] **OpenCode Go usage is a stub.** Closed by not listing it: limits live only in the web console (cookie session), no CLI, file or API a Host script can read.
- [x] **Connection sheet: the failure text touches the pinned actions** on a fit-height sheet.
- [x] **Demo Home: every Session thumbnail shows the same screen.**
- [x] **OpenCode: a background subagent's permission can look like the main session's.** Reject then opens
  OpenCode's follow-up field; not destructive. Done when: the end of a background subagent is known.
  Known from the parent's rows (the `subagent` call's `metadata.status: running`, ended by the
  `synthetic` row naming its `childID`), on constructed rows; a lab capture of one would prove it
  live. A launch above every loaded read, or a prompt the user types into the child, stays unseen.
- [x] **Claude Code `/context` from Chat.** Runs in the terminal today because Chat's echo of local command
  output is unverified. Done when: verified and moved to the conversation, or the reason is recorded.
  Verified (Claude Code 2.1, pasted as Chat sends it, while idle): it records the command, its output and
  the output as markdown, and leaves the input box empty. Chat sends it while the Agent is idle and shows
  the markdown as the command's notice. Mid-turn stays held (unverified there).
- [x] **tmux Hosts type a prompt's line breaks as Enter.** Matters when tmux Hosts ship; a draft with
  several diff comments would go out in pieces.

## 4. Release 1.0.1

- [x] **Store screenshots again**, after group 2 changes how Chat looks. (Retaken 2026-11-13 into
  `docs/store/screenshots/en`; they go up with the 1.0.1 version in App Store Connect.)
- [x] **Spanish listing** in the store, from `docs/store/listing.md`. (Spanish (Mexico) added to the 1.0.1
  draft on 2026-11-13 with the new English text and screenshots; it goes public when 1.0.1 is released.)
- [x] **Build and upload** with the new icon, the animated launch and everything above, to internal testers.
  Submitting for review stays a person's step. (1.0.1 build 3 uploaded 2026-11-13, tag `ios-1.0.1-3`; the owner
  answered export compliance and TestFlight shows it for the Internal group. Version 1.0 went live the
  same day.)

## 4b. After 1.0.1 (2026-11-14)

- [x] **One corner scale and screen edges.** `t.radius` with iOS continuous corners; top bars at the safe top,
  bottom bars 20 pt from the bottom (`useChromeInsets`).
- [x] **Home's top bar without the Agents and Sessions buttons**; both are in the Host pill's menu.
- [x] **The Host pill's menu covered the pill on Home.** Measured on the simulator: iOS draws a stack screen
  72 pt down while Fabric measures it from 0, so every anchor frame was 72 pt high. Anchors are corrected by
  the screen's real origin (`windowFrame.ts`), and an open menu measures again when the keyboard moves.
- [x] **Air at the end of the Chat** above the status line, the Blocked card and the Composer.
- [x] **Notifications asked after the first Host**, with a sheet that says why (`PermissionPrimer`). Approve
  from Notifications stays off by default (owner, 2026-11-14). Not yet seen on a real phone.
- [x] **The approval card reads like a request, for every program.** The title says who asks for what
  ("Bash wants to run:"), the command sits in its own block, decline and the single-use approve share a
  row, and an option that saves a rule stays apart with its warning. A dialog the terminal clips shows the
  request Chat already knows. What is sent is unchanged (`answer-layout.ts`, `shown-request.ts`). Checked
  against a real OpenCode in the agent lab.
- [x] **The running turn is the live line at the end of the Chat** ("Working… 1m 45s", or "Waiting for
  you…" while a request is pending or herdr reports Blocked). The line over the Composer counts only what
  the Background Work sheet lists.
- [x] **A message from another agent is one line** that opens a sheet with its sender and whole text.
- [x] **Background Work sheet:** Running and Finished sections, rows by kind (Subagent, Workflow,
  background command), and a Subagent's prompt above its transcript. No stop control: whether a program
  lets a task be stopped from outside is not verified.
- [x] **One answers component for every Blocked card, and a tall command shown as its request.** Found on
  the owner's phone (2026-11-14): a permission dialog taller than the terminal fell to the raw card, which
  drew its own stacked "1. Yes / 2. No" buttons. Every card now draws its answers through `Answers`; a
  command cut by the top of the screen shows the waiting request when its last rows match exactly
  (`shown-request.ts`, fixture `claude-tall-bash.ansi`, atlas `rn.blocked-card-tall`). What is sent is
  unchanged. Not yet on a phone: it reaches build 5 with the first update.
- [x] **One piece per pattern** (owner, 2026-11-14, after two read-only audits of duplicated UI and of
  fallback paths). The generic Blocked card serves any program's unknown dialog: keys when nothing is
  numbered, more labels read as permission answers (strictly), a clean reading with the question as title
  (`excerpt-rows.ts`), Codex's cut exec shown as its request, Grok's empty-subject permission sent to it.
  Shared now: `DisclosureChevron`, `LineCounts`, wash pills, `ChipRow`, `KeyPad compact`, `ButtonRow` in
  the Live Activity confirm sheet, Review Paste and the quick sheet, `UnreadableNotice`. Texts: chat
  titles, composer, send and Stop reasons travel as `Text` and translate; the app says "Agents Pocket".
  Guards: `degraded-dialogs.test.ts` (every capture that falls to the generic card is listed with its
  reason, plus cut variants), and tests that fail on the old names or a missing language.
- [x] **The rest of the normalization** (2026-11-14): one `TerminalStatus` for the Agent's and the Shell's
  terminals (a card over the scrim, each surface's actions as data); `Section` with `inset` is the one
  grouped rows card (changes, usage, setup guide, peers, palettes, terminals); `scripts/check-ui-duplicates.mjs`
  in verify-fast rejects hand-made button groups, a local component named like a shared one and hand-made
  disclosure chevrons, and `check-reuse.mjs` now covers every ui folder; the generic card's reasons say
  what the card offers. Three screen goldens (`omp-34`, `opencode-25`, `opencode-42`) carry the new reason
  text by hand: regenerating them from Swift would bring the old sentence back.
- [x] **A paste is reviewed in both terminals, however it arrives** (owner: "make them equal", 2026-11-14).
  The Shell uses the Agent's `TerminalInputController` and the shared `TerminalPasteReview`. A paste the
  terminal view delivers as input (the system Paste, the accessory bar, Cmd+V, an IME commit with line
  breaks) is recognized in `incoming-paste.ts`: bracketed-paste markers, or a line break inside text; typing
  passes byte for byte. A refused paste shows a toast. On Android a bracketed paste is left to the native
  dialog.
- [ ] **Before any update or build carries the paste change: on a real iPhone**, in an Agent's terminal and
  in a Shell, with a program that turns bracketed paste on (zsh, an agent's TUI) and one that does not:
  type with the iOS keyboard on the terminal (every key must arrive, Enter included), paste one word, paste
  several lines (the sheet opens; confirm sends them once; cancel sends nothing), paste something long. The
  simulator cannot put the system keyboard on the terminal view, so none of this is checked. Not known: a
  very long paste delivered in pieces.
- [ ] **For the owner to decide:** `packages/ui/src/diff/DiffView.tsx` has no screen calling it. Proposed:
  a "Side by Side" switch on the file diff, as one more layout of the diff the Chat and Changes already use,
  and delete the loose component (Moshi's viewer is side by side; ours is unified, as GitHub and Gerrit do
  on narrow screens). Ideas seen in competitors, not built: a "last turn only" scope and jumping between
  hunks.
- [x] **Store build 1.0.2 (6)** (2026-11-15): the encryption declaration, the system permission texts and
  the widgets, Live Activity and notification fallback saying "Agents Pocket", and the Expo SDK 58 patch
  versions. Built, every `pnpm sim:verify` flow passed on it, uploaded to App Store Connect, recorded in
  `docs/releases/builds.json`, tag `ios-1.0.2-6`. Version 1.0.1 (5) was released by Apple the same day.
- [x] **1.0.2 (7) replaces build 6** (2026-11-15): the owner had build 6 pulled from review to add the Live
  Activity and Dynamic Island redesign (direction A, the app mark drawn in code), one status line in the Chat,
  the Composer field that grows, the Composer menus as panels, the shared sheet header and fit sheets that
  scroll. All 22 `pnpm sim:verify` flows passed on it; uploaded, tag `ios-1.0.2-7`. Submitted for review the same day on the owner's word ("Waiting for Review").
- [ ] **On a real iPhone, from TestFlight or the store:** the paste check listed above, a web link opening
  in the sheet, and the widgets and Live Activity with the longer name (they compile; no flow shows them).
- [x] **Over-the-air JS updates** (ADR 0028). Done: the update server, the publish script with the real R2
  upload, the app side behind the official-build flag, the signing certificate in the repo (the key is with
  the owner), the privacy policy and the store wording, a local end-to-end on a Release simulator build,
  store build 1.0.1 (5) submitted with updates on, and a first real update applied on the owner's iPhone
  (2026-11-14). Since 2026-11-15 (ADR 0028, "internal channel and staged rollout"): an internal channel,
  a production rollout (start 10%, `rollout`, `stop`, `revert`), one command (`pnpm ota`), and CI that
  holds no secret and prints an OTA verdict per push (`sourceFingerprint` in `docs/releases/builds.json`).
- [x] Privacy clause added (the request says whether the install is from TestFlight; owner, 2026-11-15)
  and the app-side change merged: TestFlight installs ask for `internal`. It reaches a phone with the
  next update or store build.
- [ ] **On a real iPhone:** a TestFlight install asks for `internal` and an App Store install does not
  (detection reads the StoreKit receipt name; unverified).
- [ ] **On a device:** a `revert` (the device on the bad update takes the re-signed previous one), the
  rollback after a crash at launch, and Android.
- [ ] **First production update.** 1.0.1 (5) is live and can take one, but main moved past its native
  inputs with 1.0.2: an update for 1.0.1 would have to be published from the commit before them
  (`2aff62a1`). Otherwise the first update goes to 1.0.2 once it is released. Either way after the paste
  device check listed above. It also removes the Early Updates switch from builds that still show it.

## 5. Needs the owner

- [ ] **On a real phone:** Ask Agent and Comment on Line against a real Agent; an unreachable Host's sheet
  and Agent screen; a resumed subagent listed as running; approvals in Claude Code still confirm (the
  matched-request change); a command shortcut from Chat opens the terminal with the command typed; the
  animated launch on a Release build, with Reduce Motion and with App Lock. The notification sheet
  after pairing a first Host, the system prompt after it, and a push arriving without visiting Settings.
- [ ] **What a simulator cannot do:** a push with the app closed, Approve from a notification, the Live
  Activity, for Codex and OpenCode (`docs/guides/device-test-codex-opencode.md`).
- [x] Cloudflare Web Analytics turned off for the zone (2026-11-15): the site and the relay's /privacy no
  longer carry the injected beacon, checked from outside with a browser user agent.
- [ ] **Host addresses that heal themselves.** Each encrypted notification carries the Host's current
  addresses and the app updates that Host's routes; the pinned host key still decides which machine is
  trusted. Changes the notification envelope.
- [ ] **iPad.**
- [ ] **Approve without opening the app, and Apple Watch.**
- [ ] **A bug hunt by zones** (planned, never run).
- [ ] **State docs.** Bring CLAUDE.md's gate notes up to date, add a map of `packages/core`. (The task board is
  archived in `docs/archive/`, `progress.mjs` is gone.)
- [ ] **Site:** remove the Windows installer while Windows Hosts are out of scope.
