import type { ConsoleRow } from '@openagentspocket/core';
import { useIsFocused, useRouter } from 'expo-router';
import { crashStorage } from '@/diagnostics/crashStorage';
import { useAddHostSheet } from '@/features/hosts/useAddHostSheet';
import { hrefs } from '@/navigation/hrefs';
import { HomeScreen } from './HomeScreen';

/**
 * Home as a route mounts it: every navigation callback and the + sheet, wired once for `/` and for
 * the list pane beside an Agent. `onOpenAgent` replaces the push (the Agent route swaps in place).
 * Focus is the rendering route's, so a Home left under another route keeps its notices quiet; its
 * sheets open only from its own taps.
 */
export function useHomeRoute({
  onOpenAgent,
  selectedAgent,
}: {
  onOpenAgent?: (row: ConsoleRow) => void;
  /** The `agentKey` of the Agent open beside Home: its card shows as selected. */
  selectedAgent?: string;
} = {}) {
  const router = useRouter();
  const focused = useIsFocused();
  const addHost = useAddHostSheet({
    onEasyPair: () => router.push(hrefs.easyPair()),
    onAddManually: () => router.push(hrefs.hostForm()),
  });
  return (
    <>
      <HomeScreen
        crashStorage={crashStorage}
        focused={focused}
        selectedAgent={selectedAgent}
        onAddHost={addHost.open}
        onSetupGuide={() => router.push(hrefs.setupGuide())}
        onOpenSettings={() => router.push('/settings')}
        onOpenHost={(id) => router.push({ pathname: '/hosts/[id]', params: { id } })}
        onOpenAgent={
          onOpenAgent ?? ((row) => router.push(hrefs.agent(row.hostId, row.agent.pane_id)))
        }
        onNewAgent={() => router.push(hrefs.newAgent())}
        onNewTerminal={() => router.push('/new-terminal')}
        onOpenAgents={() => router.push('/agents')}
        onOpenSessions={() => router.push(hrefs.terminals())}
      />
      {addHost.sheet}
    </>
  );
}
