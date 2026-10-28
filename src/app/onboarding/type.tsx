import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { StepScreen } from '@/components/onboarding/StepScreen';
import { useOnboarding } from '@/lib/onboarding-context';
import { CONTENT_SKILLS, MUSICIAN_SKILLS, type CreatorType, type Option } from '@/lib/onboarding-data';
import { colors, fonts, radius } from '@/lib/theme';

const TYPES: { value: CreatorType; label: string; emoji: string; examples: Option[] }[] = [
  { value: 'musician', label: 'Musician', emoji: '🎵', examples: MUSICIAN_SKILLS },
  { value: 'content', label: 'Content Creator', emoji: '🎬', examples: CONTENT_SKILLS },
];

// Step 2: I am a...
export default function TypeStep() {
  const { draft, saveStep } = useOnboarding();
  const [type, setType] = useState<CreatorType | undefined>(draft.creatorType);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function next() {
    if (!type) return;
    setSaving(true);
    setError(null);
    try {
      // Switching type clears answers that only made sense for the other type.
      const switched = draft.creatorType && draft.creatorType !== type;
      await saveStep(
        switched
          ? { creatorType: type, skills: [], instruments: [], lookingFor: [], lookingForDetails: {} }
          : { creatorType: type },
      );
      router.push('/onboarding/skills');
    } catch {
      setError('Couldn’t save. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <StepScreen
      step="type"
      emoji="✨"
      title="I am a..."
      subtitle="Choose the path that best describes your creative focus. You’ll get specific next."
      onContinue={next}
      continueDisabled={!type}
      saving={saving}
      error={error}
    >
      <View style={styles.list}>
        {TYPES.map((t) => {
          const selected = type === t.value;
          return (
            <Pressable
              key={t.value}
              onPress={() => setType(t.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={({ pressed }) => [styles.card, selected && styles.cardOn, pressed && { opacity: 0.85 }]}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardEmoji}>{t.emoji}</Text>
                <Text style={[styles.cardTitle, selected && { color: colors.blue }]}>{t.label}</Text>
                <View style={[styles.radio, selected && styles.radioOn]}>{selected ? <View style={styles.radioDot} /> : null}</View>
              </View>
              <View style={styles.examples}>
                {t.examples.map((e) => (
                  <View key={e.value} style={[styles.example, selected && styles.exampleOn]}>
                    <Text style={styles.exampleEmoji}>{e.emoji}</Text>
                    <Text style={styles.exampleText}>{e.label}</Text>
                  </View>
                ))}
              </View>
            </Pressable>
          );
        })}
      </View>
    </StepScreen>
  );
}

const styles = StyleSheet.create({
  list: { gap: 14 },
  card: { borderWidth: 2, borderColor: colors.border, borderRadius: radius.md, padding: 18, gap: 14, backgroundColor: colors.white },
  cardOn: { borderColor: colors.blue, backgroundColor: 'rgba(75,163,199,0.06)' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardEmoji: { fontSize: 34 },
  cardTitle: { flex: 1, fontFamily: fonts.heading, fontSize: 21, color: colors.text },
  radio: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: colors.blue },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.blue },
  examples: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  example: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.bgSecondary,
  },
  exampleOn: { backgroundColor: colors.white },
  exampleEmoji: { fontSize: 13 },
  exampleText: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary },
});
