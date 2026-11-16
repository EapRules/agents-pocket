import { agentKey, type ConsoleRow } from '@openagentspocket/core';
import { SplitView, useLayoutMode } from '@openagentspocket/ui';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { AgentDetailScreen } from '@/agent-detail/AgentDetailScreen';
import { COMPOSER_MORE_ANCHOR } from '@/agent-detail/composer/AgentComposer';
import { parseSurface } from '@/agent-detail/surface';
import { useAgent, useConsoleStore } from '@/console/hooks';
import { agentActions } from '@/features/agents/agentActions';
import { closeAgentItem } from '@/features/agents/closeAgent';
import { useHomeRoute } from '@/home/useHomeRoute';
import { useEntryMenus } from '@/navigation/entryMenus';
import { hrefs } from '@/navigation/hrefs';
import { deviceStorage } from '@/settings/deviceStorage';

export default function AgentRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    hostId: string;
    paneId: string;
    surface?: string;
    request?: string;
  }>();
  const row = useAgent(agentKey(params.hostId, params.paneId));
  const entries = useEntryMenus();
  const store = useConsoleStore();
  // Same route, other Agent: swap in place, with no push animation (the switcher and the list pane).
  const swap = (next: ConsoleRow) =>
    router.setParams({ hostId: next.hostId, paneId: next.agent.pane_id });
  // From `regular` up Home is the list pane beside the Agent (ADR 0029).
  const home = useHomeRoute({ onOpenAgent: swap });
  const compact = useLayoutMode() === 'compact';
  // A screen left under another stays mounted: each return to it counts as a visit.
  const [visit, setVisit] = useState(0);
  useFocusEffect(useCallback(() => setVisit((count) => count + 1), []));
  // The floating header's menu: Changes, Ports and New Agent here (Open is where the user already is).
  const items = row
    ? [
        ...entries.agent(row).filter((item) => item.key !== 'open'),
        closeAgentItem(row, agentActions(store), () => router.back(), {
          anchorKey: COMPOSER_MORE_ANCHOR,
        }),
      ]
    : [];
  const detail = (
    <AgentDetailScreen
      key={`${params.hostId}/${params.paneId}`}
      hostId={params.hostId}
      paneId={params.paneId}
      storage={deviceStorage}
      surface={parseSurface(params.surface)}
      surfaceRequest={params.request}
      menu={items}
      onHome={() => router.navigate('/')}
      visit={visit}
      onOpenChanges={() => router.push(hrefs.changesForAgent(params.hostId, params.paneId))}
      onSwitch={swap}
    />
  );
  // Always the split, the Agent alone in compact: opening or closing the device never remounts it.
  return <SplitView single={compact ? 'detail' : undefined} list={home} detail={detail} />;
}
