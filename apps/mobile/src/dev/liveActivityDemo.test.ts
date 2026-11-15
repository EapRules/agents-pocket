import { APPROVAL_OPT_IN_FILE_NAME, FakeLiveActivityController } from '@openagentspocket/core';
import type { AppGroupStore } from 'agentico-app-group';
import { DEMO_HOST_ID, demoAsks, demoContent, runDemoStep } from './liveActivityDemo';

function memoryStore(): AppGroupStore & { files: Map<string, string> } {
  const files = new Map<string, string>();
  return {
    files,
    available: true,
    containerPath: async () => '/group',
    writeFile: async (name, text) => {
      files.set(name, text);
      return true;
    },
    readFile: async (name) => files.get(name) ?? null,
    reloadWidgets: async () => undefined,
    requestNotificationAuthorization: async () => true,
    notificationKeychain: null,
  };
}

describe('live activity demo', () => {
  it('shows nothing once the demo Agents are gone', () => {
    expect(demoContent('end')).toBeNull();
  });

  it('counts the demo Agents and seals their details', () => {
    const content = demoContent('start');
    expect(content?.counts).toEqual({ working: 2, blocked: 1, done: 0 });
    expect(content?.envelope?.ct.length).toBeGreaterThan(0);
  });

  it('draws each designed state from its own counts', () => {
    expect(demoContent('one')?.counts).toEqual({ working: 1, blocked: 0, done: 0 });
    expect(demoContent('several')?.counts).toEqual({ working: 2, blocked: 1, done: 0 });
    expect(demoContent('done')?.counts).toEqual({ working: 0, blocked: 0, done: 3 });
  });

  it('gives only the Blocked step a prompt to answer', () => {
    expect(demoAsks('several', 100).size).toBe(0);
    const [ask] = [...demoAsks('blocked', 100).values()];
    expect(ask?.timestamp).toBe(100);
    expect(ask?.options.length).toBe(2);
  });

  it('adds the demo Host to the approval opt-in mirror, keeping the real ones', async () => {
    const store = memoryStore();
    store.files.set(APPROVAL_OPT_IN_FILE_NAME, JSON.stringify({ v: 1, hosts: ['real-host'] }));
    await runDemoStep('blocked', new FakeLiveActivityController(), store);
    const mirror = JSON.parse(store.files.get(APPROVAL_OPT_IN_FILE_NAME) ?? '{}');
    expect(mirror.hosts).toEqual(expect.arrayContaining(['real-host', DEMO_HOST_ID]));
  });

  it('starts, updates in place and ends the one activity', async () => {
    const controller = new FakeLiveActivityController();
    const store = memoryStore();
    await runDemoStep('start', controller, store);
    expect(controller.requestedHandles.map((h) => h.hostId)).toEqual([DEMO_HOST_ID]);
    expect(store.files.has('notification-keys.json')).toBe(true);
    await runDemoStep('update', controller, store);
    expect(controller.requested).toHaveLength(1);
    expect(controller.updates).toHaveLength(1);
    await runDemoStep('end', controller, store);
    expect(controller.ended).toHaveLength(1);
  });
});
