import { agentPadKeys, KeyPad, type KeyPadPage } from '@openagentspocket/ui';

/** The keys a Blocked card offers when it has no answer to press: the shared pad's, in this order. */
const CARD_KEYS: readonly KeyPadPage[] = [
  {
    id: 'card',
    title: '',
    keys: ['up', 'down', 'enter', 'esc'].flatMap((id) =>
      agentPadKeys.filter((key) => key.id === id),
    ),
  },
];

/**
 * ↑ ↓ Enter Escape as the compact key pad, each sent as it is: the card that cannot read the screen,
 * and the generic card whose rows hold no numbered answer.
 */
export function CardKeys({
  disabled,
  onKeys,
}: {
  disabled: boolean;
  onKeys: (keys: string[]) => void;
}) {
  return (
    <KeyPad
      compact
      pages={CARD_KEYS}
      page="card"
      onPageChange={() => {}}
      onKey={(key) => onKeys([key.id])}
      disabled={disabled}
      testID="blocked-keypad"
    />
  );
}
