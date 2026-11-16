import type { ConsoleRow } from '@openagentspocket/core';
import { statusDot } from '@/console/agentStatus';
import { useShownStatus } from '../blocked/BlockedCardProvider';
import { BlockedCardSlot } from '../blocked/BlockedCardSlot';
import { AgentBackgroundWork } from './background/AgentBackgroundWork';
import { DockSlotView } from './detailUi';

interface Props {
  row: ConsoleRow;
  /** Chat is on screen (alone, or beside the terminal). */
  chat: boolean;
}

/**
 * What sits over the Composer: the status line (Chat: what the Agent does and its Background Work),
 * the Blocked card (Chat), then what the surface hands the dock.
 */
export function DetailDock({ row, chat }: Props) {
  const shown = useShownStatus(statusDot(row.agent.agent_status));
  return (
    <>
      {chat ? (
        <AgentBackgroundWork
          hostId={row.hostId}
          paneId={row.agent.pane_id}
          agent={shown === 'blocked' ? 'blocked' : shown === 'working' ? 'working' : 'idle'}
        />
      ) : null}
      {chat ? <BlockedCardSlot /> : null}
      <DockSlotView />
    </>
  );
}
