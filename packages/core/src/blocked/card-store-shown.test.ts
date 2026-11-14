import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import '../chat/programs';
import type { ChatPendingRequest } from '../chat/model/types';
import { FakeClock } from '../hosts/cancellation';
import { decodeAnsiScreen } from './ansi-decoder';
import { BlockedCardStore } from './card-store';
import type { BlockedScreenIO } from './card-support';
import type { AnsiScreen } from './screen';

const LINES = readFileSync(
  fileURLToPath(new URL('./fixtures/claude-side-panel-bash.ansi', import.meta.url)),
  'utf8',
).split('\n');
/** Claude Code's Bash dialog with its top rule scrolled off: the parsers cannot name it. */
const CLIPPED = decodeAnsiScreen(
  LINES.slice(LINES.findIndex((line) => line.includes('Bash command'))).join('\n'),
);
const COMMAND =
  'cd /your/project\nF=.scratch/vf.log; git add apps packages && (git commit -m "Markdown tables line ' +
  'up and scroll sideways; copy lives on the text, not on a wrapper around it" > $F 2>&1 || git status)';

class Pane implements BlockedScreenIO {
  keys: string[][] = [];
  constructor(private screen: AnsiScreen) {}
  async readScreen() {
    return this.screen;
  }
  async sendKeys(keys: readonly string[]) {
    this.keys.push([...keys]);
  }
  async paste() {}
}

const request = (summary: string): ChatPendingRequest => ({
  entryID: 'e1',
  callID: 'toolu_1',
  kind: 'command',
  toolName: 'Bash',
  summary,
  detail: 'Stage and commit the review fixes',
  questions: [],
  planFilePath: null,
});

async function card(summary: string) {
  const pane = new Pane(CLIPPED);
  const clock = new FakeClock();
  const store = new BlockedCardStore({ program: 'claude', io: pane, clock });
  store.setCalls({
    waiting: new Set(['toolu_1']),
    resolved: new Set(),
    requests: [request(summary)],
  });
  store.setActivity('blocked');
  await store.refresh();
  return { pane, clock, store };
}

async function press(world: Awaited<ReturnType<typeof card>>, number: number) {
  let done = false;
  const work = world.store.press(number).finally(() => {
    done = true;
  });
  while (!done) await world.clock.advance(50);
  await work;
}

describe('a clipped dialog the conversation names', () => {
  it('shows the request, and a press sends the same digit as the raw card', async () => {
    const clean = await card(COMMAND);
    const raw = await card(COMMAND.replace('git status', 'git statuz'));
    const cleanContent = clean.store.getState().content;
    const rawContent = raw.store.getState().content;
    if (cleanContent.kind !== 'generic' || rawContent.kind !== 'generic')
      throw new Error('generic');
    expect(cleanContent.shown?.command).toBe(COMMAND);
    expect(rawContent.shown).toBeNull();
    expect(cleanContent.excerpt).toEqual(rawContent.excerpt);
    await press(clean, 2);
    await press(raw, 2);
    expect(clean.pane.keys).toEqual([['2']]);
    expect(clean.pane.keys).toEqual(raw.pane.keys);
  });

  it('goes raw at once when the request it showed is no longer the only one', async () => {
    const { store } = await card(COMMAND);
    store.setCalls({
      waiting: new Set(['toolu_1', 'toolu_2']),
      resolved: new Set(),
      requests: [request(COMMAND), { ...request('ls'), callID: 'toolu_2' }],
    });
    const { content } = store.getState();
    expect(content.kind === 'generic' && content.shown).toBeNull();
  });
});
