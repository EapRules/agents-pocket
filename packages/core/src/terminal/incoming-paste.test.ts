import { describe, expect, it } from 'vitest';
import { utf8Encode } from '../pairing/bytes';
import { carriesLines } from './incoming-paste';
import { TerminalInputController } from './input-controller';
import { BRACKETED_PASTE_END, BRACKETED_PASTE_START, encodePaste } from './text-safety';

function setup(options: { bracketedPasteIsReviewed?: boolean } = {}) {
  const writes: Uint8Array[] = [];
  const sources: string[] = [];
  const controller = new TerminalInputController({
    ...options,
    observeOutgoing: (_, source) => sources.push(source),
  });
  controller.beginSession({ write: (data) => writes.push(data), scroll: () => {} });
  return { controller, writes, sources };
}

const TYPING: Record<string, string> = {
  'a key': 'a',
  'the Enter key (CR)': '\r',
  'the Enter key (LF)': '\n',
  'CR LF alone': '\r\n',
  'Alt+Enter': '\u001b\r',
  'an arrow key': '\u001b[A',
  'an application-cursor arrow': '\u001bOA',
  'a kitty modifier encoding': '\u001b[13;2u',
  'Ctrl+C': '\u0003',
  Delete: '\u007f',
  'a device attributes reply': '\u001b[?62;22c',
  'a cursor position report': '\u001b[12;40R',
  'a focus report': '\u001b[I',
  'an SGR mouse report': '\u001b[<0;10;5M',
  'an OSC color reply': '\u001b]11;rgb:0000/0000/0000\u001b\\',
  'a dictation commit': 'list the files ',
  'an IME commit': '日本語',
};

describe('TerminalInputController incoming paste', () => {
  for (const [name, text] of Object.entries(TYPING)) {
    it(`passes ${name} through as typing, byte for byte`, () => {
      const { controller, writes, sources } = setup();
      const bytes = utf8Encode(text);
      expect(controller.send(bytes)).toBe(true);
      expect(writes).toEqual([bytes]);
      expect(sources).toEqual(['keystroke']);
      expect(controller.pendingPaste).toBeNull();
    });
  }

  it('sends a pasted word (one line, many characters) at once', () => {
    const { controller, writes } = setup();
    controller.send(utf8Encode('git status'));
    expect(writes).toEqual([utf8Encode('git status')]);
  });

  it('holds a multi-line event for review and sends nothing until confirmed', () => {
    const { controller, writes, sources } = setup();
    const text = 'cd /tmp\rrm -rf build\r';
    controller.send(utf8Encode(text));
    expect(controller.pendingPaste).toMatchObject({ lineCount: 3 });
    expect(writes).toEqual([]);
    expect(controller.confirmPaste()).toBe(true);
    expect(writes).toEqual([utf8Encode(text)]);
    expect(sources).toEqual(['paste']);
  });

  it('a cancelled review sends nothing', () => {
    const { controller, writes } = setup();
    controller.send(utf8Encode('one\ntwo'));
    controller.cancelPaste();
    expect(controller.confirmPaste()).toBe(false);
    expect(writes).toEqual([]);
  });

  it('recognizes a bracketed event and re-sends it with its markers once', () => {
    const { controller, writes } = setup();
    const framed = encodePaste('one\ntwo', true);
    controller.send(framed);
    expect(controller.pendingPaste?.preview).toBe('one\ntwo');
    controller.confirmPaste();
    expect(writes).toEqual([framed]);
  });

  it('joins a bracketed paste that arrives as three writes (iOS)', () => {
    const { controller, writes } = setup();
    controller.send(BRACKETED_PASTE_START);
    controller.send(utf8Encode('one\ntwo'));
    expect(writes).toEqual([]);
    controller.send(BRACKETED_PASTE_END);
    expect(controller.pendingPaste?.lineCount).toBe(2);
    controller.confirmPaste();
    expect(writes).toEqual([encodePaste('one\ntwo', true)]);
  });

  it('sends bracketed typing (one key, or Enter alone) unchanged and at once', () => {
    const { controller, writes } = setup();
    for (const key of ['a', '\n']) {
      controller.send(BRACKETED_PASTE_START);
      controller.send(utf8Encode(key));
      controller.send(BRACKETED_PASTE_END);
    }
    expect(writes).toEqual([encodePaste('a', true), encodePaste('\n', true)]);
    expect(controller.pendingPaste).toBeNull();
  });

  it('refuses a paste carrying control bytes and sends nothing', () => {
    const { controller, writes } = setup();
    controller.send(encodePaste('echo hi\u001b[31m\nls', true));
    controller.send(utf8Encode('rm\u0007\nls'));
    expect(writes).toEqual([]);
    expect(controller.pasteError).not.toBeNull();
    expect(controller.pendingPaste).toBeNull();
  });

  it('skips the review for a bracketed paste the view already asked about (Android)', () => {
    const { controller, writes, sources } = setup({ bracketedPasteIsReviewed: true });
    const framed = encodePaste('one\ntwo', true);
    controller.send(framed);
    expect(writes).toEqual([framed]);
    expect(sources).toEqual(['paste']);
    controller.send(utf8Encode('three\nfour'));
    expect(controller.pendingPaste?.lineCount).toBe(2);
  });

  it('drops a half-received bracket when the session ends', () => {
    const { controller, writes } = setup();
    const generation = controller.beginSession({
      write: (data) => writes.push(data),
      scroll: () => {},
    });
    controller.send(BRACKETED_PASTE_START);
    controller.endSession(generation);
    controller.beginSession({ write: (data) => writes.push(data), scroll: () => {} });
    controller.send(utf8Encode('a'));
    expect(writes).toEqual([utf8Encode('a')]);
  });

  it('reads a line break among text as lines, a lone Enter as not', () => {
    expect(carriesLines(utf8Encode('a\r'))).toBe(true);
    expect(carriesLines(utf8Encode('\r'))).toBe(false);
    expect(carriesLines(utf8Encode('\u001b\r'))).toBe(false);
    expect(carriesLines(utf8Encode('abc'))).toBe(false);
  });
});
