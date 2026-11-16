import {
  chatActivityOf,
  type ProgramSetting,
  type ProgramSettingID,
  planSettingChange,
  programSettings,
  refusalText,
  type SettingChangePlan,
  sendPolicyForAgent,
  settingChangeNotes,
  terminalPolicy,
} from '@openagentspocket/core';
import { isBlockedPaneApi } from '@openagentspocket/transport';
import { useMemo, useState } from 'react';
import { useConsoleStore } from '@/console/hooks';
import { renderMessage } from '@/usage/usageText';
import type { AgentComposer } from '../composer/composerContext';
import { useAgentScreenIO } from '../useAgentScreenIO';

/** A value chosen and not applied yet: the exact text and what it means, for the user to confirm. */
export interface PendingChange {
  readonly setting: ProgramSettingID;
  readonly value: string;
  readonly command: string;
  readonly notes: readonly string[];
}

export interface SettingChange {
  /** Why the setting cannot change now, as the row shows it; null when it can. */
  reason: (setting: ProgramSetting) => string | null;
  pending: PendingChange | null;
  /** Why the last choice or Apply did not go, as the sheet shows it; null when nothing refused. */
  refused: string | null;
  /** Shows what choosing `value` sends; sends nothing. */
  choose: (setting: ProgramSetting, value: string) => void;
  cancel: () => void;
  /** Sends the pending change through the Composer, after reading the input box again. */
  apply: () => Promise<void>;
  applying: boolean;
  /** Types the program's own picker into the terminal's draft and goes there. */
  changeInTerminal: (setting: ProgramSetting) => void;
}

const reasonOf = (plan: SettingChangePlan): string | null =>
  plan.kind === 'refuse' ? renderMessage(refusalText(plan.refusal)) : null;

/**
 * One conversation setting changed at a time, through `planSettingChange`: a choice shows the
 * command and its notes first, Apply re-plans against the screen read then and sends the text
 * through the Composer, a picker goes to the terminal's draft. No program is named here.
 */
export function useSettingChange(input: {
  composer: AgentComposer;
  program: string;
  /** Takes the user to the terminal in Compose, where the draft shows. */
  onToTerminal: () => void;
  /** The change left: close the sheet. */
  onDone: () => void;
}): SettingChange {
  const { composer, program, onToTerminal, onDone } = input;
  const consoleStore = useConsoleStore();
  const io = useAgentScreenIO(composer.hostId, composer.paneId);
  const policy = useMemo(() => sendPolicyForAgent(program), [program]);
  const activity = chatActivityOf(composer.snapshot.status);
  const [pending, setPending] = useState<PendingChange | null>(null);
  const [applying, setApplying] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);
  const preview = (setting: ProgramSetting, value: string | null) =>
    planSettingChange({ program, setting, value, activity, policy });
  const apply = async () => {
    const setting = programSettings(program).find((candidate) => candidate.id === pending?.setting);
    if (!pending || !setting) return;
    setApplying(true);
    try {
      // A Host that cannot read panes (the demo) sends without the box check, as Chat does.
      const canRead = await consoleStore
        .withTransport(composer.hostId, async (transport) => isBlockedPaneApi(transport))
        .catch(() => false);
      const screen = canRead ? await io.readScreen().catch(() => null) : undefined;
      const plan = planSettingChange({
        program,
        setting,
        value: pending.value,
        activity: chatActivityOf(composer.store.getSnapshot().status),
        policy,
        screen,
      });
      if (plan.kind !== 'send') {
        setRefused(reasonOf(plan));
        return;
      }
      const result = await composer.store.sendText(plan.draft.text, terminalPolicy);
      if (result.kind === 'refused') {
        setRefused(renderMessage(refusalText(result.refusal)));
        return;
      }
      setPending(null);
      onDone();
    } finally {
      setApplying(false);
    }
  };

  return {
    reason: (setting) => {
      const first = setting.options[0]?.value ?? null;
      return reasonOf(preview(setting, first));
    },
    pending,
    refused,
    choose: (setting, value) => {
      const plan = preview(setting, value);
      setRefused(null);
      if (plan.kind !== 'send') {
        setRefused(reasonOf(plan));
        return;
      }
      setPending({
        setting: setting.id,
        value,
        command: plan.draft.text,
        notes: settingChangeNotes(plan).map(renderMessage),
      });
    },
    cancel: () => {
      setPending(null);
      setRefused(null);
    },
    apply,
    applying,
    changeInTerminal: (setting) => {
      const plan = preview(setting, null);
      if (plan.kind !== 'openTerminal') return;
      composer.store.insertIntoDraft(plan.draft.text);
      onDone();
      onToTerminal();
    },
  };
}
