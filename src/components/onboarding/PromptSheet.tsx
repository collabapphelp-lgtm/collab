import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Sheet } from './Sheet';
import { Button } from '@/components/Button';
import { SHOWCASE } from '@/lib/onboarding-data';
import type { ShowcasePrompt } from '@/lib/types';
import { colors, fonts, radius } from '@/lib/theme';

type Props = {
  visible: boolean;
  prompts: string[];
  /** Prompts already used in other slots, hidden from the list. */
  usedQuestions: string[];
  /** When editing an existing answer. */
  initial?: ShowcasePrompt | null;
  onClose: () => void;
  onSave: (item: ShowcasePrompt) => void;
};

/** Two parts: pick a prompt, then answer it. The parent gives it a new `key` per slot so it starts fresh. */
export function PromptSheet({ visible, prompts, usedQuestions, initial, onClose, onSave }: Props) {
  const [question, setQuestion] = useState<string | null>(initial?.question ?? null);
  const [answer, setAnswer] = useState(initial?.answer ?? '');

  const available = prompts.filter((p) => p === initial?.question || !usedQuestions.includes(p));

  if (!question) {
    return (
      <Sheet visible={visible} title="Pick a prompt" onClose={onClose}>
        {available.map((p) => (
          <Pressable key={p} onPress={() => setQuestion(p)} style={({ pressed }) => [styles.prompt, pressed && styles.promptPressed]}>
            <Text style={styles.promptText}>{p}</Text>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ))}
      </Sheet>
    );
  }

  const trimmed = answer.trim();
  return (
    <Sheet
      visible={visible}
      title={question}
      onClose={onClose}
      footer={
        <Button
          title="Save answer"
          disabled={!trimmed}
          onPress={() => onSave({ type: 'prompt', question, answer: trimmed })}
        />
      }
    >
      <Pressable onPress={() => setQuestion(null)} hitSlop={8}>
        <Text style={styles.change}>‹ Choose a different prompt</Text>
      </Pressable>
      <View style={styles.answerBox}>
        <TextInput
          value={answer}
          onChangeText={setAnswer}
          multiline
          autoFocus
          maxLength={SHOWCASE.promptMaxChars}
          placeholder="Your answer…"
          placeholderTextColor={colors.textMuted}
          style={styles.answer}
          accessibilityLabel={question}
        />
      </View>
      <Text style={styles.count}>
        {answer.length}/{SHOWCASE.promptMaxChars}
      </Text>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  prompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 16,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
  },
  promptPressed: { borderColor: colors.blue, backgroundColor: 'rgba(75,163,199,0.06)' },
  promptText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.text },
  chevron: { fontSize: 22, color: colors.textMuted },
  change: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.blue },
  answerBox: { borderRadius: radius.md, backgroundColor: colors.bgSecondary, padding: 14, minHeight: 150 },
  answer: { fontFamily: fonts.body, fontSize: 16, lineHeight: 22, color: colors.text, minHeight: 120, textAlignVertical: 'top', ...Platform.select({ web: { outlineWidth: 0 }, default: {} }) },
  count: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, textAlign: 'right', marginTop: -6 },
});
