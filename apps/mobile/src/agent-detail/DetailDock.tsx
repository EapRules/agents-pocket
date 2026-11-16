import type { ConsoleRow } from '@openagentspocket/core';
import type { ReactNode } from 'react';
import { statusDot } from '@/console/agentStatus';
import { useShownStatus } from '../blocked/BlockedCardProvider';
import { BlockedCardSlot } from '../blocked/BlockedCardSlot';
import { AgentBackgroundWork } from './background/AgentBackgroundWork';
import { DockSlotView, useDetailUi } from './detailUi';
import { dockBar, type Surface } from './surface';

interface Props {
  row: ConsoleRow;
  /** Chat is on screen (alone, or beside the terminal). */
  chat: boolean;
  surface: Surface;
  /** The Composer: drawn unless the terminal's key toolbar is the bar (`dockBar`). */
  children: ReactNode;
}

/**
 * The bottom of the detail: the status line (Chat: what the Agent does and its Background Work),
 * the Blocked card (Chat), then one bar: what the surface hands the dock, or the Composer.
 */
export function DetailDock({ row, chat, surface, children }: Props) {
  const shown = useShownStatus(statusDot(row.agent.agent_status));
  const bar = dockBar(surface, useDetailUi().input);
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
      {bar === 'keys' ? <DockSlotView /> : null}
      {bar === 'composer' ? children : null}
    </>
  );
}
