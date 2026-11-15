import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  codeOffenders,
  manifestOffenders,
  offenders,
  proseOffenders,
  tableOffenders,
} from '../check-brand.mjs';

const KEYS = new Set(['Agentico Is Locked']);

test('the tree says the product name everywhere a person reads it', () => {
  assert.deepEqual(offenders(), []);
});

test('a table value with an old name fails, an old name in a key does not', () => {
  const table = {
    'Agentico Is Locked': 'Agents Pocket Is Locked',
    Hosts: 'OpenAgentsPocket Hosts',
  };
  assert.deepEqual(tableOffenders(table), ['Hosts']);
});

test('code fails on a raw literal, a template or JSX text with an old name', () => {
  const source = [
    'reason: "Agentico can\'t read this box.",',
    `reason: \`Agentico cannot read \${name}.\`,`,
    '<Text>OpenAgentsPocket</Text>',
    "title: 'Notes\\nAgentico draws these',",
  ].join('\n');
  assert.deepEqual(codeOffenders(source, KEYS), [1, 2, 3, 4]);
});

test('code passes catalog keys, comments and identifiers', () => {
  const source = [
    "t('Agentico Is Locked')",
    '// Agentico is the Swift app',
    ' * OpenAgentsPocket in a doc comment',
    "export const AgenticoNotify = 'agentico'; // Agentico",
    "const scope = '@openagentspocket/core'; const marker = 'AGENTICO_HOOK';",
  ].join('\n');
  assert.deepEqual(codeOffenders(source, KEYS), []);
});

test('prose and manifest fields fail on an old name, ids do not', () => {
  assert.deepEqual(proseOffenders('# Agents Pocket installer\nPair with Agentico'), [2]);
  const toml = 'id = "agentico"\nname = "agentico"\ndescription = "Show a QR for the Agentico app"';
  assert.deepEqual(manifestOffenders(toml), [3]);
});
