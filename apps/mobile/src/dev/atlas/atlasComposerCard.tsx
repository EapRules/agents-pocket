// Atlas entries that draw the Composer card alone over Chat: drafts, panels and dictation.
import { ComposerCard, type ComposerCardProps } from '@openagentspocket/ui';
import { Stack } from 'expo-router';
import { agentBarLabels } from '@/agent-detail/agentBarLabels';
import { AtlasChat } from './atlasChat';
import { noop } from './atlasHelpers';
import type { AtlasEntry } from './entries';

/** The card over the demo Chat, in the current locale's words. */
function card(props: Partial<ComposerCardProps> & { value: string }): AtlasEntry {
  return {
    render: () => (
      <AtlasChat>
        <Stack.Screen options={{ headerShown: false }} />
        <ComposerCard onChange={noop} onSend={noop} labels={agentBarLabels()} {...props} />
      </AtlasChat>
    ),
  };
}

const listening = { listening: true, onToggle: noop };

export const composerCardEntries: Readonly<Record<string, AtlasEntry>> = {
  /** A draft of about four lines: the stacked field grows with it. */
  'rn.composer-long-draft': card({
    value:
      'Please look at the failing build.\nStart with the lockfile.\nThen check the CI cache keys.\nReport what you changed.',
    expanded: true,
  }),
  /** A draft past six lines: the field stops at its cap and scrolls inside. */
  'rn.composer-very-long-draft': card({
    value: Array.from(
      { length: 12 },
      (_, index) => `Step ${index + 1}: describe what to change.`,
    ).join('\n'),
    expanded: true,
  }),
  /** The `/` panel over thirty entries: it stops at a share of the screen and its rows scroll. */
  'rn.composer-skill-list': card({
    value: '/',
    skills: Array.from({ length: 30 }, (_, index) => ({
      name: `/skill-${String(index + 1).padStart(2, '0')}`,
      description: `Atlas skill number ${index + 1}.`,
    })),
  }),
  /** Dictation just started: the microphone reads as recording, the empty input says it listens. */
  'rn.composer-listening': card({ value: '', dictation: listening }),
  /** Dictation under way: the words heard so far fill the draft, the microphone keeps Send's place. */
  'rn.composer-listening-draft': card({ value: 'Run the tests and fix the', dictation: listening }),
};
