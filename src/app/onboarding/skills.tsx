import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { StepScreen } from '@/components/onboarding/StepScreen';
import { Chip, ChipGrid } from '@/components/onboarding/Chip';
import { OptionRow } from '@/components/onboarding/OptionRow';
import { useOnboarding } from '@/lib/onboarding-context';
import { CONTENT_SKILLS, INSTRUMENTS, MUSICIAN_SKILLS } from '@/lib/onboarding-data';
import { toggleIn } from '@/lib/toggle';
import { colors, fonts } from '@/lib/theme';

// Step 3: what kind of musician / creator are you?
export default function SkillsStep() {
  const { draft, saveStep } = useOnboarding();
  const isMusician = draft.creatorType !== 'content';
  const options = isMusician ? MUSICIAN_SKILLS : CONTENT_SKILLS;

  const [skills, setSkills] = useState<string[]>(draft.skills ?? []);
  const [instruments, setInstruments] = useState<string[]>(draft.instruments ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const playsInstruments = skills.includes('instrumentalist');
  const needsInstrument = playsInstruments && instruments.length === 0;

  async function next() {
    if (skills.length === 0 || needsInstrument) return;
    setSaving(true);
    setError(null);
    try {
      await saveStep({ skills, instruments: playsInstruments ? instruments : [] });
      router.push('/onboarding/looking');
    } catch {
      setError('Couldn’t save. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <StepScreen
      step="skills"
      title={isMusician ? 'What kind of musician are you?' : 'What kind of content do you make?'}
      subtitle="Pick everything that fits ✨"
      onContinue={next}
      continueDisabled={skills.length === 0 || needsInstrument}
      saving={saving}
      error={error}
      footerHint={skills.length === 0 ? 'Pick at least one' : needsInstrument ? 'Pick at least one instrument' : undefined}
    >
      <View style={styles.list}>
        {options.map((o) => {
          const selected = skills.includes(o.value);
          const isInstrumentRow = o.value === 'instrumentalist';
          return (
            <OptionRow
              key={o.value}
              label={o.label}
              emoji={o.emoji}
              selected={selected}
              expandable={isInstrumentRow}
              detail={isInstrumentRow && selected && instruments.length > 0 ? labelsFor(instruments) : undefined}
              onPress={() => setSkills((s) => toggleIn(s, o.value))}
            >
              {isInstrumentRow ? (
                <>
                  <Text style={styles.subPrompt}>What do you play?</Text>
                  <ChipGrid>
                    {INSTRUMENTS.map((i) => (
                      <Chip
                        key={i.value}
                        size="sm"
                        label={i.label}
                        emoji={i.emoji}
                        selected={instruments.includes(i.value)}
                        onPress={() => setInstruments((list) => toggleIn(list, i.value))}
                      />
                    ))}
                  </ChipGrid>
                </>
              ) : null}
            </OptionRow>
          );
        })}
      </View>
    </StepScreen>
  );
}

function labelsFor(values: string[]) {
  return values.map((v) => INSTRUMENTS.find((i) => i.value === v)?.label ?? v).join(', ');
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  subPrompt: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.textSecondary },
});
