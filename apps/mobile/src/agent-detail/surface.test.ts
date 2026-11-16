import { MemoryStorage } from '@openagentspocket/core';
import { dockBar, readTerminalInput, saveTerminalInput } from './surface';

describe('dockBar', () => {
  it('draws the Composer on Chat whatever the terminal input mode', () => {
    expect(dockBar('chat', 'keys')).toBe('composer');
    expect(dockBar('chat', 'compose')).toBe('composer');
  });

  it('draws the bar the input mode names on the terminal', () => {
    expect(dockBar('terminal', 'keys')).toBe('keys');
    expect(dockBar('terminal', 'compose')).toBe('composer');
  });
});

describe('terminal input mode', () => {
  it('is Keys until Compose is saved, and reads back what was saved', () => {
    const storage = new MemoryStorage();
    expect(readTerminalInput(storage)).toBe('keys');
    saveTerminalInput(storage, 'compose');
    expect(readTerminalInput(storage)).toBe('compose');
    saveTerminalInput(storage, 'keys');
    expect(readTerminalInput(storage)).toBe('keys');
  });
});
