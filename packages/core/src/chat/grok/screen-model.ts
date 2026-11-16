// The model Grok Build names in its input box's bottom border (`╰── Grok 4.7 Fast (high) ─╯` in
// every 1.0.62 capture: the model's display name and, in brackets, its effort as Grok writes it).
// The border names other things while the box is in another state (a queued edit, shell mode,
// multiline input); then the model is not shown and reads as unknown.

import type { AnsiScreen } from '../../blocked/screen';
import { composerIsEditingQueued, composerIsMultiline, readGrokScreen } from './screen';

export function grokScreenModel(screen: AnsiScreen): string | null {
  const { composer, overlay, card } = readGrokScreen(screen);
  if (!composer || overlay !== null || card !== null || composer.mode !== 'prompt') return null;
  if (composerIsEditingQueued(composer) || composerIsMultiline(composer)) return null;
  return composer.bottomBorder === '' ? null : composer.bottomBorder;
}
