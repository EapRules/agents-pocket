import { type ConversationSetting, settingValueText } from '@openagentspocket/core';
import { t } from '@openagentspocket/i18n';
import {
  Button,
  ButtonRow,
  CommandBlock,
  Icon,
  ListRow,
  makeStyles,
  Section,
  Sheet,
  Text,
  ToggleRow,
} from '@openagentspocket/ui';
import { View } from 'react-native';
import { renderMessage } from '@/usage/usageText';
import type { PendingChange, SettingChange } from './useSettingChange';

const useStyles = makeStyles((th) => ({
  body: { gap: th.spacing.md, padding: th.spacing.md },
  pending: { gap: th.spacing.sm, padding: th.spacing.md },
}));

interface Props {
  visible: boolean;
  onClose: () => void;
  settings: readonly ConversationSetting[];
  change: SettingChange;
}

const shown = (value: ConversationSetting['value']) => {
  const text = settingValueText(value);
  return text === null ? t('Unknown') : renderMessage(text);
};

/** One section per setting, in the program's order; what each offers comes from its `apply`. */
function SettingSection({ item, change }: { item: ConversationSetting; change: SettingChange }) {
  const { setting, value } = item;
  const reason = change.reason(setting);
  const id = `setting-${setting.id}`;
  const current = change.pending?.setting === setting.id ? change.pending.value : null;
  const selected = current ?? (value.kind === 'known' ? value.value : null);
  const title = renderMessage(setting.title);
  if (setting.apply.kind === 'command' && setting.kind === 'toggle') {
    return (
      <Section footer={reason ?? undefined} testID={id}>
        <ToggleRow
          title={title}
          value={selected === 'on'}
          onValueChange={(on) => change.choose(setting, on ? 'on' : 'off')}
          disabled={reason !== null}
          testID={`${id}-toggle`}
        />
      </Section>
    );
  }
  if (setting.apply.kind === 'command') {
    return (
      <Section title={title} footer={reason ?? undefined} testID={id}>
        {setting.options.map((option) => (
          <ListRow
            key={option.value}
            title={renderMessage(option.title)}
            trailing={option.value === selected ? <Icon name="check" color="accent" /> : null}
            onPress={() => change.choose(setting, option.value)}
            disabled={reason !== null}
            testID={`${id}-${option.value}`}
          />
        ))}
      </Section>
    );
  }
  const terminal = setting.apply.kind === 'terminal';
  return (
    <Section title={title} footer={reason ?? undefined} testID={id}>
      <ListRow title={shown(value)} titleLines={2} testID={`${id}-value`} />
      {terminal ? (
        <ListRow
          title={t('Change in Terminal')}
          titleTone="accent"
          icon="terminal"
          onPress={() => change.changeInTerminal(setting)}
          disabled={reason !== null}
          testID={`${id}-terminal`}
        />
      ) : null}
    </Section>
  );
}

/** What Apply will send and what it means; nothing goes before the second tap. */
function PendingBlock({ pending, change }: { pending: PendingChange; change: SettingChange }) {
  const styles = useStyles();
  return (
    <View style={styles.pending} testID="setting-pending">
      <Text variant="footnote" tone="secondary">
        {t("Sends this to the Agent's terminal:")}
      </Text>
      <CommandBlock
        lines={[pending.command]}
        prompt="›"
        copyLabel={t('Copy')}
        copiedLabel={t('Copied')}
        testID="setting-pending-command"
      />
      {[...(change.refused ? [change.refused] : []), ...pending.notes].map((note) => (
        <Text key={note} variant="footnote" tone="secondary">
          {note}
        </Text>
      ))}
      <ButtonRow>
        <Button
          title={t('Cancel')}
          kind="secondary"
          onPress={change.cancel}
          testID="setting-cancel"
        />
        <Button
          title={t('Apply')}
          onPress={() => void change.apply()}
          loading={change.applying}
          testID="setting-apply"
        />
      </ButtonRow>
    </View>
  );
}

/** The Agent's model, effort and fast mode: shown, chosen, then applied with a second tap. */
export function ConversationSettingsSheet({ visible, onClose, settings, change }: Props) {
  const styles = useStyles();
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={t('Model and Effort')}
      leading={{ label: t('Done'), onPress: onClose, testID: 'settings-done' }}
      detent="fit"
      // What Apply sends stays in view under the list, however long the list.
      footer={
        change.pending ? <PendingBlock pending={change.pending} change={change} /> : undefined
      }
      testID="conversation-settings-sheet"
    >
      <View style={styles.body}>
        {settings.map((item) => (
          <SettingSection key={item.setting.id} item={item} change={change} />
        ))}
        {!change.pending && change.refused ? (
          <Text variant="footnote" tone="secondary" testID="setting-refused">
            {change.refused}
          </Text>
        ) : null}
      </View>
    </Sheet>
  );
}
