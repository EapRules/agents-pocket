import { DictationController, type DictationDraft, type SpeechEngine } from './dictation';

/** A draft the person can also type into, as the Composer's store is. */
function draft(initial = '') {
  let text = initial;
  const writes: string[] = [];
  const port: DictationDraft = {
    read: () => text,
    write: (next) => {
      text = next;
      writes.push(next);
    },
  };
  return { port, writes, text: () => text, type: (next: string) => (text = next) };
}

const unused = draft().port;

function engine(granted = true, language: string | null = 'en-US') {
  let events: Parameters<SpeechEngine['start']>[0] | undefined;
  const started: string[] = [];
  const fake: SpeechEngine = {
    requestPermission: async () => granted,
    language: async () => language,
    start: (handlers, lang) => {
      events = handlers;
      started.push(lang);
    },
    stop: () => events?.onEnd(),
  };
  return { fake, started, emit: () => events as NonNullable<typeof events> };
}

describe('dictation into the draft', () => {
  it('inserts each finished phrase, with a space after it', async () => {
    const { fake, emit } = engine();
    const target = draft();
    const dictation = new DictationController(fake, target.port);

    await dictation.toggle();
    expect(dictation.listening).toBe(true);
    emit().onFinal('fix the tests');
    emit().onFinal('   ');
    await dictation.toggle();

    expect(target.text()).toBe('fix the tests ');
    expect(dictation.listening).toBe(false);
  });

  it('shows words as they are heard, revised in place, until the phrase is final', async () => {
    const { fake, emit } = engine();
    const target = draft();
    const dictation = new DictationController(fake, target.port);
    await dictation.toggle();
    emit().onPartial('fix');
    emit().onPartial('fix the test');
    emit().onPartial('fix the tests');
    emit().onFinal('fix the tests');
    emit().onPartial('then');
    expect(target.writes).toEqual([
      'fix',
      'fix the test',
      'fix the tests',
      'fix the tests ',
      'fix the tests then',
    ]);
  });

  it('keeps what the person typed mid-phrase and writes after it', async () => {
    const { fake, emit } = engine();
    const target = draft();
    const dictation = new DictationController(fake, target.port);
    await dictation.toggle();
    emit().onPartial('fix the');
    target.type('fix the!');
    emit().onPartial('fix the tests');
    expect(target.text()).toBe('fix the! fix the tests');
    emit().onFinal('fix the tests now');
    expect(target.text()).toBe('fix the! fix the tests now ');
  });

  it('keeps the phrase it was hearing when stopped mid-phrase', async () => {
    const { fake, emit } = engine();
    const target = draft('Please ');
    const dictation = new DictationController(fake, target.port);
    await dictation.toggle();
    emit().onPartial('run the');
    await dictation.toggle();
    expect(dictation.listening).toBe(false);
    expect(target.text()).toBe('Please run the ');
  });

  it('keeps the phrase it was hearing when an error stops it', async () => {
    const { fake, emit } = engine();
    const target = draft();
    const failures: string[] = [];
    const dictation = new DictationController(fake, target.port, (reason) => failures.push(reason));
    await dictation.toggle();
    emit().onPartial('run the');
    emit().onError('network');
    expect(target.text()).toBe('run the ');
    expect(failures).toEqual(['stopped']);
    // A late result from the stopped session starts a new phrase instead of eating this one.
    emit().onPartial('later');
    expect(target.text()).toBe('run the later');
  });

  it('stops when its Agent is left', async () => {
    const { fake } = engine();
    const dictation = new DictationController(fake, unused);
    await dictation.toggle();
    dictation.stop();
    expect(dictation.listening).toBe(false);
  });

  it('never listens without permission, and tells the caller', async () => {
    const { fake } = engine(false);
    const failures: string[] = [];
    const dictation = new DictationController(fake, unused, (reason) => failures.push(reason));
    await dictation.toggle();
    expect(dictation.listening).toBe(false);
    expect(failures).toEqual(['permission']);
  });

  it('goes back to idle when the engine stops by itself, keeping what it heard', async () => {
    const { fake, emit } = engine();
    const target = draft();
    const failures: string[] = [];
    const dictation = new DictationController(fake, target.port, (reason) => failures.push(reason));
    await dictation.toggle();
    emit().onFinal('one');
    emit().onError('network');
    expect(dictation.listening).toBe(false);
    expect(target.text()).toBe('one ');
    expect(failures).toEqual(['stopped']);
  });

  it('starts in the language the engine picks', async () => {
    const { fake, started } = engine(true, 'es-MX');
    await new DictationController(fake, unused).toggle();
    expect(started).toEqual(['es-MX']);
  });

  it('never listens without a language to offer, and says so', async () => {
    const { fake, started } = engine(true, null);
    const failures: string[] = [];
    const dictation = new DictationController(fake, unused, (reason) => failures.push(reason));
    await dictation.toggle();
    expect(dictation.listening).toBe(false);
    expect(started).toEqual([]);
    expect(failures).toEqual(['language']);
  });

  it('names the reason the recognizer gives, and stays quiet when nothing went wrong', async () => {
    const cases: [string, string[]][] = [
      ['not-allowed', ['permission']],
      ['service-not-allowed', ['permission']],
      ['language-not-supported', ['language']],
      ['no-speech', []],
      ['aborted', []],
      ['audio-capture', ['stopped']],
    ];
    for (const [code, expected] of cases) {
      const { fake, emit } = engine();
      const failures: string[] = [];
      const dictation = new DictationController(fake, unused, (reason) => failures.push(reason));
      await dictation.toggle();
      emit().onError(code);
      expect(dictation.listening).toBe(false);
      expect(failures).toEqual(expected);
    }
  });
});
