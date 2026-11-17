/** The draft as dictation leaves it, and the provisional text it wrote at its end (empty when none). */
export interface DictatedDraft {
  draft: string;
  provisional: string;
}

/** What the recognizer heard: the phrase so far (revised by the next one) or a finished phrase. */
export interface Heard {
  text: string;
  final: boolean;
}

/** The draft without the provisional text, when it still ends with it; else the draft as it stands. */
function kept(draft: string, provisional: string): string {
  return provisional !== '' && draft.endsWith(provisional)
    ? draft.slice(0, draft.length - provisional.length)
    : draft;
}

/**
 * Dictation writes only at the end of the draft. The provisional phrase is replaced in place while
 * the draft still ends with it; once the person typed or edited past it, what is there stays and
 * the new text follows. A finished phrase stays, followed by a space, and clears the provisional.
 * Text the person can see is never deleted: a result with no words changes nothing on screen.
 */
export function applyDictation(draft: string, provisional: string, heard: Heard): DictatedDraft {
  const phrase = heard.text.trim();
  if (phrase === '') {
    return heard.final ? settleDictation(draft, provisional) : { draft, provisional };
  }
  const base = kept(draft, provisional);
  const gap = base === '' || /\s$/.test(base) ? '' : ' ';
  const written = gap + phrase + (heard.final ? ' ' : '');
  return { draft: base + written, provisional: heard.final ? '' : written };
}

/**
 * Dictation stopped (by the person, by itself or by an error): the provisional phrase stays as if
 * it had finished, followed by a space, unless the person already wrote past it.
 */
export function settleDictation(draft: string, provisional: string): DictatedDraft {
  if (provisional === '' || !draft.endsWith(provisional)) return { draft, provisional: '' };
  return { draft: `${draft} `, provisional: '' };
}
