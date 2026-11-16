import { describe, expect, it } from 'vitest';
import { terminalPolicy } from './policy';
import { chatPolicy, rig, states } from './store.testkit';

describe('ComposerStore sendText', () => {
  it('sends the text as its own message and leaves the draft as typed', async () => {
    const r = rig();
    r.store.replaceDraft('half a thought');
    expect(await r.store.sendText('/effort high', terminalPolicy)).toEqual({
      kind: 'deliveredViaPrompt',
    });
    expect(r.calls).toEqual([{ target: 'w1:p1', text: '/effort high' }]);
    expect(r.store.getSnapshot().draft).toBe('half a thought');
    expect(states(r.store)).toEqual([{ kind: 'delivered', progress: 'acknowledged' }]);
  });

  it('refuses while the Agent is blocked and sends nothing', async () => {
    const r = rig('blocked');
    const result = await r.store.sendText('/fast on', terminalPolicy);
    expect(result).toEqual({ kind: 'refused', refusal: { kind: 'agentBlocked' } });
    expect(r.calls).toEqual([]);
    expect(r.store.getSnapshot().messages).toEqual([]);
  });

  it("refuses with the policy's own validation", async () => {
    const r = rig();
    const policy = chatPolicy({ validate: () => ({ kind: 'commandAwaitsIdle', name: 'x' }) });
    expect((await r.store.sendText('/x', policy)).kind).toBe('refused');
    expect(r.calls).toEqual([]);
  });
});
