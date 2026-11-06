import { useState } from 'react';
import { StepScreen } from '@/components/onboarding/StepScreen';
import { Chip, ChipGrid } from '@/components/onboarding/Chip';
import { OpenToAll } from '@/components/onboarding/OpenToAll';
import { useOnboarding } from '@/lib/onboarding-context';
import { GENRES, INTERESTS } from '@/lib/onboarding-data';
import { toggleIn } from '@/lib/toggle';

// Step 4: genres (musicians) or content niches (creators), with "Open to all".
export default function TasteStep() {
  const { draft, saveStep, advance } = useOnboarding();
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

      <OpenToAll
        label={isMusician ? 'Open to all genres' : 'Open to all niches'}
        detail="Happy to work outside my picks"
        selected={openToAll}
        onPress={() => setOpenToAll((v) => !v)}
      />
    </StepScreen>
  );
}
