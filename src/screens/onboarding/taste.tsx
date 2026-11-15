import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { TagInput } from '@/components/onboarding/TagInput';
import { fonts, makeStyles } from '@/lib/theme';
import { StepScreen } from '@/components/onboarding/StepScreen';
import { Chip, ChipGrid } from '@/components/onboarding/Chip';
import { OpenToAll } from '@/components/onboarding/OpenToAll';
import { useOnboarding } from '@/lib/onboarding-context';
import { GENRES, INTERESTS } from '@/lib/onboarding-data';
import { toggleIn } from '@/lib/toggle';

// Step 4 of 5: genres (musicians) or content niches (creators), with "Open to all".
export default function TasteStep() {
  const styles = useStyles();
  const { draft, saveStep, advance } = useOnboarding();
  const isMusician = draft.creatorType !== 'content';
  const options = isMusician ? GENRES : INTERESTS;

  const [picked, setPicked] = useState<string[]>((isMusician ? draft.genres : draft.interests) ?? []);
  const [openToAll, setOpenToAll] = useState(draft.openToAll ?? false);
  const [custom, setCustom] = useState<string[]>(draft.soundsCustom ?? []);
  const [showCustom, setShowCustom] = useState((draft.soundsCustom ?? []).length > 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = picked.length > 0 || openToAll || custom.length > 0;

  async function next() {
    if (!ready) return;
    setSaving(true);
    setError(null);
    try {
      await saveStep({ ...(isMusician ? { genres: picked } : { interests: picked }), openToAll, soundsCustom: custom });
      advance('/onboarding/showcase');
    } catch {
      setError('Couldn’t save. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <StepScreen
      step="taste"
      onSkip={() => advance('/onboarding/showcase')}
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

      {showCustom ? (
        <TagInput
          tags={custom}
          onChange={setCustom}
          placeholder={isMusician ? 'e.g. Gospel, Drill, Lo-fi' : 'e.g. Skincare, Cars, DIY'}
          label={isMusician ? 'Other genres' : 'Other niches'}
        />
      ) : (
        <Pressable onPress={() => setShowCustom(true)} hitSlop={8} accessibilityRole="button">
          <Text style={styles.addOther}>{isMusician ? '＋ Add another genre' : '＋ Add another niche'}</Text>
        </Pressable>
      )}

      <OpenToAll
        label={isMusician ? 'Open to all genres' : 'Open to all niches'}
        selected={openToAll}
        onPress={() => setOpenToAll((v) => !v)}
      />
    </StepScreen>
  );
}

const useStyles = makeStyles((colors) => ({
  addOther: { fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.blue, marginTop: 4 },
}));
