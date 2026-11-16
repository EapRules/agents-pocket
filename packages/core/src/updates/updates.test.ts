import { describe, expect, it } from 'vitest';
import {
  formatAppVersion,
  runningUpdateReportText,
  summarizeRunningUpdate,
  UPDATE_CHANNEL_PARAM,
  updateChannel,
} from './index';

describe('update channel', () => {
  it('a TestFlight install (sandboxReceipt) asks for internal', () => {
    expect(UPDATE_CHANNEL_PARAM).toBe('channel');
    expect(updateChannel({ storeReceiptName: 'sandboxReceipt' })).toBe('internal');
  });

  it('an App Store install, an unknown receipt or none asks for no channel', () => {
    expect(updateChannel({ storeReceiptName: 'receipt' })).toBeNull();
    expect(updateChannel({ storeReceiptName: 'Sandboxreceipt' })).toBeNull();
    expect(updateChannel({ storeReceiptName: '' })).toBeNull();
    expect(updateChannel({ storeReceiptName: null })).toBeNull();
  });
});

describe('running update', () => {
  const id = '0f6a2b3c-1d2e-4f50-8a9b-0c1d2e3f4a5b';

  it('names the embedded JS as embedded, with or without an id', () => {
    expect(summarizeRunningUpdate({ embedded: true, id, createdAt: new Date() })).toEqual({
      kind: 'embedded',
    });
    expect(summarizeRunningUpdate({ embedded: false, id: null, createdAt: null }).kind).toBe(
      'embedded',
    );
  });

  it('names a downloaded update by its short id and publish date (UTC)', () => {
    const summary = summarizeRunningUpdate({
      embedded: false,
      id,
      createdAt: new Date('2026-11-14T23:30:00.000Z'),
    });
    expect(summary).toEqual({ kind: 'update', shortId: '0f6a2b3c', date: '2026-11-14' });
    expect(runningUpdateReportText(summary)).toContain('0f6a2b3c');
    expect(runningUpdateReportText(summary)).toContain('2026-11-14');
  });

  it('drops an unusable date instead of printing it', () => {
    const summary = summarizeRunningUpdate({ embedded: false, id, createdAt: new Date('nope') });
    expect(summary).toEqual({ kind: 'update', shortId: '0f6a2b3c', date: null });
  });
});

describe('app version label', () => {
  it('names the version and the build, as releases do', () => {
    expect(formatAppVersion('1.0.2', '8')).toBe('1.0.2 (8)');
  });

  it('is just the version when the build is unknown', () => {
    expect(formatAppVersion('1.0.2', '')).toBe('1.0.2');
  });
});
