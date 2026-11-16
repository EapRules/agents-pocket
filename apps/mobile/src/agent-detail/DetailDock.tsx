import type { ConsoleRow } from '@openagentspocket/core';
import { statusDot } from '@/console/agentStatus';
import { useShownStatus } from '../blocked/BlockedCardProvider';
import { BlockedCardSlot } from '../blocked/BlockedCardSlot';
import { AgentBackgroundWork } from './background/AgentBackgroundWork';
import { AgentComposerBar } from './composer/AgentComposer';
import type { AgentComposer } from './composer/composerContext';
import { DockSlotView, useDetailUi } from './detailUi';
import { ConversationSettingsHost } from './settings/ConversationSettingsHost';
import { dockBar, type Surface } from './surface';

interface Props {
  row: ConsoleRow;
  /** Chat is on screen (alone, or beside the terminal). */
  chat: boolean;
  surface: Surface;
  /** The Agent's Composer: drawn unless the terminal's key toolbar is the bar (`dockBar`). */
  composer: AgentComposer;
  onToggleSurface: () => void;
}

/**
 * The bottom of the detail: the status line (Chat: what the Agent does and its Background Work),
 * the Blocked card (Chat), then one bar: what the surface hands the dock, or the Composer.
 */
export function DetailDock({ row, chat, surface, composer, onToggleSurface }: Props) {
  const status = statusDot(row.agent.agent_status);
  const shown = useShownStatus(status);
  const program = row.agent.agent ?? 'unknown';
  const { input, setInput } = useDetailUi();
  const bar = dockBar(surface, input);
  // A picker's draft waits in the Composer: the terminal opens in Compose, where it shows.
  const toTerminal = () => {
    if (surface === 'chat') onToggleSurface();
    setInput('compose');
  };
  return (
    <>
      {chat ? (
        <AgentBackgroundWork
          hostId={row.hostId}
          paneId={row.agent.pane_id}
          program={program}
          agent={shown === 'blocked' ? 'blocked' : shown === 'working' ? 'working' : 'idle'}
        />
      ) : null}
      {chat ? <BlockedCardSlot /> : null}
      {bar === 'keys' ? <DockSlotView /> : null}
      {bar === 'composer' ? (
        <AgentComposerBar
          composer={composer}
          surface={surface}
          program={program}
          projectRoot={row.agent.cwd ?? undefined}
          status={status}
          onToggleSurface={onToggleSurface}
        />
      ) : null}
      <ConversationSettingsHost composer={composer} program={program} onToTerminal={toTerminal} />
    </>
  );
}
