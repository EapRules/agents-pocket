// What `TerminalInputController` reports about a Paste: text reaches the pane directly only when
// it is a single safe line. Multi-line text waits for the user's review
// (its newlines would otherwise act as separate Enter presses), and text carrying control bytes
// (an escape sequence is a command to the remote terminal) is rejected outright.

export interface PasteReview {
  lineCount: number;
  characterCount: number;
  /** Bounded for display; the confirmed text is never truncated. */
  preview: string;
}

export type PasteRequestResult =
  | { kind: 'inserted' }
  | { kind: 'requiresReview'; review: PasteReview }
  | { kind: 'rejected' }
  | { kind: 'blocked' };
