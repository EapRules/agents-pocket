import { DictationController, type SpeechEngine } from './dictation';

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
    const inserted: string[] = [];
    const dictation = new DictationController(fake, (text) => inserted.push(text));

    await dictation.toggle();
    expect(dictation.listening).toBe(true);
    emit().onFinal('fix the tests');
    emit().onFinal('   ');
    await dictation.toggle();

    expect(inserted).toEqual(['fix the tests ']);
    expect(dictation.listening).toBe(false);
  });

  it('stops when its Agent is left', async () => {
    const { fake } = engine();
    const dictation = new DictationController(fake, () => {});
    await dictation.toggle();
    dictation.stop();
    expect(dictation.listening).toBe(false);
  });

  it('never listens without permission, and tells the caller', async () => {
    const { fake } = engine(false);
    const failures: string[] = [];
    const dictation = new DictationController(
      fake,
      () => {},
      (reason) => failures.push(reason),
    );
    await dictation.toggle();
    expect(dictation.listening).toBe(false);
    expect(failures).toEqual(['permission']);
  });

  it('goes back to idle when the engine stops by itself, keeping what it heard', async () => {
    const { fake, emit } = engine();
    const inserted: string[] = [];
    const failures: string[] = [];
    const dictation = new DictationController(
      fake,
      (text) => inserted.push(text),
      (reason) => failures.push(reason),
    );
    await dictation.toggle();
    emit().onFinal('one');
    emit().onError('network');
    expect(dictation.listening).toBe(false);
    expect(inserted).toEqual(['one ']);
    expect(failures).toEqual(['stopped']);
  });

  it('starts in the language the engine picks', async () => {
    const { fake, started } = engine(true, 'es-MX');
    await new DictationController(fake, () => {}).toggle();
    expect(started).toEqual(['es-MX']);
  });

  it('never listens without a language to offer, and says so', async () => {
    const { fake, started } = engine(true, null);
    const failures: string[] = [];
    const dictation = new DictationController(
      fake,
      () => {},
      (reason) => failures.push(reason),
    );
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
      const dictation = new DictationController(
        fake,
        () => {},
        (reason) => failures.push(reason),
      );
      await dictation.toggle();
      emit().onError(code);
      expect(dictation.listening).toBe(false);
      expect(failures).toEqual(expected);
    }
  });
});
