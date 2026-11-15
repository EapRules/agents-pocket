import { MemoryStorage, SettingsStore } from '@openagentspocket/core';
import { render, waitFor } from '@testing-library/react-native';
import { appBuild } from '@/diagnostics/appBuild';
import { problemReportBody } from '@/diagnostics/problemReport';
import { fakeAuthenticator } from '@/settings/authenticator';
import { SettingsProvider } from '@/settings/SettingsProvider';
import { type AppUpdates, createAppUpdates, disabledUpdates, fakeUpdatesApi } from './appUpdates';
import { deviceUpdates } from './deviceUpdates';
import { deviceReceiptProbe, fakeReceiptProbe, receiptDirectory } from './storeReceipt';
import { UpdateChannelSync } from './UpdateChannelSync';

const ID = '0f6a2b3c-1d2e-4f50-8a9b-0c1d2e3f4a5b';

describe('app updates', () => {
  it('is off without the native module or with updates disabled in the build', () => {
    expect(createAppUpdates(null)).toBe(disabledUpdates);
    expect(createAppUpdates(fakeUpdatesApi({ isEnabled: false })).enabled).toBe(false);
  });

  it('is off in tests, as in every build but an official store one', () => {
    expect(deviceUpdates.enabled).toBe(false);
  });

  it('reads what runs from expo-updates', () => {
    const createdAt = new Date('2026-11-14T00:00:00.000Z');
    const api = fakeUpdatesApi({ isEmbeddedLaunch: false, updateId: ID, createdAt });
    expect(createAppUpdates(api).running()).toEqual({ embedded: false, id: ID, createdAt });
  });
});

describe('the problem report names the running update only in a build with updates', () => {
  it('leaves it out without updates', () => {
    const build = appBuild(disabledUpdates);
    expect(build.update).toBeUndefined();
    expect(problemReportBody(build)).not.toMatch(/Update:/);
  });

  it('names the embedded JS or the update short id', () => {
    const embedded = appBuild(createAppUpdates(fakeUpdatesApi()));
    expect(embedded.update).toMatch(/embedded/);
    const api = fakeUpdatesApi({ isEmbeddedLaunch: false, updateId: ID, createdAt: new Date() });
    expect(problemReportBody(appBuild(createAppUpdates(api)))).toContain('0f6a2b3c');
  });
});

describe('UpdateChannelSync', () => {
  async function mount(updates: AppUpdates, name: string | null) {
    const store = new SettingsStore(new MemoryStorage());
    await render(
      <SettingsProvider store={store} authenticator={fakeAuthenticator(null)} updates={updates}>
        <UpdateChannelSync probe={fakeReceiptProbe(name)} />
      </SettingsProvider>,
    );
  }

  it('a TestFlight install asks for internal', async () => {
    const api = fakeUpdatesApi();
    await mount(createAppUpdates(api), 'sandboxReceipt');
    await waitFor(() => expect(api.params.get('channel')).toBe('internal'));
  });

  it('an App Store install sends null, clearing a stored value', async () => {
    const api = fakeUpdatesApi();
    api.params.set('channel', 'beta');
    const setParam = jest.spyOn(api, 'setExtraParamAsync');
    await mount(createAppUpdates(api), 'receipt');
    await waitFor(() => expect(setParam).toHaveBeenCalledTimes(1));
    expect(setParam).toHaveBeenCalledWith('channel', null);
    expect(api.params.has('channel')).toBe(false);
  });

  it('is called once per launch and a refusal does not break anything', async () => {
    const api = fakeUpdatesApi({
      setExtraParamAsync: jest.fn(() => Promise.reject(new Error('no'))),
    });
    await mount(createAppUpdates(api), 'sandboxReceipt');
    await waitFor(() => expect(api.setExtraParamAsync).toHaveBeenCalledTimes(1));
  });

  it('touches nothing in a build without updates', async () => {
    const probe = fakeReceiptProbe('sandboxReceipt');
    const read = jest.spyOn(probe, 'storeReceiptName');
    const setChannel = jest.spyOn(disabledUpdates, 'setChannel');
    const store = new SettingsStore(new MemoryStorage());
    await render(
      <SettingsProvider store={store} authenticator={fakeAuthenticator(null)}>
        <UpdateChannelSync probe={probe} />
      </SettingsProvider>,
    );
    expect(read).not.toHaveBeenCalled();
    expect(setChannel).not.toHaveBeenCalled();
  });
});

describe('store receipt', () => {
  it('sits in StoreKit next to the Documents directory', () => {
    expect(receiptDirectory('file:///var/mobile/Containers/Data/Application/ABC/Documents/')).toBe(
      'file:///var/mobile/Containers/Data/Application/ABC/StoreKit',
    );
  });

  it('is never probed outside iOS (the test platform included)', async () => {
    await expect(deviceReceiptProbe.storeReceiptName()).resolves.toBeNull();
  });
});
