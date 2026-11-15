import { describe, expect, it } from 'vitest';
import { FakeClock } from '../hosts/cancellation';
import { utf8Encode } from '../pairing/bytes';
import { eventually, identity, PoolProbe } from './pool.testkit';
import { ShellTerminalStore } from './shell-store';
import { encodePaste } from './text-safety';

function make(probe: PoolProbe, generation: number | null = 1) {
  return new ShellTerminalStore({
    identity: identity('t1'),
    transportGeneration: generation,
    isOnStage: () => true,
    runTerminal: probe.runner(),
    clock: new FakeClock(),
  });
}

describe('ShellTerminalStore', () => {
  it('scrolls by wheel only while what runs in the shell tracks the mouse', async () => {
    const probe = new PoolProbe();
    const store = make(probe);
    store.viewDidResize(80, 24);
    await eventually(() => probe.sessions.length === 1);
    expect(store.touchScroll.isActive()).toBe(false);
    probe.sessions[0]?.emit(utf8Encode('\u001b[?1000h'));
    await eventually(() => store.touchScroll.isActive());
    store.touchScroll.drag(40, 16);
    await eventually(() => probe.sessions[0]?.scrolls.length === 1);
    expect(probe.sessions[0]?.scrolls).toEqual([2]);
    store.transportGenerationDidChange(2);
    await eventually(() => !store.touchScroll.isActive());
  });

  it('attaches the remembered terminal id without takeover, never creating', async () => {
    const probe = new PoolProbe();
    const store = make(probe);
    store.viewDidResize(80, 24);
    await eventually(() => probe.requests.length === 1);
    expect(probe.requests[0]?.target).toEqual({ kind: 'terminal', id: 't1' });
    expect(probe.requests[0]?.takeover).toBe(false);
    await store.leave();
    expect(probe.ended).toEqual(['t1']);
  });

  it('a newer Host generation replaces the pipeline with the same terminal id', async () => {
    const probe = new PoolProbe();
    const store = make(probe);
    store.viewDidResize(80, 24);
    await eventually(() => probe.requests.length === 1);
    const before = store.terminal;
    store.transportGenerationDidChange(2);
    await eventually(() => store.terminal !== before);
    store.viewDidResize(100, 30);
    await eventually(() => probe.requests.length === 2);
    expect(probe.requests[1]?.target.id).toBe('t1');
    await store.leave();
  });

  it('a return on the same connection keeps a live terminal attached', async () => {
    const probe = new PoolProbe();
    const store = make(probe);
    store.viewDidResize(80, 24);
    await eventually(() => probe.sessions.length === 1);
    probe.sessions[0]?.emit(new Uint8Array([104]));
    await eventually(() => store.terminal.status.kind === 'live');
    const before = store.terminal;
    store.didBecomeActive(true);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(store.terminal).toBe(before);
    expect(probe.ended).toEqual([]);
    await store.leave();
  });

  it('take over reattaches with the takeover flag', async () => {
    const probe = new PoolProbe();
    const store = make(probe);
    store.viewDidResize(80, 24);
    await eventually(() => probe.requests.length === 1);
    store.takeOverTerminal();
    await eventually(() => store.getVersion() === 1);
    store.viewDidResize(81, 24);
    await eventually(() => probe.requests.length === 2);
    expect(probe.requests[1]?.takeover).toBe(true);
    await store.leave();
  });

  describe('paste', () => {
    async function attached() {
      const probe = new PoolProbe();
      const store = make(probe);
      store.viewDidResize(80, 24);
      await eventually(() => store.input.hasWriter);
      const session = probe.sessions[0];
      if (!session) throw new Error('no session');
      return { store, session };
    }
    const text = 'cd /tmp\nrm -rf build\n';

    it('holds a multi-line paste for review and sends nothing until confirmed', async () => {
      const { store, session } = await attached();
      expect(store.input.requestPaste(text).kind).toBe('requiresReview');
      expect(store.input.pendingPaste).toMatchObject({ lineCount: 3 });
      expect(session.sent).toEqual([]);
      expect(store.input.confirmPaste()).toBe(true);
      expect(session.sent).toEqual([encodePaste(text, false)]);
      expect(store.input.pendingPaste).toBeNull();
      await store.leave();
    });

    it('a cancelled review sends nothing', async () => {
      const { store, session } = await attached();
      store.input.requestPaste(text);
      store.input.cancelPaste();
      expect(store.input.confirmPaste()).toBe(false);
      expect(session.sent).toEqual([]);
      await store.leave();
    });

    it('keeps typing raw and a single safe line immediate', async () => {
      const { store, session } = await attached();
      store.send(utf8Encode('ls\r'));
      expect(store.input.requestPaste('git status').kind).toBe('inserted');
      expect(session.sent).toEqual([utf8Encode('ls\r'), utf8Encode('git status')]);
      await store.leave();
    });

    it('rejects control characters and keeps a review across a pipeline replacement', async () => {
      const probe = new PoolProbe();
      const store = make(probe);
      store.viewDidResize(80, 24);
      await eventually(() => store.input.hasWriter);
      expect(store.input.requestPaste('a\u001b[31m').kind).toBe('rejected');
      expect(store.input.pasteError).not.toBeNull();
      store.input.requestPaste(text);
      const before = store.terminal;
      store.transportGenerationDidChange(2);
      await eventually(() => store.terminal !== before);
      expect(store.input.pendingPaste).not.toBeNull();
      store.viewDidResize(80, 24);
      await eventually(() => probe.sessions.length === 2 && store.input.hasWriter);
      expect(store.input.confirmPaste()).toBe(true);
      expect(probe.sessions[0]?.sent).toEqual([]);
      expect(probe.sessions[1]?.sent).toEqual([encodePaste(text, false)]);
      await store.leave();
    });
  });
});
