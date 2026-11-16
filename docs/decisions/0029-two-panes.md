# 0029. Wider windows show two panes; the route is the selection

Status: accepted (2026-11-16), the owner approved the mockup. Stage 1 (closed, open, open and rotated) is being built; the half-open pose is stage 2 and not decided here.

## Context

iPhone Duo opens from a 466x678 pt outer display to an inner one of 951x669 pt (2853x2007 px), wider than tall when the device is opened from portrait; rotated it is 669x951. Measured on the simulator (2026-11-16): the system keeps a column of about 84 pt on the trailing side of the inner display, which reaches the app as a safe-area inset. Apple's "Prepare your app for iPhone Duo" says: the app resizes continuously as the device opens and closes, the inner display does not honor the supported orientations, and layout should follow size classes, never the device or the orientation. The App Store has a Duo screenshot slot and will require it from April 2027 for apps built with the iOS 27.1 SDK.

The app already has layout modes by window width (`useLayoutMode`: compact under 600, regular, wide from 860, expansive from 1160), used by Home and Usage only. Home and the Agent screen are prop-driven components that their routes only wire.

## Decision

1. **One new primitive, `SplitView` in `packages/ui`.** It lays panes side by side. Each pane gets its own layout mode, from its own width, and its share of the window's safe area. `useLayoutMode` reads the pane's mode before the window's, so a screen inside a pane lays out for the room it has. No screen checks a width, a device or an orientation.
2. **The selected Agent lives in the route.** From `regular` up, `/` shows Home in the list pane and an empty detail, and `/agent/[hostId]/[paneId]` shows Home in the list pane and that Agent in the detail pane. In `compact` both routes render what they render today. Closing the device in a Chat keeps that Chat; opening it adds the list beside it. Nothing has to be remembered or restored.
3. **A tap in the list pane swaps the Agent in place** from the Agent route (`router.setParams`, as the Agent switcher already does) and pushes without animation from `/`.
4. **Existing screens, mounted as they are.** `HomeScreen` and `AgentDetailScreen` go into the panes unchanged; there is no second Home or Agent screen and nothing names the Duo. The same pieces are the iPad layout later.

## What stays out

- The closed pose needs nothing: on the outer display the system keeps a column on one side and the app already lays out inside the rest (checked on the simulator).
- No native configuration changes for rotation until the open pose is measured: portrait-only is honored on the outer display and ignored on the inner one, so the layout modes may be all it takes.
- Chat and Terminal side by side on the rotated inner display is a separate task after this lands. Attaching a terminal resizes the Agent's terminal on the Host, so it must stay something the user asks for, not something a wide window does on its own.
- The half-open pose (stage 2) needs a native module for the fold; React Native has none and the API names are not confirmed against Apple's documentation.

## Consequences

- Home can be mounted twice (under the stack and in the list pane): notices and sheets must come from the focused one only.
- Overlays (sheets, menus, alerts) keep sizing from the window. Anything else that reads the window's size has to be looked at once: a pane is narrower than the window.
- Verification: `scripts/atlas-web.mjs` at the Duo's sizes is support, not proof. On the simulator the pose (closed, open, folded, rotated) is set from Xcode's Device Hub (`Xcode.app/Contents/Applications/DeviceHub.app`), by hand or with computer use: `simctl` has no command for it. Maestro reads the inner display's hierarchy with a shifted origin, so its taps miss there: assertions work, taps do not.
- The window changes size while the app runs (opening, closing, rotating). Anything that measures the window or a screen once is a bug on this device.
