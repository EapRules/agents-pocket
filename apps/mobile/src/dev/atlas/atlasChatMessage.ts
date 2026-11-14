import { type ConversationState, notice } from '@openagentspocket/core';

/** A Subagent's final report, handed back into the running turn: the line, and the sheet it opens. */
const REPORT = [
  'Checked every setup screenshot against the current Pairing screen. **Two are out of date.**',
  '',
  '## Out of date',
  '- `setup-2.png` still shows the address field the QR code replaced.',
  '- `setup-3.png` shows the old **Connect** button.',
  '',
  '## Still right',
  '- `setup-1.png`, `setup-4.png` and `setup-5.png` match the app.',
  '',
  'Nothing changed: this was read-only.',
].join('\n');

/** The conversation with a Subagent's report as the newest entry of the running turn. */
export function withAgentMessage(state: ConversationState): ConversationState {
  const { transcript } = state.snapshot;
  return {
    ...state,
    snapshot: {
      ...state.snapshot,
      transcript: {
        ...transcript,
        entries: [
          ...transcript.entries,
          {
            id: 'm1',
            sourceOffset: 15,
            content: {
              type: 'notice',
              value: notice('agentMessage', 'Check screenshots', {
                detail: REPORT,
                detailFormat: 'markdown',
                from: { name: 'Check screenshots', isSubagent: true },
              }),
            },
          },
        ],
      },
    },
  };
}
