import '../chat/programs';
// OpenCode's permission block cut at its top by a short terminal, or under a heading this version
// does not word as `△ Permission required`: the generic excerpt with the block's rows and a
// reason, not NO_DIALOG (which a Blocked Agent turns into the Keys card with no row of the dialog).

import { describe, expect, it } from 'vitest';
import { FakeClock } from '../hosts/cancellation';
import { decodeAnsiScreen } from './ansi-decoder';
import { cutTop } from './card-outcome.testkit';
import { BlockedCardStore } from './card-store';
import type { BlockedScreenIO } from './card-support';
import { goldenAnsi, loadScreen } from './golden-fixtures.testkit';
import { parseOpenCodeDialog } from './opencode-parser';
import { planGenericOption } from './programs';
import type { AnsiScreen } from './screen';
import type { GenericDialogExcerpt } from './types';

const STEM = 'opencode-10-permission-180';
/** Row 38 holds `△ Permission required`, row 39 `→ Read .env`, row 44 the answers. */
const HEADING_ROW = 38;

function excerptOf(screen: AnsiScreen): GenericDialogExcerpt {
  const result = parseOpenCodeDialog(screen);
  if (result.kind !== 'unrecognized') throw new Error(`expected generic, got ${result.kind}`);
  return result.excerpt;
}

const texts = (excerpt: GenericDialogExcerpt) => excerpt.rows.map((row) => row.text.trim());
const keyOf = (excerpt: GenericDialogExcerpt) =>
  typeof excerpt.reason === 'object' && 'key' in excerpt.reason ? excerpt.reason.key : null;

describe('an OpenCode permission whose heading is off screen', () => {
  const full = loadScreen(STEM);
  const cut = cutTop(full, HEADING_ROW + 1);

  it('is named while its heading shows', () => {
    expect(parseOpenCodeDialog(full).kind).toBe('dialog');
  });

  it('reads as the generic excerpt of the block, from the screen top through its answers', () => {
    const excerpt = excerptOf(cut);
    expect(excerpt.rows[0]?.index).toBe(0);
    expect(texts(excerpt)).toContain('┃    → Read .env');
    expect(texts(excerpt)).toContain('┃  Path: .env');
    expect(texts(excerpt).some((text) => text.includes('Allow once'))).toBe(true);
    expect(keyOf(excerpt)).toBe('The top of the dialog is off screen.');
  });

  it('still reads with only the answers row left', () => {
    const answersOnly = cutTop(full, 44);
    expect(parseOpenCodeDialog(answersOnly).kind).toBe('unrecognized');
  });

  it('has no digit to press: OpenCode answers a permission by focus, not by number', () => {
    const excerpt = excerptOf(cut);
    expect(excerpt.numbered.size).toBe(0);
    const plan = planGenericOption(1, excerpt, 'opencode', cut);
    expect(plan.ok).toBe(false);
  });

  it('is the generic card for a Blocked Agent, not the Keys card', async () => {
    const io: BlockedScreenIO = {
      readScreen: async () => cut,
      sendKeys: async () => {},
      paste: async () => {},
    };
    const store = new BlockedCardStore({ program: 'opencode', io, clock: new FakeClock() });
    store.setActivity('blocked');
    await store.refresh();
    expect(store.getState().content.kind).toBe('generic');
  });
});

describe('an OpenCode permission under a heading worded otherwise', () => {
  const screen = decodeAnsiScreen(
    goldenAnsi(STEM).replace('Permission required', 'Permiso requerido'),
  );

  it('reads as the generic excerpt with the layout reason, its heading among the rows', () => {
    const excerpt = excerptOf(screen);
    expect(excerpt.rows[0]?.index).toBeGreaterThan(0);
    expect(texts(excerpt)).toContain('┃  △ Permiso requerido');
    expect(keyOf(excerpt)).not.toBe('The top of the dialog is off screen.');
  });
});

describe('an OpenCode block without a permission’s answers', () => {
  it('is still no prompt when its heading is unknown', () => {
    const screen = decodeAnsiScreen(
      goldenAnsi(STEM)
        .replace('Permission required', 'Something else')
        .replace('Allow once', 'Maybe once'),
    );
    expect(parseOpenCodeDialog(screen).kind).toBe('none');
  });
});
