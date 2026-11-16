# App Store screenshots

Two layers:

- `screenshots/<locale>/` holds the raw screens: the app as captured, no frame or caption. The repository README shows the English ones.
- `panels/<locale>/` holds what App Store Connect gets: each screen inside an iPhone, with a caption, over one gradient that runs across the set.

Both are 1206x2622 (iPhone with Dynamic Island, medium display: the size App Store Connect asks for first, and the simulator's own), portrait, dark theme (`negro`), English (`en`) and Spanish (`es`).

## Raw screens

Each one is an atlas screen captured on the project simulator with demo data and a clean 9:41 status bar:

```
node scripts/atlas-ios.mjs --udid <simulator udid> --theme negro --lang <en|es> <atlas id>
```

The capture lands in `design/atlas/rn-ios/<atlas id>.negro.<lang>.png` and is saved here as JPEG, not scaled: App Store Connect does not process a screenshot with an alpha channel, and the simulator PNG has one.

```
sips -s format jpeg -s formatOptions 92 design/atlas/rn-ios/<atlas id>.negro.<lang>.png --out docs/store/screenshots/<lang>/<file>
```

| File | Atlas id |
|---|---|
| `01-home.jpg` | `shell.home` |
| `02-chat.jpg` | `agent-detail.chat` |
| `03-approval.jpg` | `agent-detail.chat-blocked-card` |
| `04-changes.jpg` | `changes.list` |
| `05-usage.jpg` | `usage.tab` |
| `06-agents.jpg` | `console.agents-list-by-status` |
| `07-terminal.jpg` | `agent-detail.terminal` |
| `08-themes-<theme>.jpg` | `shell.home`, once per theme (`negro`, `indigo`, `noche`, `papel`) |

## Panels

```
node scripts/store-panels.mjs [--locale en] [--size 1206x2622]
```

Order, layout and captions per locale live in `docs/store/panels/panels.json`; the look (gradient, type, the iPhone) in `scripts/store-panels.css`. The script renders each panel with a headless Chromium-family browser and writes `docs/store/panels/<locale>/<file>`. `--size` renders the set for another display, for example `1290x2796`.

A panel with `screens` (the themes one) cuts several captures of the same screen into slanted slices inside one iPhone.

The same file lists the wide art under `art`: the product page header (3840x1646) and the search results image (3840x2560), each with Apple's art safe area; `--safe` outlines that area on the render. If a field in App Store Connect refuses the JPEG, convert it (`sips -s format png header.jpg --out header.png`): the result has no alpha channel.

Captions say what the screen shows: no claim the screen does not back, no badges or ratings.
