import { BoundedScroll, Card, makeStyles, Text } from '@openagentspocket/ui';
import { View } from 'react-native';

const useStyles = makeStyles((th) => ({
  stack: { gap: th.spacing.xs },
  code: { padding: th.spacing.sm },
}));

/**
 * What a dialog asks about: the command, file, URL or host alone in the code box, the Agent's
 * description under it as secondary text.
 */
export function Subject({
  code,
  description,
}: {
  code: string | null;
  description: string | null;
}) {
  const styles = useStyles();
  if (!code && !description) return null;
  return (
    <BoundedScroll testID="blocked-subject">
      <View style={styles.stack}>
        {code ? (
          <Card level="control" style={styles.code}>
            <Text variant="mono" testID="blocked-subject-code">
              {code}
            </Text>
          </Card>
        ) : null}
        {description ? (
          <Text variant="subheadline" tone="secondary" testID="blocked-subject-description">
            {description}
          </Text>
        ) : null}
      </View>
    </BoundedScroll>
  );
}
