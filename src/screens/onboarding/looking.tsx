import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { StepScreen } from '@/components/onboarding/StepScreen';
import { Chip, ChipGrid } from '@/components/onboarding/Chip';
import { OptionRow } from '@/components/onboarding/OptionRow';
import { OpenToAll } from '@/components/onboarding/OpenToAll';
import { useOnboarding } from '@/lib/onboarding-context';
import { CONTENT_LOOKING, EXPERIENCE, INTENTS, MUSICIAN_LOOKING, type LookingOption } from '@/lib/onboarding-data';
import { TagInput } from '@/components/onboarding/TagInput';
import { toggleIn } from '@/lib/toggle';
import { canonicalList } from '@/lib/labels';
import { colors, fonts } from '@/lib/theme';

// Step 3: who do you want to collab with? Includes the other creator type (cross-type matching).
export default function LookingStep() {
  const { draft, saveStep, advance } = useOnboarding();
  const isMusician = draft.creatorType !== 'content';
  const options = isMusician ? MUSICIAN_LOOKING : CONTENT_LOOKING;

  const [looking, setLooking] = useState<string[]>(draft.lookingFor ?? []);
  const [details, setDetails] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(Object.entries(draft.lookingForDetails ?? {}).map(([k, v]) => [k, canonicalList(v)])),
  );
  const [specific, setSpecific] = useState<string[]>(draft.lookingForSpecific ?? []);
  const [intents, setIntents] = useState<string[]>(draft.intents ?? []);
  const [experience, setExperience] = useState(draft.experience ?? '');
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
      await saveStep({
        lookingFor: looking,
        lookingForDetails: kept,
        lookingForSpecific: looking.includes('instrumentalist') ? specific : [],
        intents,
        experience,
      });
      advance('/onboarding/taste');
    } catch {
      setError('Couldn’t save. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <StepScreen
      step="looking"
      onSkip={() => advance('/onboarding/taste')}
      title="Looking to collab with..."
      subtitle="Who do you want to create with? Pick as many as you like."
      onContinue={next}
      continueDisabled={looking.length === 0}
      saving={saving}
      error={error}
      footerHint={looking.length === 0 ? 'Pick at least one' : undefined}
    >
      <View style={styles.list}>
        <OpenToAll
          label="Open to anything!"
          selected={looking.includes('anything')}
          onPress={() => toggleRow('anything')}
        />
        <View style={styles.orRow}>
          <View style={styles.orLine} />
          <Text style={styles.orText}>or pick specific types</Text>
          <View style={styles.orLine} />
        </View>
        {options.filter((o) => o.value !== 'anything').map((o) => (
          <LookingRow
            key={o.value}
            option={o}
            selected={looking.includes(o.value)}
            subs={details[o.value] ?? []}
            onToggle={() => toggleRow(o.value)}
            onToggleSub={(sub) => toggleSub(o.value, sub)}
            extra={
              o.value === 'instrumentalist' ? (
                <TagInput tags={specific} onChange={setSpecific} placeholder="Something specific? e.g. Cello, Talkbox" label="Specific instruments you're looking for" />
              ) : null
            }
          />
        ))}
      </View>

      <View style={styles.about}>
        <Text style={styles.aboutTitle}>
          You’re here to… <Text style={styles.aboutHint}>Pick any · optional</Text>
        </Text>
        <ChipGrid>
          {INTENTS.map((o) => (
            <Chip key={o.value} size="sm" label={o.label} selected={intents.includes(o.value)} onPress={() => setIntents((l) => toggleIn(l, o.value))} />
          ))}
        </ChipGrid>
        <Text style={[styles.aboutTitle, { marginTop: 6 }]}>
          Experience <Text style={styles.aboutHint}>optional</Text>
        </Text>
        <ChipGrid>
          {EXPERIENCE.map((o) => (
            <Chip key={o.value} size="sm" label={o.label} selected={experience === o.value} onPress={() => setExperience(experience === o.value ? '' : o.value)} />
          ))}
        </ChipGrid>
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
  extra?: React.ReactNode;
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
      value={option.value}
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
                value={s.value}
                selected={subs.includes(s.value)}
                onPress={() => props.onToggleSub(s.value)}
              />
            ))}
          </ChipGrid>
          {props.extra}
        </>
      ) : null}
    </OptionRow>
  );
}

const styles = StyleSheet.create({
  about: { gap: 10, marginTop: 22, padding: 14, borderRadius: 16, backgroundColor: colors.white, borderWidth: 1, borderColor: '#E3EEF4' },
  aboutTitle: { fontFamily: fonts.bodySemibold, fontSize: 15, color: colors.text },
  aboutHint: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },
  list: { gap: 10 },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 2 },
  orLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  orText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.textMuted },
  subPrompt: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.textSecondary },
});
