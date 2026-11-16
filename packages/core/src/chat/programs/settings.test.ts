// Every program's conversation settings: the lists hold together, and each read takes the value
// from where the program keeps it, `unknown` when nothing says it. Records are hand-written in each
// program's own shape (see each reader's comment for the version it was seen in).

import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { decodeAnsiScreen } from '../../blocked/ansi-decoder';
import { loadScreen } from '../../blocked/golden-fixtures.testkit';
import { encodeUtf8 } from '../../events/utf8';
import { ClaudeTranscriptReducer } from '../claude/reducer';
import { RolloutBuilder } from '../codex/test-builder';
import { capture, grokScreen } from '../grok/screen.testkit';
import { HermesTranscriptReducer } from '../hermes/reducer';
import { frameLines } from '../model/lines';
import {
  CHAT_PROGRAMS,
  type ChatTranscript,
  emptyTranscript,
  projectionContext,
} from '../model/types';
import { row, rowLine } from '../opencode/record-source.testkit';
import { OpenCodeTranscriptReducer } from '../opencode/reducer';
import {
  footerCovered,
  programCommands,
  programSettings,
  readConversationSettings,
  SETTING_AFTER_TURN_KEY,
  SETTING_READ_ONLY_KEY,
  SETTING_SAVES_DEFAULT_KEY,
  SETTING_VALUE_NOT_OFFERED_KEY,
} from './index';
import type { ProgramSettingID } from './settings';

const I18N = fileURLToPath(new URL('../../../../i18n/src/', import.meta.url));
const json = (path: string): Record<string, string> =>
  JSON.parse(readFileSync(`${I18N}${path}`, 'utf8')) as Record<string, string>;

/** The keys `t()` resolves in a language: the Swift catalogs and the app extras. */
function keysIn(language: 'en' | 'es'): Set<string> {
  const catalogs = readdirSync(`${I18N}catalogs/${language}`).filter((f) => f.endsWith('.json'));
  return new Set([
    ...Object.keys(json(`extras/${language}.json`)),
    ...catalogs.flatMap((file) => Object.keys(json(`catalogs/${language}/${file}`))),
  ]);
}

describe('every program lists settings that hold together', () => {
  it('resolves every title in English and Spanish', () => {
    const keys = [
      SETTING_READ_ONLY_KEY,
      SETTING_VALUE_NOT_OFFERED_KEY,
      SETTING_AFTER_TURN_KEY,
      SETTING_SAVES_DEFAULT_KEY,
      ...CHAT_PROGRAMS.flatMap((program) =>
        programSettings(program).flatMap((s) => [s.title, ...s.options.map((o) => o.title)]),
      ).map((title) => title.key),
    ];
    for (const language of ['en', 'es'] as const) {
      const known = keysIn(language);
      expect(keys.filter((key) => !known.has(key))).toEqual([]);
    }
  });

  it('opens only a picker the program lists, and sends only a command it lists', () => {
    for (const program of CHAT_PROGRAMS) {
      const listed = new Set(programCommands(program).map((c) => c.command));
      for (const { apply } of programSettings(program)) {
        if (apply.kind !== 'none')
          expect(listed, `${program} ${apply.command}`).toContain(apply.command);
      }
    }
  });

  it('never writes a model, and a toggle is exactly on and off', () => {
    for (const program of CHAT_PROGRAMS) {
      for (const setting of programSettings(program)) {
        if (setting.id === 'model') expect(setting.apply.kind).not.toBe('command');
        if (setting.kind === 'toggle') {
          expect(setting.options.map((o) => o.value)).toEqual(['on', 'off']);
        }
        if (setting.apply.kind === 'command') expect(setting.options.length).toBeGreaterThan(0);
      }
      expect(new Set(programSettings(program).map((s) => s.id)).size).toBe(
        programSettings(program).length,
      );
    }
  });

  it('writes by command only where the documentation gives the argument form', () => {
    const written = CHAT_PROGRAMS.flatMap((program) =>
      programSettings(program)
        .filter((s) => s.apply.kind === 'command')
        .map((s) => `${program}:${s.id}`),
    );
    expect(written).toEqual(['claude:effort', 'claude:fast', 'hermes:effort']);
  });

  it('lists nothing for a program Chat does not know', () => {
    expect(programSettings('unknown-agent')).toEqual([]);
    expect(programSettings(null)).toEqual([]);
  });
});

type Read = Partial<Record<ProgramSettingID, string | null>>;

/** Each setting's value, null for unknown. */
function read(
  program: string,
  transcript: ChatTranscript | null,
  screen: ReturnType<typeof decodeAnsiScreen> | null = null,
): Read {
  return Object.fromEntries(
    readConversationSettings({ program, transcript, screen }).map(({ setting, value }) => [
      setting.id,
      value.kind === 'known' ? value.value : null,
    ]),
  );
}

const IDLE = projectionContext({ activity: 'idle' });

describe('Claude Code reads the newest main-thread reply', () => {
  const reply = (uuid: string, extra: string, model = 'claude-opus-5-5') =>
    `{"type":"assistant","uuid":"${uuid}","parentUuid":null,"message":{"id":"m-${uuid}","role":"assistant","model":"${model}","content":[{"type":"text","text":"Hi."}],"usage":{"input_tokens":5,"output_tokens":2${extra}}}${uuid === 'a3' ? ',"isSidechain":true' : ''},"effort":"${uuid === 'a1' ? 'medium' : 'high'}"}`;

  const transcript = (...records: string[]) => {
    const reducer = new ClaudeTranscriptReducer();
    reducer.append(frameLines(encodeUtf8(`${records.join('\n')}\n`)));
    return reducer.transcript(IDLE);
  };

  it('model, effort and speed from the last reply', () => {
    expect(read('claude', transcript(reply('a1', ',"speed":"standard"')))).toEqual({
      model: 'claude-opus-5-5',
      effort: 'medium',
      fast: 'off',
    });
    expect(
      read(
        'claude',
        transcript(reply('a1', ',"speed":"standard"'), reply('a2', ',"speed":"fast"')),
      ),
    ).toEqual({ model: 'claude-opus-5-5', effort: 'high', fast: 'on' });
  });

  it('skips a Subagent reply and a made-up one', () => {
    const settings = read(
      'claude',
      transcript(
        reply('a1', ',"speed":"standard"'),
        reply('a3', ',"speed":"fast"', 'claude-haiku-5-5'),
        reply('a4', '', '<synthetic>'),
      ),
    );
    expect(settings).toEqual({ model: 'claude-opus-5-5', effort: 'medium', fast: 'off' });
  });

  it('unknown without a reply, and a speed it does not know is unknown', () => {
    expect(read('claude', emptyTranscript())).toEqual({ model: null, effort: null, fast: null });
    expect(read('claude', null)).toEqual({ model: null, effort: null, fast: null });
    expect(read('claude', transcript(reply('a1', ',"speed":"turbo"'))).fast).toBeNull();
  });
});

describe('Codex reads the newest turn_context', () => {
  it('model and effort', () => {
    const b = new RolloutBuilder();
    b.record('turn_context', { cwd: '/work', model: 'gpt-a', effort: 'low' });
    b.turnStarted('t1');
    b.record('turn_context', { cwd: '/work', model: 'gpt-b', effort: 'xhigh' });
    expect(read('codex', b.reducer().transcript(IDLE))).toEqual({
      model: 'gpt-b',
      effort: 'xhigh',
    });
  });

  it('unknown before any turn and for a field it does not carry', () => {
    expect(read('codex', new RolloutBuilder().reducer().transcript(IDLE))).toEqual({
      model: null,
      effort: null,
    });
    const b = new RolloutBuilder();
    b.record('turn_context', { cwd: '/work', model: 'gpt-a' });
    expect(read('codex', b.reducer().transcript(IDLE))).toEqual({ model: 'gpt-a', effort: null });
  });
});

describe('OpenCode reads the newest row that names a model', () => {
  const step = (seq: number, model: string) =>
    row(seq, {
      type: 'assistant',
      data: `{"time":{"created":1},"agent":"build","model":${model},"content":[]}`,
    });
  const transcript = (...rows: ReturnType<typeof row>[]) => {
    const reducer = new OpenCodeTranscriptReducer();
    reducer.append(rows.map(rowLine));
    return reducer.transcript(IDLE);
  };

  it("the step's model and variant, then a switch's model", () => {
    const first = step(1, '{"id":"model-a","providerID":"p","variant":"high"}');
    expect(read('opencode', transcript(row(0), first))).toEqual({
      model: 'model-a',
      effort: 'high',
    });
    const switched = row(2, { type: 'model-switched', data: '{"model":{"id":"model-b"}}' });
    expect(read('opencode', transcript(row(0), first, switched))).toEqual({
      model: 'model-b',
      effort: null,
    });
  });

  it('unknown before any step', () => {
    expect(read('opencode', transcript(row(0)))).toEqual({ model: null, effort: null });
  });
});

describe('Hermes reads its session row', () => {
  const transcript = (session: string) => {
    const reducer = new HermesTranscriptReducer();
    const data = encodeUtf8(session);
    reducer.append([{ offset: 0, length: data.length, data }]);
    return reducer.transcript(IDLE);
  };

  it('the model; effort is not stored', () => {
    const session =
      '{"k":"session","id":"s1","parent":null,"title":"T","model":"provider/model-a"}';
    expect(read('hermes', transcript(session))).toEqual({
      model: 'provider/model-a',
      effort: null,
    });
    const none = '{"k":"session","id":"s1","parent":null,"title":"T","model":null}';
    expect(read('hermes', transcript(none))).toEqual({ model: null, effort: null });
  });
});

describe('Pi and Oh My Pi read the level their footer draws', () => {
  const screen = (...rows: string[]) => decodeAnsiScreen(rows.join('\r\n'));

  it('the level, never the model', () => {
    expect(read('pi', null, screen('❯', '(anthropic) model-x • xhigh'))).toEqual({
      model: null,
      effort: 'xhigh',
    });
    expect(read('omp', null, screen('❯', '🗺 Plan  model-x ◔ low')).effort).toBe('low');
    expect(read('omp', null, screen('❯', 'model-x ◕ xhi')).effort).toBe('xhigh');
  });

  it('unknown without a screen or a level drawn', () => {
    expect(read('pi', null, null).effort).toBeNull();
    expect(read('pi', null, screen('❯', 'model-x')).effort).toBeNull();
  });

  it('unknown while a dialog covers the footer', () => {
    const approval = loadScreen('omp-36-approval-edit-18-12');
    expect(footerCovered('omp', approval)).toBe(true);
    expect(read('omp', null, approval).effort).toBeNull();
  });
});

describe('Grok Build reads the model its input box border names', () => {
  it('from a capture and a built screen', () => {
    expect(read('grok', null, capture('grok-01-idle-empty')).model).toBe('Grok 4.7 Fast (high)');
    expect(read('grok', null, grokScreen({ bottomLabel: 'grok-x' })).model).toBe('grok-x');
  });

  it('unknown while the border names something else', () => {
    expect(
      read('grok', null, grokScreen({ bottomLabel: 'grok-x', multiline: true })).model,
    ).toBeNull();
    expect(read('grok', null, grokScreen({ bottomLabel: 'editing queued #1' })).model).toBeNull();
    expect(read('grok', null, null)).toEqual({ model: null, effort: null });
  });
});
