import type { ApprovalDecision, ApprovalOutcome } from '@openagentspocket/core';
import { t } from '@openagentspocket/i18n';
import { Button, ButtonRow, EmptyState, makeStyles, Sheet, Text } from '@openagentspocket/ui';
import { View } from 'react-native';
import { approvalFeedback } from '@/notifications/approvalFeedback';
import { Subject } from '../blocked/Subject';
import type { ActivityLinkReview } from './runtime';

const useStyles = makeStyles((th) => ({
  body: { gap: th.spacing.sm, padding: th.spacing.md },
  actions: { padding: th.spacing.md },
}));

/** Why there is no prompt to answer: a gone prompt reads the same however it went. */
function nothingMessage(outcome: ApprovalOutcome, host: string): string {
  if (outcome === 'promptChanged' || outcome === 'notAnswerable') {
    return t('There is nothing to answer here.');
  }
  return approvalFeedback(outcome, host) ?? t('There is nothing to answer here.');
}

function ConfirmBody({ review }: { review: ActivityLinkReview | null }) {
  const styles = useStyles();
  if (!review) {
    return (
      <View style={styles.body}>
        <EmptyState
          busy
          layout="compact"
          title={t('Checking…')}
          testID="activity-confirm-checking"
        />
      </View>
    );
  }
  if (review.kind === 'nothing') {
    return (
      <View style={styles.body}>
        <Text testID="activity-confirm-nothing">{nothingMessage(review.outcome, review.host)}</Text>
      </View>
    );
  }
  const { ask, approve, deny, approveRefusal, host } = review;
  const note = approveRefusal && approvalFeedback(approveRefusal, host);
  return (
    <View style={styles.body}>
      <Text variant="footnote" tone="secondary">
        {host}
      </Text>
      <Subject code={ask.prompt} description={null} codeTestID="activity-confirm-prompt" />
      {approve !== null ? <Text>{t('Approve: %@', approve)}</Text> : null}
      {deny !== null ? <Text>{t('Deny: %@', deny)}</Text> : null}
      {note ? (
        <Text variant="footnote" tone="secondary">
          {note}
        </Text>
      ) : null}
    </View>
  );
}

interface Props {
  visible: boolean;
  /** What to ask; null while the Host is being read. */
  review: ActivityLinkReview | null;
  onDecide: (decision: ApprovalDecision) => void;
  onClose: () => void;
}

/** What a Live Activity link opens: the prompt as the Host reports it, and only a tap here answers. */
export function ActivityConfirmSheet({ visible, review, onDecide, onClose }: Props) {
  const styles = useStyles();
  const ask = visible && review?.kind === 'ask' ? review : null;
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={t('Answer This Prompt')}
      detent="fit"
      testID="activity-confirm"
      footer={
        <View style={styles.actions}>
          <ButtonRow>
            <Button
              title={t('Cancel')}
              kind="secondary"
              size="dense"
              onPress={onClose}
              testID="activity-confirm-cancel"
            />
            {ask?.deny != null ? (
              <Button
                title={t('Deny')}
                kind="destructive"
                size="dense"
                onPress={() => onDecide('deny')}
                testID="activity-confirm-deny"
              />
            ) : null}
            {ask?.approve != null ? (
              <Button
                title={t('Approve')}
                size="dense"
                onPress={() => onDecide('approve')}
                testID="activity-confirm-approve"
              />
            ) : null}
          </ButtonRow>
        </View>
      }
    >
      {visible ? <ConfirmBody review={review} /> : null}
    </Sheet>
  );
}
