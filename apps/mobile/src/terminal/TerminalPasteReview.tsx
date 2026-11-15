import type { TerminalInputController } from '@openagentspocket/core';
import { ReviewPasteSheet, toast } from '@openagentspocket/ui';
import { useEffect, useSyncExternalStore } from 'react';
import { reviewPasteLabels, terminalSheetTitles } from './selectionLabels';

/**
 * The Review Paste sheet bound to a terminal's input path: a multi-line paste waits here until
 * the user confirms or cancels it, and a refused one says so. One mount for every terminal
 * surface (Agent and Shell).
 */
export function TerminalPasteReview({ input }: { input: TerminalInputController }) {
  const { pendingPaste, pasteError } = useSyncExternalStore(input.subscribe, input.getSnapshot);
  useEffect(() => {
    if (!pasteError) return;
    const titles = terminalSheetTitles();
    toast({
      title: titles.pasteBlocked,
      message: titles.pasteBlockedMessage,
      tone: 'warning',
      icon: 'warning',
    });
    input.clearPasteError();
  }, [input, pasteError]);
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
