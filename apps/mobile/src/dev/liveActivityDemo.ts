import {
  type ActivityAsk,
  type ActivityContentState,
  type AgentInfo,
  APPROVAL_OPT_IN_FILE_NAME,
  buildDesire,
  type ConsoleRow,
  encodeBase64Url,
  type LiveActivityController,
  sealContent,
} from '@openagentspocket/core';
import { APP_GROUP, type AppGroupStore } from 'agentico-app-group';

/** Demo-only identifiers and key. The key protects nothing: it only lets the widget open the demo envelope. */
export const DEMO_HOST_ID = '00000000-0000-4000-8000-0000000000a1';
export const DEMO_HOST_NAME = 'demo';
const DEMO_KEY = Uint8Array.from({ length: 32 }, (_, index) => index + 1);
export const KEY_MIRROR_FILE = 'notification-keys.json';

/**
 * `start`, `update`, `end` walk one activity through its life. The rest show one drawn state each
 * (the Live Activity design's previews): one Agent working, several, Blocked with its prompt and
 * buttons, and all done.
 */
export const DEMO_STEPS = ['start', 'update', 'end', 'one', 'several', 'blocked', 'done'] as const;
export type DemoStep = (typeof DEMO_STEPS)[number];

/** Demo-only nonce source: the real app needs a secure one (see the report's follow-ups). */
const demoRandomBytes = (length: number) =>
  Uint8Array.from({ length }, () => Math.floor(Math.random() * 256));

interface DemoAgent {
  readonly pane: string;
  readonly status: string;
  readonly title: string;
  readonly workspace: string;
  readonly kind?: string;
  readonly name?: string;
}

function row(demo: DemoAgent): ConsoleRow {
  const agent = {
    pane_id: demo.pane,
    agent_status: demo.status,
    agent: demo.kind ?? 'claude',
    ...(demo.name ? { display_agent: demo.name } : {}),
    terminal_title_stripped: demo.title,
    focused: false,
    revision: 0,
    tab_id: 't',
    terminal_id: 'x',
    workspace_id: 'w',
  } as AgentInfo;
  return {
    hostId: DEMO_HOST_ID,
    hostName: DEMO_HOST_NAME,
    agent,
    workspaceLabel: demo.workspace,
    workspaceTabCount: 1,
    tabPaneCount: 1,
  };
}

const codex = (status: string): DemoAgent => ({
  pane: 'w2:p1',
  status,
  title: 'Running pnpm test settings',
  workspace: 'storefront',
  kind: 'codex',
  name: 'codex',
});
const claude = (status: string): DemoAgent => ({
  pane: 'w2:p2',
  status,
  title: 'Editing schema.prisma',
  workspace: 'api',
  kind: 'claude',
  name: 'claude',
});
const opencode = (status: string): DemoAgent => ({
  pane: 'w2:p3',
  status,
  title: 'Writing CHANGELOG.md',
  workspace: 'docs',
  kind: 'opencode',
  name: 'opencode',
});

/** What the demo Host's Agents look like at each step. */
export function demoRows(step: DemoStep): ConsoleRow[] {
  switch (step) {
    case 'end':
      return [];
    case 'one':
      return [row(codex('working'))];
    case 'several':
    case 'blocked':
      return [row(codex('blocked')), row(claude('working')), row(opencode('working'))];
    case 'done':
      return [row(codex('done')), row(claude('done')), row(opencode('done'))];
    default:
      return [
        row({
          pane: 'w1:p1',
          status: step === 'start' ? 'working' : 'done',
          title: 'Refactor the settings store',
          workspace: 'app',
        }),
        row({ pane: 'w1:p2', status: 'blocked', title: 'Run the migration?', workspace: 'api' }),
        row({ pane: 'w1:p3', status: 'working', title: 'Write release notes', workspace: 'docs' }),
      ];
  }
}

/** The prompt the Blocked step's Agent waits on; its buttons open the app like the real ones. */
export function demoAsks(step: DemoStep, nowSeconds: number): ReadonlyMap<string, ActivityAsk> {
  if (step !== 'blocked') return new Map();
  const ask: ActivityAsk = {
    episodeId: `demo-${nowSeconds}`,
    denyOnly: false,
    prompt: 'Bash wants to run: pnpm test settings',
    options: ['Yes', 'No'],
    timestamp: nowSeconds,
  };
  return new Map([[codex('blocked').pane, ask]]);
}

/** Content for a step, or null when nothing should be shown (the end signal). */
export function demoContent(
  step: DemoStep,
  nowSeconds = Math.floor(Date.now() / 1000),
): ActivityContentState | null {
  const desire = buildDesire({
    rows: demoRows(step),
    hostName: DEMO_HOST_NAME,
    asks: demoAsks(step, nowSeconds),
  });
  return desire ? sealContent(desire, DEMO_KEY, demoRandomBytes) : null;
}

/**
 * The widget cannot reach the Keychain while the device is locked, so it reads Notification Keys
 * from a mirror in the App Group container. The demo writes its key there.
 */
export async function writeDemoKeyMirror(store: AppGroupStore): Promise<boolean> {
  const mirror = {
    v: 1,
    records: [{ host: DEMO_HOST_ID, name: DEMO_HOST_NAME, key: encodeBase64Url(DEMO_KEY) }],
  };
  return store.writeFile(KEY_MIRROR_FILE, JSON.stringify(mirror));
}

/**
 * The widget draws a prompt's buttons only for a Host that approves from outside the app. Adds the
 * demo Host to that mirror, keeping the real Hosts in it (the app rewrites it on its next sync).
 */
export async function writeDemoOptIn(store: AppGroupStore): Promise<boolean> {
  let hosts: string[] = [];
  try {
    const stored: unknown = JSON.parse((await store.readFile(APPROVAL_OPT_IN_FILE_NAME)) ?? '{}');
    const listed = (stored as { hosts?: unknown }).hosts;
    if (Array.isArray(listed)) hosts = listed.filter((id): id is string => typeof id === 'string');
  } catch {
    hosts = [];
  }
  const merged = [...new Set([...hosts, DEMO_HOST_ID])].sort();
  return store.writeFile(APPROVAL_OPT_IN_FILE_NAME, JSON.stringify({ v: 1, hosts: merged }));
}

export { APP_GROUP };

/** Runs one demo step against the real controller; returns a one-line outcome. */
export async function runDemoStep(
  step: DemoStep,
  controller: LiveActivityController,
  store: AppGroupStore,
): Promise<string> {
  if (!controller.areEnabled) return 'Live Activities are disabled for this app.';
  const existing = (await controller.currentActivities()).find((a) => a.hostId === DEMO_HOST_ID);
  if (step === 'end') {
    if (existing) controller.end(existing.id, null, true);
    return existing ? `ended ${existing.id}` : 'nothing to end';
  }
  if (!(await writeDemoKeyMirror(store)))
    return 'App Group unavailable: the widget cannot read the key.';
  if (step === 'blocked' && !(await writeDemoOptIn(store)))
    return 'App Group unavailable: the widget cannot show the buttons.';
  const content = demoContent(step);
  if (!content) return 'sealing failed';
  if (existing) {
    controller.update(existing.id, content);
    return `updated ${existing.id}`;
  }
  const handle = await controller.request(DEMO_HOST_ID, content);
  return `started ${handle.id}`;
}
