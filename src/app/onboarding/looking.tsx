import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { StepScreen } from '@/components/onboarding/StepScreen';
import { Chip, ChipGrid } from '@/components/onboarding/Chip';
import { OptionRow } from '@/components/onboarding/OptionRow';
import { useOnboarding } from '@/lib/onboarding-context';
import { CONTENT_LOOKING, MUSICIAN_LOOKING, type LookingOption } from '@/lib/onboarding-data';
import { toggleIn } from '@/lib/toggle';
import { colors, fonts } from '@/lib/theme';

// Step 4: who do you want to collab with? Includes the other creator type (cross-type matching).
export default function LookingStep() {
  const { draft, saveStep } = useOnboarding();
  const isMusician = draft.creatorType !== 'content';
  const options = isMusician ? MUSICIAN_LOOKING : CONTENT_LOOKING;

  const [looking, setLooking] = useState<string[]>(draft.lookingFor ?? []);
  const [details, setDetails] = useState<Record<string, string[]>>(draft.lookingForDetails ?? {});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleRow(value: string) {
    setLooking((list) => {
      // "Open to anything" stands alone; picking a specific row turns it off, and vice versa.
      if (value === 'anything') return list.includes('anything') ? [] : ['anything'];
      return toggleIn(list.filter((v) => v !== 'anything'), value);
    });
  }

  function toggleSub(row: string, sub: string) {
    setDetails((d) => ({ ...d, [row]: toggleIn(d[row] ?? [], sub) }));
  }

  async function next() {
    if (looking.length === 0) return;
    setSaving(true);
    setError(null);
    // Only keep sub-picks for rows that are still selected.
    const kept = Object.fromEntries(Object.entries(details).filter(([row, subs]) => looking.includes(row) && subs.length > 0));
    try {
      await saveStep({ lookingFor: looking, lookingForDetails: kept });
      router.push('/onboarding/taste');
    } catch {
      setError('Couldn’t save. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <StepScreen
      step="looking"
      title="Looking to collab with..."
      subtitle="What kind of creative are you looking to Collab with? Pick as many as you like."
      onContinue={next}
      continueDisabled={looking.length === 0}
      saving={saving}
      error={error}
      footerHint={looking.length === 0 ? 'Pick at least one' : undefined}
    >
      <View style={styles.list}>
        {options.map((o) => (
          <LookingRow
            key={o.value}
            option={o}
            selected={looking.includes(o.value)}
            subs={details[o.value] ?? []}
            onToggle={() => toggleRow(o.value)}
            onToggleSub={(sub) => toggleSub(o.value, sub)}
          />
        ))}
      </View>
    </StepScreen>
  );
}

function LookingRow(props: {
  option: LookingOption;
  selected: boolean;
  subs: string[];
  onToggle: () => void;
  onToggleSub: (sub: string) => void;
}) {
  const { option, selected, subs } = props;
  const expandable = !!option.subOptions;
  const detail =
    expandable && selected
      ? subs.length > 0
        ? subs.map((v) => option.subOptions!.find((s) => s.value === v)?.label ?? v).join(', ')
        : 'Any'
      : expandable
        ? 'Tap to choose specific types'
        : undefined;

  return (
    <OptionRow
      label={option.label}
      emoji={option.emoji}
      selected={selected}
      expandable={expandable}
      detail={detail}
      onPress={props.onToggle}
    >
      {expandable ? (
        <>
          <Text style={styles.subPrompt}>{option.subPrompt}</Text>
          <ChipGrid>
            {option.subOptions!.map((s) => (
              <Chip
                key={s.value}
                size="sm"
                label={s.label}
                emoji={s.emoji}
                selected={subs.includes(s.value)}
                onPress={() => props.onToggleSub(s.value)}
              />
            ))}
          </ChipGrid>
        </>
      ) : null}
    </OptionRow>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  subPrompt: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.textSecondary },
});
