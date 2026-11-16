import {
  confirm,
  Icon,
  ListRow,
  NavRow,
  PaletteDots,
  PickerRow,
  StepperRow,
  ToggleRow,
} from '@openagentspocket/ui';
import { useRouter } from 'expo-router';
import { useOpenLink } from '@/links/useOpenLink';
import { CustomRow } from './customRows';
import { useAuthenticator, useSettingsStore } from './SettingsProvider';
import { pickerChoices, type SettingsContext, type SettingsRow } from './schema';

interface Props {
  row: SettingsRow;
  ctx: SettingsContext;
}

/** One schema row as a primitive: the only place a row kind turns into UI. */
export function SettingsRowView({ row, ctx }: Props) {
  const router = useRouter();
  const openLink = useOpenLink();
  const store = useSettingsStore();
  const authenticator = useAuthenticator();
  const title = row.title(ctx);
  const subtitle = row.subtitle?.(ctx);

  switch (row.kind) {
    case 'page':
      return (
        <NavRow
          title={title}
          subtitle={subtitle}
          icon={row.icon}
          value={row.value?.(ctx)}
          valueLeading={
            row.accessory === 'themeDots' ? <PaletteDots themeId={ctx.themeId} /> : undefined
          }
          onPress={() => router.push({ pathname: '/settings/[page]', params: { page: row.page } })}
          testID={row.id}
        />
      );
    case 'route':
      // Hidden until the screen it opens exists.
      if (!row.route) return null;
      return (
        <NavRow
          title={title}
          subtitle={subtitle}
          icon={row.icon}
          value={row.value?.(ctx)}
          onPress={() => router.push(row.route as never)}
          testID={row.id}
        />
      );
    case 'external':
      return (
        <ListRow
          title={title}
          icon={row.icon ?? 'info'}
          trailing={<Icon name="arrowUp" size={13} color="textTertiary" />}
          onPress={() => void openLink(row.url)}
          testID={row.id}
        />
      );
    case 'info':
      return (
        <ListRow
          title={title}
          subtitle={subtitle}
          icon={row.icon}
          value={row.value(ctx)}
          testID={row.id}
        />
      );
    case 'toggle':
      return (
        <ToggleRow
          title={title}
          subtitle={subtitle}
          value={ctx.values[row.key]}
          onValueChange={async (next) => {
            // Turning the lock on or off asks the owner first, as the Swift app does.
            if (row.requireAuth) {
              const result = await authenticator.authenticate(title);
              // A device with no auth set up cannot prompt; never leave the owner unable to change it.
              if (result !== 'success' && result !== 'unavailable') return;
            }
            store.set(row.key, next);
          }}
          testID={row.id}
        />
      );
    case 'picker': {
      const options = pickerChoices(row, ctx).map((option) => ({
        value: option.value,
        label: option.label(ctx),
      }));
      const stored = ctx.values[row.key];
      // A stored value no longer offered (a language the recognizer dropped) shows as the first choice.
      const value = options.some((option) => option.value === stored)
        ? stored
        : (options[0]?.value ?? stored);
      return (
        <PickerRow
          title={title}
          options={options}
          value={value}
          onChange={(next) => store.setRaw(row.key, next)}
          testID={row.id}
        />
      );
    }
    case 'stepper':
      return (
        <StepperRow
          title={title}
          value={ctx.values[row.key]}
          min={row.min}
          max={row.max}
          format={row.format}
          onChange={(value) => store.set(row.key, value)}
          testID={row.id}
        />
      );
    case 'reset':
      return (
        <ListRow
          title={title}
          onPress={() => {
            // Not async: the press handler must return at once while the dialog is open.
            void confirm({ title, destructive: true, confirmLabel: title }).then((ok) => {
              if (ok) store.reset(row.keys);
            });
          }}
          testID={row.id}
        />
      );
    case 'custom':
      return <CustomRow row={row} ctx={ctx} />;
  }
}
