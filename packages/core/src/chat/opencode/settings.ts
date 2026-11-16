// The model and variant an OpenCode conversation runs with, from its rows (seen in OpenCode 2.1.3's
// store: every assistant step's `model` is `{id, providerID, variant}`, and `/models` writes a
// `model-switched` row naming the new model's id). The newest row that names a model wins; a
// switch names no variant, so the variant stays unknown until the next step records one.

import { type ChatRecordedSettings, NO_RECORDED_SETTINGS } from '../model/types';
import type { OpenCodeRow } from './record-types';

/** `rows` in `seq` order. */
export function openCodeRecordedSettings(rows: readonly OpenCodeRow[]): ChatRecordedSettings {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const content = (rows[index] as OpenCodeRow).content;
    if (content.type === 'modelSwitched' && content.model !== null) {
      return { ...NO_RECORDED_SETTINGS, model: content.model };
    }
    const model = content.type === 'assistant' ? content.step.model : null;
    if (model?.id) return { ...NO_RECORDED_SETTINGS, model: model.id, effort: model.variant };
  }
  return NO_RECORDED_SETTINGS;
}
