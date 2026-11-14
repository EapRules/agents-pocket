import { decodeAnsiScreen, parseBlockedDialog } from '@openagentspocket/core';
import { type AtlasGenericVariant, GENERIC_GOLDENS, genericContent } from './atlasBlockedGeneric';

declare const __dirname: string;
const { readFileSync } = require('node:fs') as {
  readFileSync(path: string, encoding: 'utf8'): string;
};
const GOLDENS = `${__dirname}/../../../../../packages/core/goldens`;

describe('the generic Blocked card atlas states', () => {
  it.each(Object.keys(GENERIC_GOLDENS) as AtlasGenericVariant[])(
    '%s holds its golden as the parser reads it',
    (variant) => {
      const { golden, program, rows, numbered } = GENERIC_GOLDENS[variant];
      const screen = decodeAnsiScreen(readFileSync(`${GOLDENS}/${golden}.ansi`, 'utf8'));
      const result = parseBlockedDialog(screen, program);
      if (result.kind !== 'unrecognized') throw new Error(`${golden} should stay generic`);
      expect(result.excerpt.rows.map((row) => row.text.trimEnd())).toEqual(rows);
      expect([...result.excerpt.numbered.values()]).toEqual(numbered);
      const content = genericContent(variant);
      if (content.kind !== 'generic') throw new Error('generic');
      expect(content.excerpt.rows.map((row) => row.text.trimEnd())).toEqual(rows);
    },
  );
});
