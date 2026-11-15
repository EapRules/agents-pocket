# widgets target

iOS widget extension generated at prebuild by `@bacons/apple-targets` (see `expo-target.config.js`).

## Provenance

The Swift sources are copied from the native Swift app (Agentico) with no logic changes, except that
the Live Activity's Approve and Deny are links here, not intents: a button opens the app, which reads
the prompt from the Host and answers through the notification's gates (`AgentActivityLink.answerURL`,
`apps/mobile/src/live-activity/LiveActivityActions.tsx`). Sources:
`UsageCore`, `Widgets` (Usage widgets, Live Activity UI, island, rows), `ActivityCore`,
`NotificationCore`, `Theme`, `Support`. They contain no personal identifiers (checked by grep).

The Live Activity and Dynamic Island views no longer match the Swift app: they follow the approved
direction A ("Sobrio") design (near-black card, Blocked first, the app's mark drawn in code in
`Widgets/AgentsPocketMark.swift`). Do not copy the Swift app's `AgentLiveActivityWidget*`,
`AgentActivityIsland` or `AgentActivityRows` over them; the data model and `ActivityCore` are still shared.

## Seeing the Live Activity

- Xcode canvas: `Widgets/AgentLiveActivityWidget+Previews.swift` has one preview per drawn state
  (Lock Screen, compact, minimal, expanded), stale included.
- Simulator, Debug build: `xcrun simctl openurl booted "openagentspocket:///__live-activity?step=one"`
  (or `several`, `blocked`, `done`; `end` removes it). Then lock (Cmd+L) or go home (Shift+Cmd+H) to
  see the island. Coming back to the foreground ends the demo activity (the coordinator ends
  activities of unknown Hosts), which can race the URL's own step: with the app already open, open
  the same URL a second time and the step lands. Stale cannot be started from JS: the module always
  passes a nil `staleDate`.

## Sync procedure

1. Copy the changed files from the Swift app over the same relative path here.
2. Keep the group identifier at the placeholder below; never commit a real team or account id.
3. `npx expo prebuild --clean`, then build the simulator app (integrator only).

## Placeholder group

App Group: `group.com.openagentspocket.app`. It must match `APP_GROUP` in `modules/app-group`,
`ios.entitlements` in `apps/mobile/app.json` and `expo-target.config.js`.
Set `ios.appleTeamId` in app.json once the Apple team is active (needed for a device build).

## Scope

Usage widgets are wired (TS snapshot builder -> `modules/app-group` -> `usage-widgets.json`).
The Live Activity views live here; `modules/live-activity` starts, updates and ends the activity through
ActivityKit (task P6.1b). `AgentActivityAttributes` exists twice on purpose: here and in
`modules/live-activity/ios/AgentActivityAttributes.swift` (an activity is matched by type name and its
Codable shape, so keep both identical; the type name is shipped-forever). The widget decrypts with the
Notification Key from the Keychain, or from `notification-keys.json` in the App Group when the device is
locked.
