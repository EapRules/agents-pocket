// For tests written against the English a reason used to be: install with
// `expect.addEqualityTesters([sourceTextEquality])` and a `Text` equals the string its catalog
// source renders, so the test still pins which reason came back without restating its key.

import { renderText, type Text } from './text';

const isText = (value: unknown): value is Text =>
  typeof value === 'object' && value !== null && ('key' in value || 'join' in value);

export function sourceTextEquality(a: unknown, b: unknown): boolean | undefined {
  if (typeof a === 'string' && isText(b)) return renderText(b) === a;
  if (typeof b === 'string' && isText(a)) return renderText(a) === b;
  return undefined;
}
