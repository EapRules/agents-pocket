import { type Ref, useCallback, useLayoutEffect, useRef } from 'react';
import { Platform, TextInput, type TextInputInstance, type TextInputProps } from 'react-native';
import { useTheme } from '../theme/theme';

export type ThemedTextInputProps = Omit<
  TextInputProps,
  | 'placeholderTextColor'
  | 'selectionColor'
  | 'cursorColor'
  | 'selectionHandleColor'
  | 'keyboardAppearance'
> & { ref?: Ref<TextInputInstance> };

/** The slice of a DOM textarea the web sizing reads (the package has no DOM lib). */
interface WebTextarea {
  style?: { height: string };
  scrollHeight: number;
  offsetHeight: number;
  clientHeight: number;
}

/**
 * The one text input: caret, selection and handles in the accent, placeholder in tertiary ink and
 * the keyboard in the theme's appearance. Every field in the app is this (TextField, search,
 * composer, rename...), so no input falls back to the platform's blue or gray.
 */
export function ThemedTextInput({ ref, ...props }: ThemedTextInputProps) {
  const theme = useTheme();
  const node = useRef<TextInputInstance | null>(null);
  const setRef = useCallback(
    (instance: TextInputInstance | null) => {
      node.current = instance;
      if (typeof ref === 'function') ref(instance);
      else if (ref) ref.current = instance;
    },
    [ref],
  );
  // Native multiline fields size themselves to their content (up to the style's maxHeight); a web
  // textarea does not, so its height follows the content here, once for every field. Resetting to
  // auto first lets it shrink back when text is deleted.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the value is the trigger, the effect reads the element
  useLayoutEffect(() => {
    if (Platform.OS !== 'web' || !props.multiline) return;
    const element = node.current as unknown as WebTextarea | null;
    if (!element?.style) return;
    element.style.height = 'auto';
    element.style.height = `${element.scrollHeight + element.offsetHeight - element.clientHeight}px`;
  }, [props.value, props.multiline]);
  return (
    <TextInput
      {...props}
      ref={setRef}
      placeholderTextColor={theme.colors.textTertiary}
      selectionColor={theme.colors.accent}
      cursorColor={theme.colors.accent}
      selectionHandleColor={theme.colors.accent}
      keyboardAppearance={theme.appearance}
    />
  );
}
