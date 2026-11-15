import {
  type ChatEntry,
  type ConversationState,
  type ConversationStore,
  divider,
  emptyTranscript,
  initialSnapshot,
  toolActivity,
  userMessage,
} from '@openagentspocket/core';
import type { ReactNode } from 'react';
import type { ConversationRegistry } from '@/conversations/ConversationRegistry';
import { ConversationsProvider } from '@/conversations/useConversation';
import { LONG_PROMPT, longWorkStateOf, work, workStateOf } from './atlasBackgroundWork';
import { FOLDED_CALLS } from './atlasChatCalls';
import { COMMAND_OUTPUT } from './atlasChatCommand';
import { withAgentMessage } from './atlasChatMessage';
import { ATLAS_NOW } from './atlasClock';

const at = (secondsAgo: number) => new Date(ATLAS_NOW - secondsAgo * 1000).toISOString();

const ENTRIES: ChatEntry[] = [
  {
    id: 'u1',
    sourceOffset: 0,
    content: {
      type: 'user',
      value: userMessage(
        'The Attach toolbar feels crowded on small phones. Can you tighten it up without hiding anything people use often?',
      ),
    },
  },
  {
    id: 'r1',
    sourceOffset: 1,
    content: {
      type: 'reasoning',
      value: {
        text: 'Checking which controls the bar shows at each width.',
        durationMilliseconds: 4000,
      },
    },
  },
  {
    id: 't1',
    sourceOffset: 2,
    content: {
      type: 'tool',
      value: toolActivity({
        kind: 'command',
        name: 'Bash',
        title: 'swift test --filter AttachViewTests',
        status: 'succeeded',
      }),
    },
  },
  {
    id: 'a1',
    sourceOffset: 3,
    content: {
      type: 'assistant',
      value: {
        text: [
          'The toolbar now fits on the smallest phones.',
          '',
          '- **Send** and **Keys** stay in the bar at every width.',
          '- **Paste**, **Snippets** and **Clear** move into a **More** menu when the bar runs out of room.',
          '- Wider screens keep every control in the bar, as before.',
          '',
          '`AttachViewTests` passes (24 tests).',
        ].join('\n'),
      },
    },
  },
  { id: 'd1', sourceOffset: 4, content: { type: 'divider', value: divider('compaction') } },
  {
    id: 'u2',
    sourceOffset: 5,
    content: {
      type: 'user',
      value: userMessage('Now check the toolbar at the largest text size.'),
    },
  },
  {
    id: 'r2',
    sourceOffset: 6,
    content: {
      type: 'reasoning',
      value: {
        text: 'Running the snapshot tests at the accessibility sizes.',
        durationMilliseconds: 4000,
      },
    },
  },
  ...FOLDED_CALLS,
  {
    id: 'a3',
    sourceOffset: 12,
    content: {
      type: 'assistant',
      value: { text: 'The label fits now. Running the snapshots at the accessibility sizes.' },
    },
  },
  {
    id: 't2',
    sourceOffset: 13,
    content: {
      type: 'tool',
      value: toolActivity({
        kind: 'command',
        name: 'Bash',
        title: 'Run the toolbar snapshots at the accessibility sizes',
        purpose: 'Run the toolbar snapshots at the accessibility sizes',
        command:
          'cd Packages/Attach && swift test --filter AttachToolbarSnapshotTests 2>&1 | tail -n 40',
        status: 'failed',
        exitCode: 1,
      }),
    },
  },
  {
    id: 'a2',
    sourceOffset: 14,
    content: {
      type: 'assistant',
      value: {
        text: "At the largest size the **More** label wraps. I'm switching it to an icon in that layout and running the snapshots again.",
      },
    },
  },
];

const state: ConversationState = {
  snapshot: {
    ...initialSnapshot(),
    phase: { type: 'following', path: '/demo/session.jsonl' },
    transcript: {
      ...emptyTranscript(),
      entries: ENTRIES,
      turns: [
        { firstEntryID: 'u1', startedAt: at(600), endedAt: at(574), ending: 'completed' },
        { firstEntryID: 'u2', startedAt: at(105), endedAt: null, ending: null },
      ],
    },
  },
  workflowProgress: {},
  outputs: new Map(),
  version: 1,
};

/** Searching for the transcript with a failed read: the read-failure line over the centered wait. */
const lookingState: ConversationState = {
  ...state,
  snapshot: {
    ...initialSnapshot(),
    phase: { type: 'locating' },
    readFailure: { kind: 'timedOut' },
  },
};

const storeFor = (conversation: ConversationState) =>
  ({
    subscribe: () => () => undefined,
    getState: () => conversation,
    show: () => undefined,
    hide: () => undefined,
    loadOlder: () => undefined,
    loadOutput: () => undefined,
    retry: () => undefined,
    updateSends: () => undefined,
    sendConcern: () => null,
    inputBoxWasRead: () => undefined,
  }) as unknown as ConversationStore;

/** A finished Subagent's own transcript: its task, a tool call and its answer. */
const subagentTranscript = {
  ...emptyTranscript(),
  entries: [
    {
      id: 's1',
      sourceOffset: 0,
      content: {
        type: 'user' as const,
        value: userMessage('Check whether the screenshots still show the address field.'),
      },
    },
    {
      id: 's2',
      sourceOffset: 1,
      content: {
        type: 'tool' as const,
        value: toolActivity({
          kind: 'search',
          name: 'Grep',
          title: 'Searched for "address field" in docs/guide',
          status: 'succeeded',
        }),
      },
    },
    {
      id: 's3',
      sourceOffset: 2,
      content: {
        type: 'assistant' as const,
        value: {
          text: 'Two screenshots still show the address field: **setup-2.png** and **setup-3.png**.',
        },
      },
    },
  ],
};

/** `prompt`: what the launch asked, as a background Subagent's route carries it; else the transcript's first message stands in. */
const registryFor = (conversation: ConversationState, prompt: string | null = null) =>
  ({
    get: () => storeFor(conversation),
    readSubagent: async (_host: string, _pane: string, agentID: string) => ({
      route: {
        agentID,
        path: `/demo/subagents/${agentID}.jsonl`,
        title: 'Check screenshots',
        subtitle: 'general-purpose',
        prompt,
      },
      outcome: { type: 'loaded' as const, transcript: subagentTranscript, isPartial: false },
    }),
  }) as unknown as ConversationRegistry;

/** The Blocked card's screen: one Subagent running, condensed to a line over the card. */
const blockedWorkState: ConversationState = {
  ...state,
  snapshot: {
    ...state.snapshot,
    transcript: {
      ...state.snapshot.transcript,
      backgroundWork: [
        work('w1', 'Find other retry callers', { subtitle: 'Explore', launchedAgo: 30 }),
      ],
    },
  },
};

/** The first turn, then `/context` sent from Chat while idle. */
const commandState: ConversationState = {
  ...state,
  snapshot: {
    ...state.snapshot,
    transcript: {
      ...state.snapshot.transcript,
      entries: [...ENTRIES.slice(0, 4), COMMAND_OUTPUT],
      turns: state.snapshot.transcript.turns.slice(0, 1),
    },
  },
};

/** The Agent idle after its first turn while one Subagent it started still runs. */
const idleWorkState: ConversationState = {
  ...commandState,
  snapshot: {
    ...commandState.snapshot,
    transcript: {
      ...commandState.snapshot.transcript,
      entries: ENTRIES.slice(0, 4),
      backgroundWork: [
        work('w1', 'Find other retry callers', { subtitle: 'Explore', launchedAgo: 30 }),
      ],
    },
  },
};

const registry = registryFor(state);
const commandRegistry = registryFor(commandState);
const workRegistry = registryFor(workStateOf(state));
const longWorkRegistry = registryFor(longWorkStateOf(state), LONG_PROMPT);
const blockedWorkRegistry = registryFor(blockedWorkState);
const idleWorkRegistry = registryFor(idleWorkState);
const lookingRegistry = registryFor(lookingState);
const messageRegistry = registryFor(withAgentMessage(state));

export type AtlasBackground = 'list' | 'long' | 'blocked' | 'idleWork' | 'command' | 'message';

const BACKGROUND_REGISTRIES: Record<AtlasBackground, ConversationRegistry> = {
  list: workRegistry,
  long: longWorkRegistry,
  blocked: blockedWorkRegistry,
  idleWork: idleWorkRegistry,
  command: commandRegistry,
  message: messageRegistry,
};

/** Gives the atlas a scripted conversation, so Chat renders as it does mid-session. */
export function AtlasChat({
  children,
  looking = false,
  background,
}: {
  children: ReactNode;
  /** The conversation is still being located and the last read failed (chat-banners). */
  looking?: boolean;
  /**
   * Background Work over the Composer (`long`: a dozen finished, Subagents with a long prompt;
   * `idleWork`: the Agent idle, one Subagent running), or in place of it a local command's output
   * or a Subagent's report.
   */
  background?: AtlasBackground;
}) {
  const scripted = looking
    ? lookingRegistry
    : background
      ? BACKGROUND_REGISTRIES[background]
      : registry;
  return <ConversationsProvider registry={scripted}>{children}</ConversationsProvider>;
}
