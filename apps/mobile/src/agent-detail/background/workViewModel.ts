import {
  type BackgroundWorkAgent,
  type BackgroundWorkPresentedRow,
  type ChatStatusLine,
  isFinishedStatus,
  type Text,
} from '@openagentspocket/core';
import { t } from '@openagentspocket/i18n';
import type {
  BackgroundWorkAgentItem,
  BackgroundWorkDetailItem,
  StatusLineProps,
} from '@openagentspocket/ui';
import { renderMessage } from '@/lib/renderText';

const words = (text: Text | null): string | undefined =>
  text === null ? undefined : renderMessage(text);

function agentItem(agent: BackgroundWorkAgent, index: number): BackgroundWorkAgentItem {
  return {
    id: agent.id,
    state: agent.status,
    label: agent.label === '' ? t('Agent %lld', index + 1) : agent.label,
    phase: agent.phase ?? undefined,
  };
}

/**
 * What a row says beyond its kind: a Workflow's description or phase, a described command's line.
 * Nothing for a Subagent, whose type is its kind.
 */
function detailOf(row: BackgroundWorkPresentedRow): string | undefined {
  if (row.detail) return row.detail;
  if (row.kind === 'subagent') return undefined;
  const caption = renderMessage(row.caption);
  return caption === renderMessage(row.kindLabel) ? undefined : caption;
}

/** A sheet row: the work, its kind and state on one line, how far along, and what it cost. */
export function detailItem(row: BackgroundWorkPresentedRow): BackgroundWorkDetailItem {
  const finished = isFinishedStatus(row.status);
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    monospaced: row.monospaced,
    state: row.status,
    caption: `${renderMessage(row.kindLabel)} · ${renderMessage(row.stateLabel)}`,
    detail: detailOf(row),
    fraction: row.fraction ?? undefined,
    // While it runs, a Workflow can start more agents.
    fractionText: row.fraction
      ? finished
        ? t('%lld of %lld agents done', row.fraction.done, row.fraction.total)
        : t('%lld of %lld agents done so far', row.fraction.done, row.fraction.total)
      : undefined,
    usage: words(row.usage),
    agents: row.agents.map(agentItem),
    accessibilityLabel: renderMessage(row.accessibilityLabel),
  };
}

/**
 * A sheet row whose finished Subagent's transcript it can open, when `subagentIdOf` names one (the
 * program reads Subagent transcripts and the launch named it). Otherwise the row shows no action.
 */
export function openableItem(
  row: BackgroundWorkPresentedRow,
  subagentIdOf: (workId: string) => string | null,
  open: (agentId: string) => void,
): BackgroundWorkDetailItem {
  const item = detailItem(row);
  const agentId =
    row.kind === 'subagent' && isFinishedStatus(row.status) ? subagentIdOf(row.id) : null;
  if (agentId === null) return item;
  return { ...item, action: { label: t('View Transcript'), onPress: () => open(agentId) } };
}

/** The status line over the Composer, in the current locale. */
export function statusLineItem(
  line: ChatStatusLine,
): Pick<StatusLineProps, 'state' | 'text' | 'accessibilityValue'> {
  return {
    state: line.state,
    text: renderMessage(line.text),
    accessibilityValue: renderMessage(line.accessibilityValue),
  };
}
