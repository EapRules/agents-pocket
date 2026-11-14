import {
  type AnswerLayout,
  type GenericDialogExcerpt,
  genericAnswerRole,
  type ShownRequest,
  splitAnswers,
} from '@openagentspocket/core';
import { BoundedScroll, Button, Card, makeStyles, Text } from '@openagentspocket/ui';
import { View } from 'react-native';
import { type Answer, Answers } from './Answers';
import { roleKind } from './dialogModel';
import { Subject } from './Subject';
import { cardText } from './text';

const useStyles = makeStyles((th) => ({
  code: { padding: th.spacing.sm },
  choices: { gap: th.spacing.xs },
}));

/** The numbered options as answers: labels only, roles read strictly from them (`genericAnswerRole`). */
function genericAnswers(
  excerpt: GenericDialogExcerpt,
  onPress: (number: number) => void,
): AnswerLayout<Answer> {
  const answers = [...excerpt.numbered.keys()]
    .sort((a, b) => a - b)
    .map((number): Answer => {
      const label = excerpt.numbered.get(number) ?? '';
      const role = genericAnswerRole(label);
      return {
        key: number,
        label,
        kind: roleKind(role),
        persistent: role === 'approvePersistent',
        testID: `blocked-generic-${number}`,
        onPress: () => onPress(number),
      };
    });
  return splitAnswers(answers, (answer) => genericAnswerRole(answer.label));
}

/**
 * A dialog no parser names. When the one waiting request provably is what it asks (`shown`), the
 * request's command and answers in the approval's layout; otherwise the rows verbatim, why they
 * did not parse, and a button per number. Either way a button presses the number on screen.
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
  if (shown) {
    return (
      <>
        <Subject code={shown.command} description={shown.description} />
        <Answers layout={genericAnswers(excerpt, onPress)} disabled={disabled} />
      </>
    );
  }
  const numbers = [...excerpt.numbered.keys()].sort((a, b) => a - b);
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
      <View style={styles.choices}>
        {numbers.map((number) => (
          <Button
            key={number}
            title={`${number}. ${excerpt.numbered.get(number) ?? ''}`}
            kind="secondary"
            size="small"
            disabled={disabled}
            onPress={() => onPress(number)}
            testID={`blocked-generic-${number}`}
          />
        ))}
      </View>
    </>
  );
}
