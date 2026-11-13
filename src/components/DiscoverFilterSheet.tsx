import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Sheet } from '@/components/onboarding/Sheet';
import { Chip, ChipGrid } from '@/components/onboarding/Chip';
import { Button } from '@/components/Button';
import { NO_FILTERS, filterCount, type DiscoverFilters } from '@/lib/discover-filters';
import {
  CONTENT_SKILLS,
  EXPERIENCE,
  GENRES,
  CONTENT_INTENTS,
  INSTRUMENTS,
  INTERESTS,
  MUSIC_INTENTS,
  MUSICIAN_SKILLS,
  type Option,
} from '@/lib/onboarding-data';
import { toggleIn } from '@/lib/toggle';
import { colors, fonts } from '@/lib/theme';

type Group = { key: keyof DiscoverFilters; title: string; options: Option[]; icons?: boolean };

const GROUPS: Group[] = [
  { key: 'roles', title: 'Who', options: [...MUSICIAN_SKILLS, ...CONTENT_SKILLS], icons: true },
  { key: 'instruments', title: 'Plays', options: INSTRUMENTS, icons: true },
  { key: 'sounds', title: 'Music genre', options: GENRES },
  { key: 'sounds', title: 'Content vibe', options: INTERESTS },
  { key: 'intents', title: 'Here to', options: [...MUSIC_INTENTS, ...CONTENT_INTENTS] },
  { key: 'experience', title: 'Experience', options: EXPERIENCE },
];

/** Quick Discover filters. Edits are local until "Show results". */
export function DiscoverFilterSheet(props: {
  visible: boolean;
  value: DiscoverFilters;
  onClose: () => void;
  onApply: (f: DiscoverFilters) => void;
}) {
  const [draft, setDraft] = useState<DiscoverFilters>(props.value);
  const n = filterCount(draft);

  return (
    <Sheet
      visible={props.visible}
      title="Filters"
      onClose={props.onClose}
      footer={<Button title={n ? `Show results · ${n} filter${n === 1 ? '' : 's'}` : 'Show everyone'} onPress={() => props.onApply(draft)} />}
    >
      <View style={styles.top}>
        <Text style={styles.hint}>Narrow who shows up. People still need to fit what you’re looking for.</Text>
        {n ? (
          <Pressable onPress={() => setDraft(NO_FILTERS)} hitSlop={8} accessibilityRole="button">
            <Text style={styles.clear}>Clear all</Text>
          </Pressable>
        ) : null}
      </View>
      {GROUPS.map((g) => {
        // De-dupe (some genre/interest values repeat).
        const seen = new Set<string>();
        const opts = g.options.filter((o) => (seen.has(o.value) ? false : (seen.add(o.value), true)));
        return (
          <View key={g.title} style={styles.group}>
            <Text style={styles.groupTitle}>{g.title}</Text>
            <ChipGrid>
              {opts.map((o) => (
                <Chip
                  key={o.value}
                  size="sm"
                  label={o.label}
                  value={g.icons ? o.value : undefined}
                  selected={draft[g.key].includes(o.value)}
                  onPress={() => setDraft((d) => ({ ...d, [g.key]: toggleIn(d[g.key], o.value) }))}
                />
              ))}
            </ChipGrid>
          </View>
        );
      })}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  hint: { flex: 1, fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary },
  clear: { fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.blue },
  group: { gap: 10, marginTop: 8 },
  groupTitle: { fontFamily: fonts.heading, fontSize: 17, color: colors.text },
});
