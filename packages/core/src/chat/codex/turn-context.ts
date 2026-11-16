// The model and reasoning effort a Codex turn runs with, from its `turn_context` line (seen in
// Codex 0.167 rollouts: `{"type":"turn_context","payload":{"model":…,"effort":…}}`, one per turn).
// Every field is optional: a version that renames one yields null, not a wrong value.

import { decodeUtf8 } from '../../events/utf8';
import { asObject, asString } from '../model/reducer';
import type { ChatRecordedSettings } from '../model/types';
import { includesBytes } from './json-bytes';

export function turnSettingsIn(line: Uint8Array): ChatRecordedSettings | null {
  // Cheap reject first: one line per turn is this record.
  if (!includesBytes(line, 'turn_context')) return null;
  let root: unknown;
  try {
    root = JSON.parse(decodeUtf8(line));
  } catch {
    return null;
  }
  const record = asObject(root);
  if (asString(record?.type) !== 'turn_context') return null;
  const payload = asObject(record?.payload);
  if (!payload) return null;
  return { model: asString(payload.model), effort: asString(payload.effort), speed: null };
}
