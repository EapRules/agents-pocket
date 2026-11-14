import {
  backgroundSheetOf,
  backgroundWorkItem,
  backgroundWorkOf,
  emptyTranscript,
  openableSubagentID,
  presentBackgroundWork,
} from '@openagentspocket/core';
import { detailItem, openableItem } from './workViewModel';

const NOW = Date.parse('2026-11-13T12:00:00Z');

function rowsOf(state: 'running' | 'completed') {
  const items = [
    backgroundWorkItem({
      id: 'call-1',
      kind: 'subagent',
      title: 'Review notes',
      launchOffset: 1,
      launchedAt: new Date(NOW - 60_000).toISOString(),
      agentID: 'child-1',
      state,
      endOffset: state === 'running' ? null : 2,
    }),
  ];
  const transcript = { ...emptyTranscript(), backgroundWork: items };
  const work = backgroundWorkOf(transcript, {}, true, NOW);
  const { rows } = presentBackgroundWork(work, { isHostConnected: true, now: NOW, locale: 'en' });
  return { items, row: rows[0] };
}

function opens(program: string, state: 'running' | 'completed' = 'completed'): string | null {
  const { items, row } = rowsOf(state);
  if (!row) throw new Error('no row');
  let opened: string | null = null;
  const item = openableItem(
    row,
    (id) => openableSubagentID(items, id, program),
    (agentId) => {
      opened = agentId;
    },
  );
  item.action?.onPress();
  return item.action ? opened : null;
}

describe('a Background Work row that opens a Subagent transcript', () => {
  it("opens a finished Subagent's transcript for a program that reads one", () => {
    expect(opens('claude')).toBe('child-1');
  });

  it('opens nothing for a program with no reader for it', () => {
    expect(opens('opencode')).toBeNull();
  });

  it('opens nothing while the Subagent runs', () => {
    expect(opens('claude', 'running')).toBeNull();
  });
});

describe('a Background Work row of the sheet', () => {
  it('says its kind and state on one line, and a described command its line under it', () => {
    const transcript = {
      ...emptyTranscript(),
      backgroundWork: [
        backgroundWorkItem({
          id: 'call-2',
          kind: 'command',
          title: 'Build the app',
          subtitle: 'npx expo export',
          launchOffset: 1,
          state: 'completed',
          endOffset: 2,
        }),
      ],
    };
    const work = backgroundSheetOf(transcript, {}, true, NOW);
    const [row] = presentBackgroundWork(work, {
      isHostConnected: true,
      now: NOW,
      locale: 'en',
    }).rows;
    if (!row) throw new Error('no row');
    const item = detailItem(row);
    expect(item.kind).toBe('command');
    expect(item.caption).toContain(' · ');
    expect(item.detail).toBe('npx expo export');
    expect(item.monospaced).toBe(false);
    expect(item.action).toBeUndefined();
  });
});
