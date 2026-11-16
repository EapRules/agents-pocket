import { describe, expect, it } from 'vitest';
import type { ChatAgentActivity } from '../model/types';
import { emptyBox, type InputBoxState } from '../send/input-box';
import { sendPolicyFor } from '../send/registry';
import { syntheticScreen } from '../send/send.testkit';
import {
  planSettingChange,
  programSettings,
  SETTING_AFTER_TURN_KEY,
  SETTING_READ_ONLY_KEY,
  SETTING_SAVES_DEFAULT_KEY,
  SETTING_USAGE_CREDITS_KEY,
  SETTING_VALUE_NOT_OFFERED_KEY,
  type SettingChangePlan,
  settingChangeNotes,
} from './index';
import type { ProgramSettingID } from './settings';

/** A screen with no dialog, whose input box reads as `box`. */
function plan(
  program: string,
  id: ProgramSettingID,
  value: string | null,
  activity: ChatAgentActivity = 'idle',
  box: InputBoxState | null = emptyBox(),
): SettingChangePlan {
  const setting = programSettings(program).find((s) => s.id === id);
  if (!setting) throw new Error(`${program} lists no ${id}`);
  const real = sendPolicyFor(program as Parameters<typeof sendPolicyFor>[0]);
  const policy = box ? { ...real, readInputBox: () => box } : real;
  const screen = box ? syntheticScreen(['output', '']) : null;
  return planSettingChange({ program, setting, value, activity, policy, screen });
}

const sent = (result: SettingChangePlan) => {
  if (result.kind !== 'send') throw new Error(`not sent: ${JSON.stringify(result)}`);
  return result;
};

const refusal = (result: SettingChangePlan) => {
  if (result.kind !== 'refuse') throw new Error(`not refused: ${JSON.stringify(result)}`);
  return result.refusal;
};

const reasonKey = (result: SettingChangePlan) => {
  const r = refusal(result);
  if (r.kind !== 'commandUnavailable' || typeof r.reason === 'string' || !('key' in r.reason))
    throw new Error(`no reason: ${JSON.stringify(r)}`);
  return r.reason.key;
};

describe('a documented command sends the value as its argument', () => {
  it('a choice and a toggle produce the documented text, typed for the terminal', () => {
    expect(sent(plan('claude', 'effort', 'high')).draft).toEqual({
      surface: 'terminal',
      text: '/effort high',
    });
    expect(sent(plan('claude', 'fast', 'on')).draft.text).toBe('/fast on');
    expect(sent(plan('claude', 'fast', 'off')).draft.text).toBe('/fast off');
    expect(sent(plan('hermes', 'effort', 'ultra')).draft.text).toBe('/reasoning ultra');
  });

  it('idle applies now; the notes say a Claude level also becomes the default', () => {
    const result = plan('claude', 'effort', 'low');
    expect(sent(result).appliesAfterTurn).toBe(false);
    expect(settingChangeNotes(result).map((m) => m.key)).toEqual([SETTING_SAVES_DEFAULT_KEY]);
    expect(settingChangeNotes(plan('hermes', 'effort', 'low'))).toEqual([]);
  });

  it('refuses a value the program does not offer', () => {
    expect(reasonKey(plan('claude', 'effort', 'ultra'))).toBe(SETTING_VALUE_NOT_OFFERED_KEY);
    expect(reasonKey(plan('claude', 'fast', null))).toBe(SETTING_VALUE_NOT_OFFERED_KEY);
  });
});

describe('the Agent state decides', () => {
  it('blocked refuses every change, a picker too', () => {
    for (const [program, id] of [
      ['claude', 'effort'],
      ['claude', 'fast'],
      ['hermes', 'effort'],
      ['claude', 'model'],
      ['opencode', 'effort'],
    ] as const) {
      expect(refusal(plan(program, id, 'high', 'blocked'))).toEqual({ kind: 'agentBlocked' });
    }
  });

  it('working defers where the docs say the change waits for the turn, and refuses elsewhere', () => {
    const deferred = plan('claude', 'effort', 'high', 'working');
    expect(sent(deferred).appliesAfterTurn).toBe(true);
    expect(settingChangeNotes(deferred).map((m) => m.key)).toEqual([
      SETTING_AFTER_TURN_KEY,
      SETTING_SAVES_DEFAULT_KEY,
    ]);
    expect(sent(plan('claude', 'fast', 'on', 'working')).appliesAfterTurn).toBe(true);
    expect(refusal(plan('hermes', 'effort', 'high', 'working'))).toEqual({
      kind: 'commandAwaitsIdle',
      name: 'reasoning',
    });
  });

  it('an unknown state waits for idle', () => {
    expect(refusal(plan('claude', 'effort', 'high', 'unknown'))).toEqual({
      kind: 'commandAwaitsIdle',
      name: 'effort',
    });
  });

  it('a command goes only into an empty box, never after a draft or unread', () => {
    const draft = refusal(plan('claude', 'effort', 'high', 'idle', { kind: 'text', text: 'wip' }));
    expect(draft.kind).toBe('inputNotReady');
    const dialog = refusal(
      plan('hermes', 'effort', 'high', 'idle', { kind: 'dialog', title: null }),
    );
    expect(dialog.kind).toBe('inputNotReady');
    expect(refusal(plan('claude', 'fast', 'on', 'idle', null)).kind).toBe('inputNotReady');
    // A picker only fills the terminal's draft: the user sends it there.
    expect(plan('claude', 'model', null, 'idle', null).kind).toBe('openTerminal');
  });
});

describe('how long a change lasts', () => {
  it('a Claude level is saved as the default, except its session-only max', () => {
    expect(sent(plan('claude', 'effort', 'high')).persists).toBe('default');
    expect(sent(plan('claude', 'effort', 'max')).persists).toBe('session');
    expect(settingChangeNotes(plan('claude', 'effort', 'max'))).toEqual([]);
    expect(sent(plan('hermes', 'effort', 'high')).persists).toBe('unstated');
  });

  it("fast mode on also says it uses usage credits; off says only that it's saved", () => {
    expect(settingChangeNotes(plan('claude', 'fast', 'on')).map((m) => m.key)).toEqual([
      SETTING_SAVES_DEFAULT_KEY,
      SETTING_USAGE_CREDITS_KEY,
    ]);
    expect(settingChangeNotes(plan('claude', 'fast', 'off')).map((m) => m.key)).toEqual([
      SETTING_SAVES_DEFAULT_KEY,
    ]);
  });
});

describe('a preview', () => {
  it('checks everything but the input box, which only a send reads', () => {
    const setting = programSettings('claude').find((s) => s.id === 'effort');
    if (!setting) throw new Error('claude lists no effort');
    const base = { program: 'claude', setting, value: 'high', policy: sendPolicyFor('claude') };
    expect(planSettingChange({ ...base, activity: 'idle' }).kind).toBe('send');
    expect(planSettingChange({ ...base, activity: 'idle', screen: null }).kind).toBe('refuse');
    expect(planSettingChange({ ...base, activity: 'blocked' }).kind).toBe('refuse');
  });
});

describe('an unverified program opens its picker or only shows the value', () => {
  it("the model goes to the program's own picker, in the program's submission", () => {
    expect(plan('claude', 'model', 'opus')).toEqual({
      kind: 'openTerminal',
      draft: { surface: 'terminal', text: '/model ' },
    });
    // OpenCode takes its commands bare.
    expect(plan('opencode', 'model', null, 'working')).toEqual({
      kind: 'openTerminal',
      draft: { surface: 'terminal', text: '/models' },
    });
    expect(plan('pi', 'effort', 'high').kind).toBe('openTerminal');
    expect(plan('grok', 'effort', null).kind).toBe('openTerminal');
  });

  it('read-only refuses with its reason', () => {
    expect(reasonKey(plan('codex', 'effort', 'high'))).toBe(SETTING_READ_ONLY_KEY);
    expect(reasonKey(plan('omp', 'effort', 'high', 'blocked'))).toBe(SETTING_READ_ONLY_KEY);
  });
});
