import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { renderText } from '../../errors/text';
import { emptyTranscript } from '../model/types';
import {
  type ConversationSetting,
  conversationSettingsSummary,
  keepLastKnown,
  programSettings,
  readConversationSettings,
  SETTING_USAGE_CREDITS_KEY,
} from './index';

const transcript = (model: string | null, effort: string | null) => ({
  ...emptyTranscript(),
  recordedSettings: { model, effort, speed: null },
});

const read = (model: string | null, effort: string | null) =>
  readConversationSettings({
    program: 'codex',
    transcript: transcript(model, effort),
    screen: null,
  });

const values = (settings: readonly ConversationSetting[]) =>
  settings.map(({ value }) => (value.kind === 'known' ? value.value : null));

describe('the last known value', () => {
  it('stays while a read says nothing, and gives way to a new one', () => {
    const first = read('gpt-a', 'high');
    const blank = keepLastKnown(first, read(null, null));
    expect(values(blank)).toEqual(['gpt-a', 'high']);
    expect(values(keepLastKnown(blank, read('gpt-b', null)))).toEqual(['gpt-b', 'high']);
    expect(values(keepLastKnown(null, read(null, 'low')))).toEqual([null, 'low']);
  });
});

describe('the summary', () => {
  it('joins the known values in the program order, with option titles', () => {
    expect(renderText(conversationSettingsSummary(read('gpt-a', 'xhigh')) ?? '')).toBe(
      'gpt-a · xhigh',
    );
    const claude = readConversationSettings({
      program: 'claude',
      transcript: {
        ...transcript('opus', 'high'),
        recordedSettings: { model: 'opus', effort: 'high', speed: 'fast' },
      },
      screen: null,
    });
    expect(renderText(conversationSettingsSummary(claude) ?? '')).toBe('opus · High · Fast Mode');
    const standard = readConversationSettings({
      program: 'claude',
      transcript: {
        ...transcript('opus', 'high'),
        recordedSettings: { model: 'opus', effort: 'high', speed: 'standard' },
      },
      screen: null,
    });
    expect(renderText(conversationSettingsSummary(standard) ?? '')).toBe('opus · High');
    expect(conversationSettingsSummary(read(null, null))).toBeNull();
  });

  it("every option's note resolves in English and Spanish", () => {
    const notes = programSettings('claude').flatMap((s) => s.options.flatMap((o) => o.notes ?? []));
    expect(notes).toContain(SETTING_USAGE_CREDITS_KEY);
    for (const language of ['en', 'es']) {
      const path = fileURLToPath(
        new URL(`../../../../i18n/src/extras/${language}.json`, import.meta.url),
      );
      const keys = Object.keys(JSON.parse(readFileSync(path, 'utf8')) as object);
      expect(notes.filter((key) => !keys.includes(key))).toEqual([]);
    }
  });
});
