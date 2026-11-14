import type { AnswerLayout } from '@openagentspocket/core';
import { t } from '@openagentspocket/i18n';
import { Button, ButtonRow, Icon, makeStyles, Text } from '@openagentspocket/ui';
import { View } from 'react-native';
import type { AnswerKind } from './dialogModel';

const useStyles = makeStyles((th) => ({
  list: { gap: th.spacing.xs },
  warning: { flexDirection: 'row', alignItems: 'center', gap: th.spacing.xxs },
}));

/**
 * One answer button: the program's own label; the layout carries the meaning. Every Blocked card
 * draws its answer buttons from these, through `Answers`.
 */
export interface Answer {
  readonly key: number;
  readonly label: string;
  /**
   * The option's number, drawn before the label ("2. Something") only when nothing else tells the
   * options apart: raw rows whose options are not all known answers. Null otherwise.
   */
  readonly number: number | null;
  readonly kind: AnswerKind;
  /** Saves a rule: always below the pair, with its warning. */
  readonly persistent: boolean;
  readonly testID: string;
  readonly onPress: () => void;
}

function AnswerButton({ answer, disabled }: { answer: Answer; disabled: boolean }) {
  return (
    <Button
      title={answer.number === null ? answer.label : `${answer.number}. ${answer.label}`}
      kind={answer.kind}
      size="medium"
      disabled={disabled}
      // A rule-saving answer names the scope the user approves: never cut it.
      fullLabel={answer.persistent}
      onPress={answer.onPress}
      testID={answer.testID}
    />
  );
}

/**
 * A dialog's answers: the single-use pair side by side (deny left, approve right), then every
 * other answer full width in the dialog's order, a persistent one with its warning.
 */
export function Answers({ layout, disabled }: { layout: AnswerLayout<Answer>; disabled: boolean }) {
  const styles = useStyles();
  const { pair, rest } = layout;
  return (
    <View style={styles.list}>
      {pair ? (
        <ButtonRow testID="blocked-answer-pair">
          <AnswerButton answer={pair.deny} disabled={disabled} />
          <AnswerButton answer={pair.approve} disabled={disabled} />
        </ButtonRow>
      ) : null}
      {rest.map((answer) => (
        <View key={answer.key} style={styles.list}>
          <AnswerButton answer={answer} disabled={disabled} />
          {answer.persistent ? (
            <View style={styles.warning}>
              <Icon name="warning" size={13} color="warning" />
              <Text variant="footnote" tone="warning">
                {t("Saves a rule, so this isn't asked again.")}
              </Text>
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}
