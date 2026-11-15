import { t } from '@openagentspocket/i18n';
import { airy, CommandBlock, Tappable, Text, useTheme } from '@openagentspocket/ui';
import { View } from 'react-native';
import { useOpenLink } from '@/links/useOpenLink';
import type { GuideStep } from './setupGuideSteps';

interface SetupStepProps {
  number: number;
  step: GuideStep;
}

/** One numbered step of the Setup Guide: a badge, a title, a sentence, then links or commands. */
export function SetupStep({ number, step }: SetupStepProps) {
  const theme = useTheme();
  const openLink = useOpenLink();
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: theme.spacing.sm,
        padding: theme.spacing.md,
      }}
      accessible
      accessibilityLabel={`${number}. ${step.title}. ${step.detail}`}
      testID={`guide-step-${number}`}
    >
      <View
        style={{
          width: 26,
          height: 26,
          borderRadius: theme.radius.capsule,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.wash(theme.colors.accent),
        }}
      >
        <Text variant="subheadline" semibold tone="accent">
          {String(number)}
        </Text>
      </View>
      <View style={{ flex: 1, gap: theme.spacing.xs }}>
        <View style={{ gap: airy.line }}>
          <Text variant="headline">{step.title}</Text>
          <Text variant="subheadline" tone="secondary">
            {step.detail}
          </Text>
        </View>
        {step.link ? (
          <Tappable accessibilityRole="link" onPress={() => void openLink(step.link?.url ?? '')}>
            <Text variant="subheadline" tone="accent">
              {step.link.label}
            </Text>
          </Tappable>
        ) : null}
        {step.commands ? (
          <CommandBlock lines={step.commands} copyLabel={t('Copy')} copiedLabel={t('Copied')} />
        ) : null}
      </View>
    </View>
  );
}
