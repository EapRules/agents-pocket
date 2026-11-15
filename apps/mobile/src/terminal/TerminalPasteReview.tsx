import type { TerminalInputController } from '@openagentspocket/core';
import { ReviewPasteSheet } from '@openagentspocket/ui';
import { useSyncExternalStore } from 'react';
import { reviewPasteLabels } from './selectionLabels';

/**
 * The Review Paste sheet bound to a terminal's input path: a multi-line paste waits here until
 * the user confirms or cancels it. One mount for every terminal surface (Agent and Shell).
 */
export function TerminalPasteReview({ input }: { input: TerminalInputController }) {
  const { pendingPaste } = useSyncExternalStore(input.subscribe, input.getSnapshot);
  return (
    <ReviewPasteSheet
      preview={pendingPaste?.preview ?? null}
      labels={reviewPasteLabels(pendingPaste ?? { lineCount: 0, characterCount: 0 })}
      canConfirm
      onConfirm={() => input.confirmPaste()}
      onCancel={() => input.cancelPaste()}
    />
  );
}
