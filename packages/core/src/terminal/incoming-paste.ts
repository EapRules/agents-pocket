import { utf8Decode } from '../pairing/bytes';
import { BRACKETED_PASTE_END, BRACKETED_PASTE_START } from './text-safety';

// The terminal view reports typing and pasting through one callback. Typing arrives a key at a
// time; a paste arrives as one event carrying text (iOS: `insertText` -> `ghostty_surface_text`;
// Android: `sendPaste` and IME commits). This tells them apart without the view's help.

/** One input event from the terminal view, read as typing or as a paste. */
export type IncomingInput =
  | { readonly kind: 'typing'; readonly bytes: Uint8Array }
  | {
      readonly kind: 'paste';
      /** Exactly what the view sent, markers included; what goes out when no review is needed. */
      readonly bytes: Uint8Array;
      /** The pasted text, without bracketed-paste markers. */
      readonly text: string;
      readonly bracketed: boolean;
      /** A line break among other text: what makes a paste need review. */
      readonly lines: boolean;
    };

const isLineBreak = (byte: number) => byte === 0x0d || byte === 0x0a;
/** Printable ASCII or any byte of a multi-byte UTF-8 character. */
const isPrintable = (byte: number) => byte >= 0x20 && byte !== 0x7f;

/** A CR or LF together with at least one printable character; a lone Enter is not. */
export function carriesLines(bytes: Uint8Array): boolean {
  let lineBreak = false;
  let printable = false;
  for (const byte of bytes) {
    if (isLineBreak(byte)) lineBreak = true;
    else if (isPrintable(byte)) printable = true;
    if (lineBreak && printable) return true;
  }
  return false;
}

function startsWith(bytes: Uint8Array, prefix: Uint8Array): boolean {
  if (bytes.length < prefix.length) return false;
  return prefix.every((byte, index) => bytes[index] === byte);
}

function endsWith(bytes: Uint8Array, suffix: Uint8Array): boolean {
  const offset = bytes.length - suffix.length;
  if (offset < 0) return false;
  return suffix.every((byte, index) => bytes[offset + index] === byte);
}

function concat(parts: readonly Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

const FRAME = BRACKETED_PASTE_START.length + BRACKETED_PASTE_END.length;

/**
 * Classifies view input events. A paste is an event wrapped in bracketed-paste markers, or one
 * that carries a line break among other text; everything else is typing, byte for byte. On iOS
 * libghostty queues a bracketed paste as three writes (start marker, text, end marker), so an
 * event that opens a bracket is held until the one that closes it.
 */
export class IncomingInputClassifier {
  private held: Uint8Array[] | null = null;

  /** The event read as typing or paste; null while a bracketed paste is still arriving. */
  receive(bytes: Uint8Array): IncomingInput | null {
    if (this.held) {
      this.held.push(bytes);
      if (!endsWith(bytes, BRACKETED_PASTE_END)) return null;
      const whole = concat(this.held);
      this.held = null;
      return this.bracketed(whole);
    }
    if (startsWith(bytes, BRACKETED_PASTE_START)) {
      if (bytes.length >= FRAME && endsWith(bytes, BRACKETED_PASTE_END)) {
        return this.bracketed(bytes);
      }
      this.held = [bytes];
      return null;
    }
    if (carriesLines(bytes)) {
      const text = utf8Decode(bytes, true);
      if (text !== null) return { kind: 'paste', bytes, text, bracketed: false, lines: true };
    }
    return { kind: 'typing', bytes };
  }

  /** A session boundary: a bracket that never closed is dropped with its session. */
  reset(): void {
    this.held = null;
  }

  private bracketed(whole: Uint8Array): IncomingInput {
    const inner = whole.subarray(
      BRACKETED_PASTE_START.length,
      whole.length - BRACKETED_PASTE_END.length,
    );
    const text = utf8Decode(inner, true);
    if (text === null) return { kind: 'typing', bytes: whole };
    return { kind: 'paste', bytes: whole, text, bracketed: true, lines: carriesLines(inner) };
  }
}
