import { type ClaudeSubagentRoute, subagentPrompt } from '@openagentspocket/core';
import type { SubagentPhase, SubagentRow } from '@openagentspocket/ui';
import { useCallback, useEffect, useState } from 'react';
import { subagentRows } from './subagentRows';
import { useConversationRegistry } from './useConversation';

export interface SubagentTranscriptState {
  phase: SubagentPhase;
  route: ClaudeSubagentRoute | null;
  /** What the Subagent was asked (markdown): its launch's, else its transcript's first message. */
  prompt: string | null;
  /** The timeline, without the message that repeats the prompt. */
  rows: SubagentRow[];
  /** Only the tail of a long transcript was read. */
  partial: boolean;
  failure?: string;
  retry: () => void;
}

const LOADING: Omit<SubagentTranscriptState, 'retry'> = {
  phase: 'loading',
  route: null,
  prompt: null,
  rows: [],
  partial: false,
};

/**
 * One Subagent's transcript of an Agent, read once while `agentId` is set (and again on `retry`).
 * Any surface can open it with the Agent and the id the reporting call carried.
 */
export function useSubagentTranscript(
  hostId: string,
  paneId: string,
  agentId: string | null,
): SubagentTranscriptState {
  const registry = useConversationRegistry();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<Omit<SubagentTranscriptState, 'retry'>>(LOADING);
  useEffect(() => {
    if (agentId === null || !registry) return;
    let live = true;
    void attempt;
    setState(LOADING);
    void registry.readSubagent(hostId, paneId, agentId).then(({ route, outcome }) => {
      if (!live) return;
      const base = { route, prompt: route?.prompt ?? null, rows: [], partial: false };
      switch (outcome.type) {
        case 'loaded': {
          const { prompt, entryID } = subagentPrompt(route, outcome.transcript, outcome.isPartial);
          setState({
            phase: 'loaded',
            route,
            prompt,
            rows: subagentRows(outcome.transcript).filter((row) => row.id !== entryID),
            partial: outcome.isPartial,
          });
          break;
        }
        case 'unreadable':
          setState({ ...base, phase: 'failed', failure: outcome.reason });
          break;
        default:
          setState({ ...base, phase: outcome.type });
      }
    });
    return () => {
      live = false;
    };
  }, [registry, hostId, paneId, agentId, attempt]);
  const retry = useCallback(() => setAttempt((count) => count + 1), []);
  return { ...state, retry };
}
