import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  handMadeButtonGroups,
  handMadeDisclosureChevrons,
  shadowedUiComponents,
  uiComponentNames,
} from './ui-duplicates.mjs';

const file = (text, path = 'apps/mobile/src/x/Thing.tsx') => ({ path, text });
const wrap = (jsx) => `export function Thing() { return (${jsx}); }`;

test('rule a: sibling Buttons outside a shared piece are found, inside one they are not', () => {
  const bad = wrap('<View><Button title="a" /><Button title="b" /></View>');
  assert.equal(handMadeButtonGroups(file(bad)).length, 1);
  const ok = wrap('<ButtonRow><Button title="a" /><Button title="b" /></ButtonRow>');
  assert.equal(handMadeButtonGroups(file(ok)).length, 0);
});

test('rule a: Buttons each wrapped in one View count; Buttons apart do not', () => {
  const wrapped = wrap('<Stack><View><Button /></View><View><Button /></View></Stack>');
  assert.equal(handMadeButtonGroups(file(wrapped)).length, 1);
  const apart = wrap('<Stack><Button /><Card /><Button /></Stack>');
  assert.equal(handMadeButtonGroups(file(apart)).length, 0);
});

test('rule a: a .map() returning a Button is found unless its parent is a shared piece', () => {
  const bad = wrap('<View>{items.map((i) => <Button key={i} title={i} />)}</View>');
  assert.equal(handMadeButtonGroups(file(bad)).length, 1);
  const wrappedBad = wrap('<View>{items.map((i) => { return <View><Button /></View>; })}</View>');
  assert.equal(handMadeButtonGroups(file(wrappedBad)).length, 1);
  const ok = wrap('<Answers>{items.map((i) => <Button key={i} title={i} />)}</Answers>');
  assert.equal(handMadeButtonGroups(file(ok)).length, 0);
  const chips = wrap('<ChipRow>{items.map((i) => <Button key={i} />)}</ChipRow>');
  assert.equal(handMadeButtonGroups(file(chips)).length, 0);
});

test('rule a: the shared Answers file itself is allowed', () => {
  const bad = wrap('<View><Button /><Button /></View>');
  assert.equal(handMadeButtonGroups(file(bad, 'apps/mobile/src/blocked/Answers.tsx')).length, 0);
});

test('rule b: a component named like a ui export is found', () => {
  const names = uiComponentNames(
    "export { KeyPad, type KeyPadProps } from './KeyPad';\nexport { SOME_CONST, Chip } from './x';\nexport type { Skip } from './y';",
  );
  assert.deepEqual([...names].sort(), ['Chip', 'KeyPad']);
  const bad = file('function KeyPad() { return null; }\nconst Chip = () => null;');
  assert.equal(shadowedUiComponents(bad, names).length, 2);
  const ok = file(
    "import { KeyPad } from '@openagentspocket/ui';\nfunction PadHost() { return <KeyPad />; }",
  );
  assert.equal(shadowedUiComponents(ok, names).length, 0);
});

test('rule d: an Icon flipping between the chevrons is found, a fixed one is not', () => {
  const bad = wrap("<Icon name={open ? 'chevronDown' : 'chevronRight'} />");
  assert.equal(handMadeDisclosureChevrons(file(bad)).length, 1);
  const reversed = wrap("<Icon name={closed ? 'chevronRight' : 'chevronDown'} />");
  assert.equal(handMadeDisclosureChevrons(file(reversed)).length, 1);
  const ok = wrap("<Icon name={open ? 'chevronDown' : 'plus'} />");
  assert.equal(handMadeDisclosureChevrons(file(ok)).length, 0);
  const own = file(
    bad.replace('Thing', 'DisclosureChevron'),
    'packages/ui/src/primitives/SectionHeader.tsx',
  );
  assert.equal(handMadeDisclosureChevrons(own).length, 0);
});
