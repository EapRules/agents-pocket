import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, type ViewStyle } from 'react-native';
import { impact } from '../haptics';
import { usePulse } from '../motion';
import { Icon } from '../primitives/Icon';
import { Tappable } from '../primitives/Tappable';
import { makeStyles } from '../theme/theme';

const RING = 2;

const useStyles = makeStyles((t) => ({
  listening: { backgroundColor: t.wash(t.colors.danger) },
  ring: {
    ...StyleSheet.absoluteFill,
    borderRadius: t.radius.capsule,
    borderWidth: RING,
    borderColor: t.colors.danger,
  },
}));

interface DictationButtonProps {
  listening: boolean;
  onToggle: () => void;
  /** The circle it is drawn in (size, shape, resting fill), shared with the card's other circles. */
  style: ViewStyle;
  labels: { dictate: string; stopDictating: string };
  testID: string;
}

/**
 * A light tap when listening starts and when it ends, however it ended; none on first draw. The
 * card that holds the microphone calls it, since the microphone itself leaves once a dictated
 * draft stops. Returns `listening`.
 */
export function useListeningTap(listening: boolean): boolean {
  const was = useRef(listening);
  useEffect(() => {
    if (was.current === listening) return;
    was.current = listening;
    impact('light');
  }, [listening]);
  return listening;
}

/**
 * The microphone that starts and stops dictation. While it listens it reads as recording: a
 * danger wash with a ring that pulses (still under Reduce Motion), kept apart from Stop's solid
 * fill and square.
 */
export function DictationButton({
  listening,
  onToggle,
  style,
  labels,
  testID,
}: DictationButtonProps) {
  const styles = useStyles();
  const pulse = usePulse(listening);
  return (
    <Tappable
      style={[style, listening && styles.listening]}
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityLabel={listening ? labels.stopDictating : labels.dictate}
      accessibilityState={{ selected: listening }}
      testID={testID}
    >
      {listening ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.ring, { opacity: pulse }]}
          testID={`${testID}-listening`}
        />
      ) : null}
      <Icon name="mic" size={18} color={listening ? 'danger' : 'textPrimary'} />
    </Tappable>
  );
}
