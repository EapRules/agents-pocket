import {
  type BlockedCardState,
  type BlockedDialog,
  excerptReading,
  isApprovalDialog,
  optionAt,
  splitAnswers,
} from '@openagentspocket/core';
import { t } from '@openagentspocket/i18n';
import {
  Button,
  Card,
  DisclosureChevron,
  Icon,
  makeStyles,
  Tappable,
  Text,
} from '@openagentspocket/ui';
import { useState } from 'react';
import { View } from 'react-native';
import { type Answer, Answers } from './Answers';
import { CardKeys } from './CardKeys';
import {
  cardTitle,
  headlineTitle,
  isMultiSelect,
  isTappable,
  optionKind,
  stopLabel,
} from './dialogModel';
import { GenericDialog } from './GenericDialog';
import { Subject } from './Subject';
import { cardText } from './text';
import { UnreadableNotice } from './UnreadableNotice';

const useStyles = makeStyles((th) => ({
  header: { flexDirection: 'row', alignItems: 'center', gap: th.spacing.xs },
  title: { flex: 1 },
  choices: { gap: th.spacing.xs },
  actions: { flexDirection: 'row', justifyContent: 'center', gap: th.spacing.md },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: th.spacing.xs,
    minHeight: th.metrics.minTapSize,
  },
}));

export interface BlockedCardProps {
  state: BlockedCardState;
  onChoose: (ordinal: number) => void;
  /** Leaves exactly these answers checked on a multi-select question, then goes on. */
  onSubmitSelection: (ordinals: number[]) => void;
  onStop: () => void;
  onPress: (number: number) => void;
  onKeys: (keys: string[]) => void;
  onCollapsedChange: (collapsed: boolean) => void;
  /** The way out of whatever the card cannot do. */
  onShowTerminal?: () => void;
}

/** What the dialog asks about: the command, file, URL or host, and the Agent's own description. */
function subjectOf(dialog: BlockedDialog): { description: string | null; code: string | null } {
  const { subject } = dialog;
  const code = subject.command ?? subject.filePath ?? subject.url ?? subject.host;
  const description = subject.commandDescription ?? subject.reason ?? null;
  if (code) return { description, code };
  return { description: dialog.body.join('\n') || null, code: null };
}

const unreadableMessage = () =>
  t(
    "The Agent is waiting on something Agentico can't read. Answer with these keys or in the terminal.",
  );

/** A multi-select question's answers: toggles here, keys only once the selection goes. */
function Selection({
  dialog,
  disabled,
  onSubmit,
}: {
  dialog: BlockedDialog;
  disabled: boolean;
  onSubmit: (ordinals: number[]) => void;
}) {
  const styles = useStyles();
  const answers = dialog.options.filter((option) => option.role === 'answer');
  const button = dialog.options.find((option) => option.role === 'next');
  const [selection, setSelection] = useState<readonly number[]>(() =>
    dialog.focus.checked.filter((ordinal) => answers.some((a) => a.ordinal === ordinal)),
  );
  const toggle = (ordinal: number) =>
    setSelection((current) =>
      current.includes(ordinal)
        ? current.filter((other) => other !== ordinal)
        : [...current, ordinal],
    );
  return (
    <>
      {answers.map((option) => {
        const checked = selection.includes(option.ordinal);
        return (
          <Tappable
            key={option.ordinal}
            style={styles.toggle}
            onPress={() => toggle(option.ordinal)}
            accessibilityRole="checkbox"
            accessibilityLabel={option.label}
            accessibilityState={{ checked }}
            testID={`blocked-toggle-${option.ordinal}`}
          >
            <Icon name={checked ? 'statusDone' : 'statusIdle'} color="accent" />
            <Text variant="body">{option.label}</Text>
          </Tappable>
        );
      })}
      <Button
        title={button?.label ?? t('Next')}
        kind="primary"
        disabled={disabled || selection.length === 0}
        onPress={() => onSubmit([...selection].sort((a, b) => a - b))}
        testID="blocked-submit-selection"
      />
    </>
  );
}

function ShowTerminal({ onPress }: { onPress: () => void }) {
  return (
    <Button
      title={t('Show Terminal')}
      kind="text"
      size="mini"
      onPress={onPress}
      testID="blocked-show-terminal"
    />
  );
}

function Known({
  dialog,
  state,
  onChoose,
  onSubmitSelection,
  onStop,
  onShowTerminal,
}: Pick<BlockedCardProps, 'onChoose' | 'onSubmitSelection' | 'onStop' | 'onShowTerminal'> & {
  dialog: BlockedDialog;
  state: BlockedCardState;
}) {
  const styles = useStyles();
  const { description, code } = subjectOf(dialog);
  const disabled = state.progress !== 'ready';
  const stop = stopLabel(dialog, state.progress);
  const multi = isMultiSelect(dialog);
  const buttons = dialog.options.filter(
    (option) => isTappable(option) && !(multi && ['answer', 'next'].includes(option.role)),
  );
  const answers = buttons.map(
    (option): Answer => ({
      key: option.ordinal,
      label: option.label,
      number: null,
      kind: optionKind(option),
      persistent: option.role === 'approvePersistent',
      testID: `blocked-option-${option.ordinal}`,
      onPress: () => onChoose(option.ordinal),
    }),
  );
  // Only an approval pairs its answers; a question or a plan keeps its list.
  const layout = isApprovalDialog(dialog)
    ? splitAnswers(answers, (answer) => optionAt(dialog, answer.key)?.role ?? null)
    : { pair: null, rest: answers };
  return (
    <>
      <Subject code={code} description={description} />
      <View style={styles.choices}>
        {multi ? (
          <Selection dialog={dialog} disabled={disabled} onSubmit={onSubmitSelection} />
        ) : null}
        <Answers layout={layout} disabled={disabled} />
        {dialog.options.some((option) => !isTappable(option)) ? (
          <Text variant="caption" tone="secondary">
            {t('Type your own answer in the terminal.')}
          </Text>
        ) : null}
        <View style={styles.actions}>
          {stop ? (
            <Button
              title={stop}
              kind="text"
              size="mini"
              disabled={state.progress === 'acting'}
              onPress={onStop}
              testID="blocked-stop"
            />
          ) : null}
          {onShowTerminal ? <ShowTerminal onPress={onShowTerminal} /> : null}
        </View>
      </View>
    </>
  );
}

/**
 * The Blocked card: the dialog on the Agent's screen as a native card. Presentational; the
 * store (`BlockedCardStore`) decides what is offered and what is sent.
 */
export function BlockedCard(props: BlockedCardProps) {
  const { state, onCollapsedChange } = props;
  const styles = useStyles();
  const { content } = state;
  // A question no read shows has only its row to say so: no keys go out on a guess.
  if (content.kind === 'none' || content.kind === 'questionUnread') return null;
  const heading =
    content.kind === 'card'
      ? cardTitle(content.dialog)
      : content.kind === 'generic'
        ? content.shown
          ? headlineTitle({ actor: content.shown.toolName, verb: 'run' })
          : (excerptReading(content.excerpt).question ?? t('Needs you'))
        : t('Needs you');
  return (
    <Card accent="warning" testID="blocked-card">
      <Tappable
        style={styles.header}
        onPress={() => onCollapsedChange(!state.isCollapsed)}
        accessibilityRole="button"
        accessibilityLabel={`${heading}, ${state.isCollapsed ? t('Expand') : t('Collapse')}`}
        accessibilityState={{ expanded: !state.isCollapsed }}
        testID="blocked-collapse"
      >
        <Icon name="hand" size={16} color="warning" />
        <Text
          variant="subheadline"
          semibold
          style={styles.title}
          numberOfLines={state.isCollapsed ? 1 : 4}
        >
          {heading}
        </Text>
        <DisclosureChevron expanded={!state.isCollapsed} />
      </Tappable>
      {state.isCollapsed ? null : (
        <>
          {content.kind === 'card' ? (
            <Known
              key={state.dialogGeneration}
              dialog={content.dialog}
              state={state}
              onChoose={props.onChoose}
              onSubmitSelection={props.onSubmitSelection}
              onStop={props.onStop}
              onShowTerminal={props.onShowTerminal}
            />
          ) : null}
          {content.kind === 'generic' ? (
            <GenericDialog
              excerpt={content.excerpt}
              shown={content.shown ?? null}
              disabled={state.progress !== 'ready'}
              keysDisabled={state.progress === 'acting'}
              onPress={props.onPress}
              onKeys={props.onKeys}
            />
          ) : null}
          {content.kind === 'unreadable' ? (
            <>
              {props.onShowTerminal ? (
                <UnreadableNotice
                  message={unreadableMessage()}
                  onShowTerminal={props.onShowTerminal}
                  testID="blocked-unreadable"
                />
              ) : (
                <Text variant="body">{unreadableMessage()}</Text>
              )}
              <CardKeys disabled={state.progress === 'acting'} onKeys={props.onKeys} />
            </>
          ) : null}
          {state.notice ? (
            <Text variant="footnote" tone="warning" testID="blocked-notice">
              {cardText(state.notice)}
            </Text>
          ) : null}
          {props.onShowTerminal && content.kind === 'generic' ? (
            <ShowTerminal onPress={props.onShowTerminal} />
          ) : null}
        </>
      )}
    </Card>
  );
}
