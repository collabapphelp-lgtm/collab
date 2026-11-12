import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Sheet } from './Sheet';
import { Button } from '@/components/Button';
import { SHOWCASE, type PromptGroups } from '@/lib/onboarding-data';
import type { ShowcasePrompt } from '@/lib/types';
import { colors, fonts, radius } from '@/lib/theme';

const TABS: { key: keyof PromptGroups; label: string }[] = [
  { key: 'work', label: 'About my work' },
  { key: 'fun', label: 'Just for fun' },
];

type Props = {
  visible: boolean;
  prompts: PromptGroups;
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
  const [tab, setTab] = useState<keyof PromptGroups>(initial && prompts.fun.includes(initial.question) ? 'fun' : 'work');

  const available = prompts[tab].filter((p) => p === initial?.question || !usedQuestions.includes(p));

  if (!question) {
    return (
      <Sheet visible={visible} title="Pick a prompt" onClose={onClose}>
        <View style={styles.tabs} accessibilityRole="tablist">
          {TABS.map((t) => {
            const on = tab === t.key;
            return (
              <Pressable
                key={t.key}
                onPress={() => setTab(t.key)}
                style={[styles.tab, on && styles.tabOn]}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
              >
                <Text style={[styles.tabText, on && styles.tabTextOn]}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.tabHint}>{tab === 'work' ? 'Help people see how you’d work together.' : 'Show a bit of your personality.'}</Text>
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
  tabs: { flexDirection: 'row', backgroundColor: colors.bgSecondary, borderRadius: radius.full, padding: 4, gap: 4 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radius.full },
  tabOn: { backgroundColor: colors.white, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  tabText: { fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.textSecondary },
  tabTextOn: { color: colors.text },
  tabHint: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, marginTop: -4 },
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
