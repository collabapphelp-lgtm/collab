import { useState, type Ref } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View, type TextInputInstance, type TextInputProps } from 'react-native';
import { colors, fonts, radius } from '@/lib/theme';

type Props = TextInputProps & {
  label: string;
  optional?: boolean;
  /** Password field with a Show/Hide button. Replaces `secureTextEntry`. */
  password?: boolean;
  ref?: Ref<TextInputInstance>;
};

// React 19: `ref` is a normal prop, no forwardRef needed.
export function TextField({ label, optional, password, style, ref, ...rest }: Props) {
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);

  return (
    <View style={styles.group}>
      <Text style={styles.label}>
        {label}
        {optional ? <Text style={styles.optional}>  optional</Text> : null}
      </Text>
      <View style={[styles.box, focused && styles.boxFocused]}>
        <TextInput
          {...rest}
          ref={ref}
          secureTextEntry={password ? !revealed : rest.secureTextEntry}
          autoCapitalize={password ? 'none' : rest.autoCapitalize}
          autoCorrect={password ? false : rest.autoCorrect}
          placeholderTextColor={colors.textMuted}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          style={[styles.input, style]}
        />
        {password ? (
          <Pressable
            onPress={() => setRevealed((v) => !v)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
            style={styles.toggle}
          >
            <Text style={styles.toggleText}>{revealed ? 'Hide' : 'Show'}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 6 },
  label: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.textSecondary },
  optional: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: colors.bgSecondary,
  },
  boxFocused: { borderColor: colors.blue, backgroundColor: colors.white },
  input: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 14,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.text,
    // The box handles the focus highlight; drop the browser's own outline in web previews.
    ...Platform.select({ web: { outlineWidth: 0 }, default: {} }),
  },
  toggle: { paddingHorizontal: 14, height: '100%', justifyContent: 'center' },
  toggleText: { fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.blue },
});
