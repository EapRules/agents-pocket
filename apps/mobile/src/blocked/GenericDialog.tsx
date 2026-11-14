import {
  type AnswerLayout,
  excerptReading,
  type GenericDialogExcerpt,
  genericAnswerRole,
  genericOffersKeys,
  type ShownRequest,
  splitAnswers,
} from '@openagentspocket/core';
import { BoundedScroll, Card, makeStyles, Text } from '@openagentspocket/ui';
import { type Answer, Answers } from './Answers';
import { CardKeys } from './CardKeys';
import { roleKind } from './dialogModel';
import { Subject } from './Subject';
import { cardText } from './text';

const useStyles = makeStyles((th) => ({
  code: { padding: th.spacing.sm },
}));

/**
 * The numbered options as answers, roles read strictly from their labels (`genericAnswerRole`).
 * When every option is a known answer they take the approval's layout under their own labels;
 * when any is not, every option stays in the dialog's order, numbered as the rows above show it.
 * Either way a button presses the option's number on screen.
 */
export function genericAnswers(
  excerpt: GenericDialogExcerpt,
  onPress: (number: number) => void,
): AnswerLayout<Answer> {
  const numbers = [...excerpt.numbered.keys()].sort((a, b) => a - b);
  const roles = numbers.map((number) => genericAnswerRole(excerpt.numbered.get(number) ?? ''));
  const known = roles.every((role) => role !== null);
  const answers = numbers.map(
    (number, index): Answer => ({
      key: number,
      label: excerpt.numbered.get(number) ?? '',
      number: known ? null : number,
      kind: roleKind(roles[index] ?? null),
      persistent: roles[index] === 'approvePersistent',
      testID: `blocked-generic-${number}`,
      onPress: () => onPress(number),
    }),
  );
  if (!known) return { pair: null, rest: answers };
  return splitAnswers(answers, (answer) => roles[numbers.indexOf(answer.key)] ?? null);
}

/**
 * A dialog no parser names. When the one waiting request provably is what it asks (`shown`), the
 * request's command; otherwise the rows as `excerptReading` shows them and why they did not parse. The answers are the
 * same component either way (`genericAnswers`, drawn by `Answers`); rows with no numbered answer
 * get the card's key pad instead (`genericOffersKeys`).
 */
export function GenericDialog({
  excerpt,
  shown,
  disabled,
  keysDisabled,
  onPress,
  onKeys,
}: {
  excerpt: GenericDialogExcerpt;
  shown: ShownRequest | null;
  disabled: boolean;
  keysDisabled: boolean;
  onPress: (number: number) => void;
  onKeys: (keys: string[]) => void;
}) {
  const styles = useStyles();
  const answers = genericOffersKeys(excerpt) ? (
    <CardKeys disabled={keysDisabled} onKeys={onKeys} />
  ) : (
    <Answers layout={genericAnswers(excerpt, onPress)} disabled={disabled} />
  );
  if (shown) {
    return (
      <>
        <Subject code={shown.command} description={shown.description} />
        {answers}
      </>
    );
  }
  const reason = cardText(excerpt.reason);
  const { body } = excerptReading(excerpt);
  return (
    <>
      {body.length > 0 ? (
        <BoundedScroll testID="blocked-excerpt">
          <Card level="control" style={styles.code}>
            <Text variant="mono">{body.join('\n')}</Text>
          </Card>
        </BoundedScroll>
      ) : null}
      {reason ? (
        <Text variant="footnote" tone="secondary" testID="blocked-generic-reason">
          {reason}
        </Text>
      ) : null}
      {answers}
    </>
  );
}
