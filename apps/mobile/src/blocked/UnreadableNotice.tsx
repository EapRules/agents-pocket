import { t } from '@openagentspocket/i18n';
import { Banner } from '@openagentspocket/ui';

/**
 * "Agentico cannot read this, go to the terminal": the one way the Blocked card and a Chat
 * question say it, with the way there as the banner's action under the message, which keeps the
 * full width.
 */
export function UnreadableNotice({
  message,
  onShowTerminal,
  testID,
}: {
  message: string;
  onShowTerminal: () => void;
  /** The action's testID is `${testID}-action`. */
  testID: string;
}) {
  return (
    <Banner
      tone="warning"
      message={message}
      actionLabel={t('Show Terminal')}
      onAction={onShowTerminal}
      stackedAction
      testID={testID}
    />
  );
}
