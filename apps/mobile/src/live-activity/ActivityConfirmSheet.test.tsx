import { ThemeProvider } from '@openagentspocket/ui';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ActivityConfirmSheet } from './ActivityConfirmSheet';
import type { ActivityLinkReview } from './runtime';

const ASK = {
  episodeId: 'b1',
  denyOnly: false,
  prompt: 'Run ls?',
  options: ['Yes', 'No'],
  timestamp: 1000,
};
const REVIEW = {
  kind: 'ask',
  ask: ASK,
  approve: 'Yes',
  deny: 'No',
  approveRefusal: null,
  host: 'mbp',
} as unknown as ActivityLinkReview;

async function mount(review: ActivityLinkReview | null) {
  const onDecide = jest.fn();
  const onClose = jest.fn();
  await render(
    <ThemeProvider>
      <ActivityConfirmSheet visible review={review} onDecide={onDecide} onClose={onClose} />
    </ThemeProvider>,
  );
  return { onDecide, onClose };
}

describe('ActivityConfirmSheet', () => {
  it('Cancel closes, Deny answers deny and Approve answers approve, nothing else', async () => {
    const { onDecide, onClose } = await mount(REVIEW);
    expect(screen.getByTestId('activity-confirm-prompt')).toHaveTextContent('Run ls?');
    await fireEvent.press(screen.getByTestId('activity-confirm-cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onDecide).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('activity-confirm-deny'));
    expect(onDecide).toHaveBeenLastCalledWith('deny');
    await fireEvent.press(screen.getByTestId('activity-confirm-approve'));
    expect(onDecide).toHaveBeenLastCalledWith('approve');
    expect(onDecide).toHaveBeenCalledTimes(2);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('offers no answer while the Host is being read', async () => {
    await mount(null);
    expect(screen.getByTestId('activity-confirm-checking')).toBeTruthy();
    expect(screen.queryByTestId('activity-confirm-approve')).toBeNull();
    expect(screen.queryByTestId('activity-confirm-deny')).toBeNull();
  });
});
