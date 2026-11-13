import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { BLOCKED_LANGUAGE_MESSAGE, hasBlockedLanguage } from '@/lib/moderation';
import { SPECIFIC_MAX, SPECIFIC_MAX_CHARS } from '@/lib/onboarding-data';
import { colors, fonts, radius } from '@/lib/theme';

/** Type a word, tap Add (or return) → it becomes a removable tag. Used for specific instruments. */
export function TagInput(props: { tags: string[]; onChange: (tags: string[]) => void; placeholder: string; label: string }) {
  const [text, setText] = useState('');
  const [err, setErr] = useState<string | null>(null);

  function add() {
    const t = text.trim().replace(/\s+/g, ' ');
    if (!t) return;
    if (hasBlockedLanguage(t)) return setErr(BLOCKED_LANGUAGE_MESSAGE);
    if (props.tags.length >= SPECIFIC_MAX) return setErr(`Up to ${SPECIFIC_MAX}.`);
    const pretty = t.charAt(0).toUpperCase() + t.slice(1);
    if (!props.tags.some((x) => x.toLowerCase() === pretty.toLowerCase())) props.onChange([...props.tags, pretty]);
    setText('');
    setErr(null);
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <TextInput
          value={text}
          onChangeText={(t) => {
            setText(t);
            setErr(null);
          }}
          onSubmitEditing={add}
          blurOnSubmit={false}
          returnKeyType="done"
          maxLength={SPECIFIC_MAX_CHARS}
          placeholder={props.placeholder}
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          accessibilityLabel={props.label}
        />
        <Pressable onPress={add} style={({ pressed }) => [styles.add, pressed && { opacity: 0.7 }]} accessibilityRole="button" accessibilityLabel="Add">
          <Text style={styles.addText}>Add</Text>
        </Pressable>
      </View>
      {err ? <Text style={styles.err}>{err}</Text> : null}
      {props.tags.length ? (
        <View style={styles.tags}>
          {props.tags.map((t) => (
            <Pressable
              key={t}
              onPress={() => props.onChange(props.tags.filter((x) => x !== t))}
              style={styles.tag}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${t}`}
            >
              <Text style={styles.tagText}>{t}</Text>
              <Text style={styles.x}>×</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  row: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1,
    borderRadius: radius.sm ?? 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.text,
    ...Platform.select({ web: { outlineWidth: 0 }, default: {} }),
  },
  add: { justifyContent: 'center', paddingHorizontal: 16, borderRadius: 10, backgroundColor: '#E1F0F7' },
  addText: { fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.blue },
  err: { fontFamily: fonts.body, fontSize: 12, color: colors.red },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: colors.blue },
  tagText: { fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.white },
  x: { fontFamily: fonts.bodySemibold, fontSize: 16, color: colors.white, marginTop: -1 },
});
