// What a Claude Code reply records about the settings it ran with. Seen in Claude Code 2.1.325
// transcripts, not documented: an assistant record carries `effort` (and the same value as
// `perTurnEffort`) and `message.model`, and its `message.usage.speed` is the API's `fast` or
// `standard` (platform.claude.com/docs/en/build-with-claude/fast-mode, "Checking which speed was
// used"). Each describes the reply it sits on, so a change made since shows only with the next
// reply, and a fast-mode cooldown records `standard` while fast mode stays on.

import { asString, type JsonObject } from '../model/reducer';
import type { ChatRecordedSettings } from '../model/types';

/** Claude Code's model name on replies it made up itself (an interruption, an error). */
const SYNTHETIC_MODEL = '<synthetic>';

export function replySettings(
  raw: JsonObject,
  message: JsonObject | null,
  usage: JsonObject | null,
): ChatRecordedSettings | null {
  const model = asString(message?.model);
  if (model === null || model === SYNTHETIC_MODEL) return null;
  return {
    model,
    effort: asString(raw.effort) ?? asString(raw.perTurnEffort),
    speed: asString(usage?.speed),
  };
}
