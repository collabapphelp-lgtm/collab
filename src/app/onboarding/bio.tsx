import { useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { StepScreen } from '@/components/onboarding/StepScreen';
import { useOnboarding } from '@/lib/onboarding-context';
import { BIO_MAX_CHARS } from '@/lib/onboarding-data';
import { colors, fonts, radius } from '@/lib/theme';

const TIPS = [
  { emoji: '💡', text: 'Mention your style, influences, or what makes you unique' },
  { emoji: '🎯', text: 'Be specific about what you’re looking for in a collab' },
];

// Step 7: optional bio, then finish. Finishing flips onboardingComplete, which moves them into the app.
export default function BioStep() {
  const { draft, finish } = useOnboarding();
  const [bio, setBio] = useState(draft.bio ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function done() {
    setSaving(true);
    setError(null);
    try {
      await finish({ bio: bio.trim() });
      // No navigation needed: the app sees onboarding is complete and routes them in.
    } catch {
      setError('Couldn’t save. Check your connection and try again.');
      setSaving(false);
    }
  }

  return (
    <StepScreen
      step="bio"
      emoji="🎉"
      title="Almost there!"
      subtitle="One last thing: tell people a bit about yourself."
      continueLabel="Complete profile 🚀"
      onContinue={done}
      saving={saving}
      error={error}
      footerHint="Your bio is optional. You can add or change it later."
    >
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>✍️ Your bio</Text>
          <Text style={styles.optional}>OPTIONAL</Text>
        </View>
        <TextInput
          value={bio}
          onChangeText={setBio}
          multiline
          maxLength={BIO_MAX_CHARS}
          placeholder="Anything else you want to share?"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          accessibilityLabel="Your bio"
        />
        <Text style={styles.count}>
          {bio.length}/{BIO_MAX_CHARS}
        </Text>
      </View>

      <View style={styles.tips}>
        {TIPS.map((t) => (
          <View key={t.text} style={styles.tip}>
            <Text style={styles.tipEmoji}>{t.emoji}</Text>
            <Text style={styles.tipText}>{t.text}</Text>
          </View>
        ))}
      </View>
    </StepScreen>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 2, borderColor: colors.border, borderRadius: radius.md, padding: 16, gap: 10 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontFamily: fonts.bodySemibold, fontSize: 16, color: colors.text },
  optional: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    letterSpacing: 0.5,
    color: colors.textMuted,
    backgroundColor: colors.bgSecondary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  input: {
    minHeight: 140,
    borderRadius: 12,
    backgroundColor: colors.bgSecondary,
    padding: 14,
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 22,
    color: colors.text,
    textAlignVertical: 'top',
    ...Platform.select({ web: { outlineWidth: 0 }, default: {} }),
  },
  count: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, textAlign: 'right' },
  tips: { gap: 10 },
  tip: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: 'rgba(229,197,71,0.12)',
  },
  tipEmoji: { fontSize: 16 },
  tipText: { flex: 1, fontFamily: fonts.body, fontSize: 14, lineHeight: 19, color: colors.textSecondary },
});
