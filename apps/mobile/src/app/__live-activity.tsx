import { Redirect, useLocalSearchParams } from 'expo-router';
import { LiveActivityDemoScreen } from '@/dev/LiveActivityDemoScreen';
import { DEMO_STEPS } from '@/dev/liveActivityDemo';

/**
 * Dev-only. Open with `openagentspocket:///__live-activity?step=start` (or update, end), or one
 * drawn state: one, several, blocked, done.
 */
export default function LiveActivityDemoRoute() {
  const { step } = useLocalSearchParams<{ step?: string }>();
  if (!__DEV__) return <Redirect href="/" />;
  return <LiveActivityDemoScreen autoStep={DEMO_STEPS.find((s) => s === step) ?? null} />;
}
