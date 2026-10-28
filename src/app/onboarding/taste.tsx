import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { StepScreen } from '@/components/onboarding/StepScreen';
import { Chip, ChipGrid } from '@/components/onboarding/Chip';
import { useOnboarding } from '@/lib/onboarding-context';
import { GENRES, INTERESTS } from '@/lib/onboarding-data';
import { toggleIn } from '@/lib/toggle';
import { colors, fonts, radius } from '@/lib/theme';

// Step 5: genres (musicians) or content niches (creators), with "Open to all".
export default function TasteStep() {
  const { draft, saveStep } = useOnboarding();
  const isMusician = draft.creatorType !== 'content';
  const options = isMusician ? GENRES : INTERESTS;

  const [picked, setPicked] = useState<string[]>((isMusician ? draft.genres : draft.interests) ?? []);
  const [openToAll, setOpenToAll] = useState(draft.openToAll ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = picked.length > 0 || openToAll;

  async function next() {
    if (!ready) return;
    setSaving(true);
    setError(null);
    try {
      await saveStep(isMusician ? { genres: picked, openToAll } : { interests: picked, openToAll });
      router.push('/onboarding/showcase');
    } catch {
      setError('Couldn’t save. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <StepScreen
      step="taste"
      title={isMusician ? 'Your sound 🎶' : 'Your vibe 🎯'}
      subtitle={
        isMusician
          ? 'Pick the genres you make and the ones you’d like to explore.'
          : 'Pick your content niches and passions.'
      }
      onContinue={next}
      continueDisabled={!ready}
      saving={saving}
      error={error}
      footerHint={ready ? undefined : 'Pick at least one, or choose “Open to all”'}
    >
      <ChipGrid>
        {options.map((o) => (
          <Chip
            key={o.value}
            label={o.label}
            emoji={o.emoji}
            selected={picked.includes(o.value)}
            onPress={() => setPicked((p) => toggleIn(p, o.value))}
          />
        ))}
      </ChipGrid>

      <Pressable
        onPress={() => setOpenToAll((v) => !v)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: openToAll }}
        style={({ pressed }) => [styles.openAll, openToAll && styles.openAllOn, pressed && { opacity: 0.8 }]}
      >
        <Text style={styles.openAllEmoji}>🌈</Text>
        <Text style={[styles.openAllText, openToAll && { color: colors.blue }]}>
          {isMusician ? 'Open to all genres' : 'Open to all niches'}
        </Text>
        {openToAll ? <Text style={styles.check}>✓</Text> : null}
      </Pressable>
      <Text style={styles.note}>
        Your picks still show on your profile. “Open to all” means you’re happy to work outside them too.
      </Text>
    </StepScreen>
  );
}

const styles = StyleSheet.create({
  openAll: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: 'rgba(163,153,199,0.14)',
  },
  openAllOn: { borderColor: colors.blue, backgroundColor: 'rgba(75,163,199,0.12)' },
  openAllEmoji: { fontSize: 20 },
  openAllText: { fontFamily: fonts.bodySemibold, fontSize: 16, color: colors.text },
  check: { fontFamily: fonts.bodySemibold, fontSize: 16, color: colors.blue },
  note: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.textMuted, textAlign: 'center', marginTop: -8 },
});
