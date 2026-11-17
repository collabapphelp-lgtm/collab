import { useState, Fragment } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { StepScreen } from '@/components/onboarding/StepScreen';
import { Chip, ChipGrid } from '@/components/onboarding/Chip';
import { OptionRow } from '@/components/onboarding/OptionRow';
import { OpenToAll } from '@/components/onboarding/OpenToAll';
import { useOnboarding } from '@/lib/onboarding-context';
import { CONTENT_INTENTS, CONTENT_LOOKING, EXPERIENCE, INSTRUMENT_TYPES, MUSIC_INTENTS, MUSICIAN_LOOKING, type LookingOption } from '@/lib/onboarding-data';
import { TagInput } from '@/components/onboarding/TagInput';
import { INSTRUMENT_DB } from '@/lib/instrument-db';
import { toggleIn } from '@/lib/toggle';
import { canonicalList, optionFor } from '@/lib/labels';
import { fonts, makeStyles } from '@/lib/theme';

// Step 3: who do you want to collab with? Includes the other creator type (cross-type matching).
export default function LookingStep() {
  const styles = useStyles();
  const { draft, saveStep, advance } = useOnboarding();
  const isMusician = draft.creatorType !== 'content';
  const options = isMusician ? MUSICIAN_LOOKING : CONTENT_LOOKING;
  const intentOptions = isMusician ? MUSIC_INTENTS : CONTENT_INTENTS;

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
      // "Open to anything" switches every row on and locks them. Rows picked before stay in the list
      // (after 'anything') so matching can still put those people first.
      if (value === 'anything') return list.includes('anything') ? list.filter((v) => v !== 'anything') : ['anything', ...list];
      if (list.includes('anything')) return list; // locked
      return toggleIn(list, value);
    });
  }

  const openAll = looking.includes('anything');
  const picked = looking.filter((v) => v !== 'anything');

  function toggleSub(row: string, sub: string) {
    setDetails((d) => {
      let next = toggleIn(d[row] ?? [], sub);
      // Unpicking a family also drops the exact instruments picked under it.
      const famTypes = (INSTRUMENT_TYPES[sub] ?? []).map((o) => o.value);
      if (famTypes.length && !next.includes(sub)) next = next.filter((v) => !famTypes.includes(v));
      return { ...d, [row]: next };
    });
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
        intents: intents.filter((i) => intentOptions.some((o) => o.value === i)),
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
          <Text style={styles.orText}>{openAll ? 'everyone included' : 'or pick specific types'}</Text>
          <View style={styles.orLine} />
        </View>
        {openAll ? (
          <Text style={styles.openNote}>
            {picked.length
              ? 'You’ll see everyone, with your top picks shown first. Turn this off to change them.'
              : 'You’ll see everyone. Want some people first? Turn this off, pick them, then turn it back on.'}
          </Text>
        ) : null}
        {options.filter((o) => o.value !== 'anything').map((o) => (
          <LookingRow
            key={o.value}
            option={o}
            locked={openAll}
            topPick={openAll && picked.includes(o.value)}
            selected={openAll || looking.includes(o.value)}
            subs={details[o.value] ?? []}
            onToggle={() => toggleRow(o.value)}
            onToggleSub={(sub) => toggleSub(o.value, sub)}
            extra={
              o.value === 'instrumentalist' ? (
                <TagInput tags={specific} onChange={setSpecific} placeholder="Something else? e.g. Harmonica, Talkbox" label="Specific instruments you're looking for" suggestions={INSTRUMENT_DB} />
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
          {intentOptions.map((o) => (
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
  locked?: boolean;
  topPick?: boolean;
}) {
  const styles = useStyles();
  const { option, selected, subs, locked, topPick } = props;
  const expandable = !!option.subOptions;
  const detail = locked
    ? topPick
      ? '★ Top pick · shown first'
      : undefined
    : expandable && selected
      ? subs.length > 0
        ? subs
            .filter((v) => !(INSTRUMENT_TYPES[v] ?? []).some((t) => subs.includes(t.value)))
            .map((v) => option.subOptions!.find((s) => s.value === v)?.label ?? optionFor(v).label)
            .join(', ')
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
      locked={locked}
      detail={detail}
      onPress={props.onToggle}
    >
      {expandable ? (
        <>
          <Text style={styles.subPrompt}>{option.subPrompt}</Text>
          {/* Exact instruments ("Which strings?" → Cello, Violin…) open right under the family's chip. Optional. */}
          <ChipGrid>
            {option.subOptions!.map((s) => {
              const on = subs.includes(s.value);
              return (
                <Fragment key={s.value}>
                  <Chip size="sm" label={s.label} value={s.value} selected={on} onPress={() => props.onToggleSub(s.value)} />
                  {on && INSTRUMENT_TYPES[s.value]?.length ? (
                    <View style={styles.types}>
                      <Text style={styles.typesTitle}>
                        Which {optionFor(s.value).label.toLowerCase()}? <Text style={styles.typesHint}>optional</Text>
                      </Text>
                      <ChipGrid>
                        {INSTRUMENT_TYPES[s.value].map((t) => (
                          <Chip key={t.value} size="sm" label={t.label} selected={subs.includes(t.value)} onPress={() => props.onToggleSub(t.value)} />
                        ))}
                      </ChipGrid>
                    </View>
                  ) : null}
                </Fragment>
              );
            })}
          </ChipGrid>
          {props.extra}
        </>
      ) : null}
    </OptionRow>
  );
}

const useStyles = makeStyles((colors) => ({
  about: { gap: 10, marginTop: 22, padding: 14, borderRadius: 16, backgroundColor: colors.white, borderWidth: 1, borderColor: '#E3EEF4' },
  aboutTitle: { fontFamily: fonts.bodySemibold, fontSize: 15, color: colors.text },
  aboutHint: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },
  list: { gap: 10 },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 2 },
  orLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  orText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.textMuted },
  openNote: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: 8 },
  types: { width: '100%', gap: 8, padding: 12, borderRadius: 12, backgroundColor: '#F4F8FB' },
  typesTitle: { fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.text },
  typesHint: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },
  subPrompt: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.textSecondary },
}));
