import {
  type AnswerLayout,
  type GenericDialogExcerpt,
  genericAnswerRole,
  type ShownRequest,
  splitAnswers,
} from '@openagentspocket/core';
import { BoundedScroll, Card, makeStyles, Text } from '@openagentspocket/ui';
import { type Answer, Answers } from './Answers';
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
 * request's command; otherwise the rows verbatim and why they did not parse. The answers are the
 * same component either way (`genericAnswers`, drawn by `Answers`).
 */
export function GenericDialog({
  excerpt,
  shown,
  disabled,
  onPress,
}: {
  excerpt: GenericDialogExcerpt;
  shown: ShownRequest | null;
  disabled: boolean;
  onPress: (number: number) => void;
}) {
  const styles = useStyles();
  const answers = <Answers layout={genericAnswers(excerpt, onPress)} disabled={disabled} />;
  if (shown) {
    return (
      <>
        <Subject code={shown.command} description={shown.description} />
        {answers}
      </>
    );
  }
  const reason = cardText(excerpt.reason);
  return (
    <>
      <BoundedScroll testID="blocked-excerpt">
        <Card level="control" style={styles.code}>
          <Text variant="mono">{excerpt.rows.map((row) => row.text.trimEnd()).join('\n')}</Text>
        </Card>
      </BoundedScroll>
      {reason ? (
        <Text variant="footnote" tone="secondary" testID="blocked-generic-reason">
          {reason}
        </Text>
      ) : null}
      {answers}
    </>
  );
}
