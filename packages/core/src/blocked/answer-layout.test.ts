import { describe, expect, it } from 'vitest';
import '../chat/programs';
import { labScreen } from '../lab-captures.testkit';
import {
  approvalHeadline,
  genericAnswerRole,
  isApprovalDialog,
  splitAnswers,
} from './answer-layout';
import { type GoldenProgram, screenFixtures } from './golden-fixtures.testkit';
import { parseBlockedDialog } from './programs';
import type { DialogOption } from './types';

const PROGRAMS: readonly GoldenProgram[] = ['claude', 'codex', 'omp', 'grok', 'opencode'];

const byRole = (option: DialogOption) => option.role;

describe.each(PROGRAMS)('%s approvals against the captured screens', (program) => {
  const dialogs = screenFixtures(program).flatMap((fixture) => {
    const result = parseBlockedDialog(fixture.screen, program);
    return result.kind === 'dialog' ? [[fixture.name, result.dialog] as const] : [];
  });

  it.each(dialogs)(
    '%s: the pair is single-use only and the list keeps every option',
    (_, dialog) => {
      const layout = splitAnswers(dialog.options, byRole);
      if (layout.pair) {
        expect(layout.pair.approve.role).toBe('approve');
        expect(layout.pair.deny.role).toBe('decline');
        expect(layout.rest.every((option) => option.role !== 'approve')).toBe(true);
      }
      const shown = [
        ...(layout.pair ? [layout.pair.deny, layout.pair.approve] : []),
        ...layout.rest,
      ];
      expect(shown.map((option) => option.ordinal).sort((a, b) => a - b)).toEqual(
        dialog.options.map((option) => option.ordinal),
      );
      expect(layout.rest.map((option) => option.ordinal)).toEqual(
        [...layout.rest].sort((a, b) => a.ordinal - b.ordinal).map((option) => option.ordinal),
      );
    },
  );

  it.each(dialogs)('%s: a headline only for an approval, naming who acts', (_, dialog) => {
    const headline = approvalHeadline(dialog);
    if (!isApprovalDialog(dialog)) expect(headline).toBeNull();
    if (headline) expect(headline.actor).not.toBe('');
  });
});

describe('splitAnswers', () => {
  const role = (label: string) => genericAnswerRole(label);

  it('pairs exactly one single-use approve with exactly one decline, deny first', () => {
    expect(splitAnswers(['Yes', 'No'], role)).toEqual({
      pair: { deny: 'No', approve: 'Yes' },
      rest: [],
    });
    const three = ['Yes', "Yes, and don't ask again for git commands", 'No, and tell Claude (esc)'];
    expect(splitAnswers(three, role)).toEqual({
      pair: { deny: 'No, and tell Claude (esc)', approve: 'Yes' },
      rest: ["Yes, and don't ask again for git commands"],
    });
  });

  it('never puts a persistent or unfamiliar approval in the pair', () => {
    for (const label of [
      "Yes, and don't ask again",
      'Yes, allow all edits during this session',
      'Always allow',
      'Yes, and auto-accept edits',
      'Yes, sure',
    ]) {
      expect(genericAnswerRole(label), label).not.toBe('approve');
      expect(splitAnswers([label, 'No'], role).pair, label).toBeNull();
    }
  });

  it('keeps the list for two approvals or two declines', () => {
    expect(splitAnswers(['Yes', 'Allow once', 'No'], role).pair).toBeNull();
    expect(splitAnswers(['Yes', 'No', 'No, stop'], role).pair).toBeNull();
  });
});

// The generic card lays these captures out as a permission (GenericDialog `genericAnswers`).
describe('the generic card reads a Codex permission it cannot name', () => {
  const numbered = (name: string) => {
    const fixture = screenFixtures('codex').find((candidate) => candidate.name === name);
    const result = fixture && parseBlockedDialog(fixture.screen, 'codex');
    if (result?.kind !== 'unrecognized') throw new Error(`${name} should stay generic`);
    return [...result.excerpt.numbered.values()];
  };

  it.each([
    [
      'codex-15-x6-mcp-tool-list',
      ['approve', 'approvePersistent', 'approvePersistent', 'decline'],
      { deny: 'Cancel', approve: 'Allow' },
    ],
    [
      'codex-19-x3-implement-plan',
      ['approve', 'approveModeSwitch', 'decline'],
      { deny: 'No, stay in Plan mode', approve: 'Yes, implement this plan' },
    ],
  ] as const)('%s', (name, roles, pair) => {
    const labels = numbered(name);
    expect(labels.map(genericAnswerRole)).toEqual(roles);
    expect(splitAnswers(labels, genericAnswerRole).pair).toEqual(pair);
  });

  it('refuses a label whose reach it cannot tell', () => {
    for (const label of [
      'Allow edits',
      'Allow tool: probe_echo',
      'Approve',
      'Cancel this tool call',
      'Yes, implement and push',
      'Continue',
    ]) {
      expect(genericAnswerRole(label), label).toBeNull();
    }
  });
});

// The agent lab's titles (scripts/agent-lab.py SIM_PROGRAM BLOCKED_TITLE) and the approve flow's
// options (e2e/live/08) come from these captures.
describe('the lab captures as the card lays them out', () => {
  it.each([
    ['opencode', 'permission-shell', { actor: 'Shell', verb: 'run' }],
    ['codex', 'exec-approval', { actor: 'Codex', verb: 'run' }],
  ] as const)('%s %s', (program, name, headline) => {
    const parsed = parseBlockedDialog(labScreen(program, name), program);
    if (parsed.kind !== 'dialog') throw new Error('expected a dialog');
    expect(approvalHeadline(parsed.dialog)).toEqual(headline);
    const layout = splitAnswers(parsed.dialog.options, byRole);
    expect([layout.pair?.deny.ordinal, layout.pair?.approve.ordinal]).toEqual([3, 1]);
    expect(layout.rest.map((option) => [option.ordinal, option.role])).toEqual([
      [2, 'approvePersistent'],
    ]);
  });
});
