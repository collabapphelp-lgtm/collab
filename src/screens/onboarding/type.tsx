import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { StepScreen } from '@/components/onboarding/StepScreen';
import { Chip, ChipGrid } from '@/components/onboarding/Chip';
import { OptionIcon } from '@/components/OptionIcon';
import { useOnboarding } from '@/lib/onboarding-context';
import { CONTENT_SKILLS, INSTRUMENTS, MUSICIAN_SKILLS, type CreatorType, type Option } from '@/lib/onboarding-data';
import { toggleIn } from '@/lib/toggle';
import { canonicalList } from '@/lib/labels';
import { colors, fonts, radius } from '@/lib/theme';

const TYPES: { value: CreatorType; label: string; emoji: string; prompt: string; options: Option[] }[] = [
  { value: 'musician', label: 'Musician', emoji: '🎵', prompt: 'What kind of musician?', options: MUSICIAN_SKILLS },
  { value: 'content', label: 'Content Creator', emoji: '🎬', prompt: 'What do you make?', options: CONTENT_SKILLS },
];

const preview = (options: Option[]) => options.slice(0, 3).map((o) => o.label).join(', ') + '…';

// Step 2: I am a... Picking a path reveals its specifics on the same screen.
export default function TypeStep() {
  const { draft, saveStep, advance } = useOnboarding();
  const [type, setType] = useState<CreatorType | undefined>(draft.creatorType);
  // Remember picks per path, so tapping the other card and back doesn't lose them.
  const [skillsByType, setSkillsByType] = useState<Record<CreatorType, string[]>>(() => ({
    musician: draft.creatorType === 'musician' ? (draft.skills ?? []) : [],
    content: draft.creatorType === 'content' ? (draft.skills ?? []) : [],
  }));
  const [instruments, setInstruments] = useState<string[]>(canonicalList(draft.instruments));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const skills = type ? skillsByType[type] : [];
  const playsInstruments = type === 'musician' && skills.includes('instrumentalist');
  const needsInstrument = playsInstruments && instruments.length === 0;

  async function next() {
    if (!type || needsInstrument) return;
    setSaving(true);
    setError(null);
    try {
      // Switching path clears "looking for" answers that only made sense for the other one.
      const switched = draft.creatorType && draft.creatorType !== type;
      await saveStep({
        creatorType: type,
        skills,
        instruments: playsInstruments ? instruments : [],
        ...(switched ? { lookingFor: [], lookingForDetails: {} } : {}),
      });
      advance('/onboarding/looking');
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
      subtitle="Choose your path, then pick everything that fits."
      onContinue={next}
      continueDisabled={!type || needsInstrument}
      saving={saving}
      error={error}
      footerHint={!type ? 'Choose one to continue' : needsInstrument ? 'Pick at least one instrument' : undefined}
    >
      <View style={styles.list}>
        {TYPES.map((t) => {
          const selected = type === t.value;
          const picked = skillsByType[t.value];
          return (
            <View key={t.value} style={[styles.card, selected && styles.cardOn]}>
              <Pressable
                onPress={() => setType(t.value)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                style={({ pressed }) => [styles.cardHeader, pressed && { opacity: 0.8 }]}
              >
                <OptionIcon value={t.value} fallback={t.emoji} size={48} selected={selected} />
                <View style={styles.flex}>
                  <Text style={[styles.cardTitle, selected && { color: colors.blue }]}>{t.label}</Text>
                  {selected ? null : <Text style={styles.cardHint}>{preview(t.options)}</Text>}
                </View>
                <View style={[styles.radio, selected && styles.radioOn]}>{selected ? <View style={styles.radioDot} /> : null}</View>
              </Pressable>

              {selected ? (
                <View style={styles.sub}>
                  <Text style={styles.subPrompt}>
                    {t.prompt} <Text style={styles.subHint}>Pick all that fit</Text>
                  </Text>
                  <ChipGrid>
                    {t.options.map((o) => (
                      <Chip
                        key={o.value}
                        size="sm"
                        label={o.label}
                        value={o.value}
                        selected={picked.includes(o.value)}
                        onPress={() => setSkillsByType((s) => ({ ...s, [t.value]: toggleIn(s[t.value], o.value) }))}
                      />
                    ))}
                  </ChipGrid>

                  {playsInstruments ? (
                    <View style={styles.instruments}>
                      <Text style={styles.subPrompt}>What do you play?</Text>
                      <ChipGrid>
                        {INSTRUMENTS.map((i) => (
                          <Chip
                            key={i.value}
                            size="sm"
                            label={i.label}
                            value={i.value}
                            selected={instruments.includes(i.value)}
                            onPress={() => setInstruments((list) => toggleIn(list, i.value))}
                          />
                        ))}
                      </ChipGrid>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
    </StepScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { gap: 14 },
  card: { borderWidth: 2, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.white, overflow: 'hidden' },
  cardOn: { borderColor: colors.blue, backgroundColor: '#F4FAFC' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 18 },
  cardTitle: { fontFamily: fonts.heading, fontSize: 21, color: colors.text },
  cardHint: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, marginTop: 2 },
  radio: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: colors.blue },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.blue },
  sub: { paddingHorizontal: 18, paddingBottom: 18, gap: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(75,163,199,0.35)', paddingTop: 14 },
  subPrompt: { fontFamily: fonts.bodySemibold, fontSize: 15, color: colors.text },
  subHint: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },
  instruments: { gap: 10, marginTop: 4 },
});
