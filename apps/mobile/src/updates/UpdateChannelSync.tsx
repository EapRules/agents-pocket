import { updateChannel } from '@openagentspocket/core';
import { useEffect } from 'react';
import { useAppUpdates } from '@/settings/SettingsProvider';
import { deviceReceiptProbe, type StoreReceiptProbe } from './storeReceipt';

/**
 * Tells the update server which channel this install is on, once per launch: `internal` for a
 * TestFlight build, none for an App Store one (this also clears a value an older install stored).
 * The channel rides on the next update request. Renders nothing; nothing is a setting.
 */
export function UpdateChannelSync({ probe = deviceReceiptProbe }: { probe?: StoreReceiptProbe }) {
  const updates = useAppUpdates();
  useEffect(() => {
    if (!updates.enabled) return;
    void probe
      .storeReceiptName()
      .then((storeReceiptName) => updates.setChannel(updateChannel({ storeReceiptName })))
      .catch(() => undefined);
  }, [updates, probe]);
  return null;
}
