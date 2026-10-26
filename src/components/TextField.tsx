import { useState, type Ref } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputInstance, type TextInputProps } from 'react-native';
import { colors, fonts, radius } from '@/lib/theme';

type Props = TextInputProps & { label: string; optional?: boolean; ref?: Ref<TextInputInstance> };

// React 19: `ref` is a normal prop, no forwardRef needed.
export function TextField({ label, optional, style, ref, ...rest }: Props) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.group}>
      <Text style={styles.label}>
        {label}
        {optional ? <Text style={styles.optional}>  optional</Text> : null}
      </Text>
      <TextInput
        {...rest}
        ref={ref}
        placeholderTextColor={colors.textMuted}
        onFocus={(e) => {
          setFocused(true);
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          rest.onBlur?.(e);
        }}
        style={[styles.input, focused && styles.inputFocused, style]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 6 },
  label: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.textSecondary },
  optional: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },
  input: {
    height: 52,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: colors.bgSecondary,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.text,
  },
  inputFocused: { borderColor: colors.blue, backgroundColor: colors.white },
});
