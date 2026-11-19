import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
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
import type { UserProfile } from '@/lib/types';
import { fonts, makeStyles, useColors } from '@/lib/theme';

type World = 'music' | 'content';
type Group = { key: keyof DiscoverFilters; title: string; options: Option[]; icons?: boolean; world?: World; mine: (me: UserProfile) => string[] };

const MUSIC_ROLES = new Set(['musician', ...MUSICIAN_SKILLS.map((o) => o.value)]);
const CONTENT_ROLES = new Set(['content', ...CONTENT_SKILLS.map((o) => o.value)]);

/** What this person is into: music, content, or both (from who they are and who they're looking for). */
export function worldsFor(me: UserProfile): Set<World> {
  const w = new Set<World>();
  if (me.creatorType === 'musician') w.add('music');
  if (me.creatorType === 'content') w.add('content');
  for (const v of me.lookingFor ?? []) {
    if (v === 'anything') (w.add('music'), w.add('content'));
    if (MUSIC_ROLES.has(v)) w.add('music');
    if (CONTENT_ROLES.has(v)) w.add('content');
  }
  if (!w.size) (w.add('music'), w.add('content'));
  return w;
}

// The first options shown are the ones most likely to matter to this person.
const lookedFor = (me: UserProfile) => [...(me.lookingFor ?? []), ...Object.values(me.lookingForDetails ?? {}).flat()];
const GROUPS: Group[] = [
  { key: 'roles', title: 'Who', options: MUSICIAN_SKILLS, icons: true, world: 'music', mine: lookedFor },
  { key: 'roles', title: 'Who', options: CONTENT_SKILLS, icons: true, world: 'content', mine: lookedFor },
  { key: 'instruments', title: 'Plays', options: INSTRUMENTS, icons: true, world: 'music', mine: (me) => [...lookedFor(me), ...(me.instruments ?? [])] },
  { key: 'sounds', title: 'Music genre', options: GENRES, world: 'music', mine: (me) => me.genres ?? [] },
  { key: 'sounds', title: 'Content vibe', options: INTERESTS, world: 'content', mine: (me) => me.interests ?? [] },
  { key: 'intents', title: 'Here to', options: MUSIC_INTENTS, world: 'music', mine: (me) => me.intents ?? [] },
  { key: 'intents', title: 'Here to', options: CONTENT_INTENTS, world: 'content', mine: (me) => me.intents ?? [] },
  { key: 'experience', title: 'Experience', options: EXPERIENCE, mine: (me) => (me.experience ? [me.experience] : []) },
];

/** Quick Discover filters. Edits are local until "Show results". */
export function DiscoverFilterSheet(props: {
  visible: boolean;
  me: UserProfile | null;
  value: DiscoverFilters;
  onClose: () => void;
  onApply: (f: DiscoverFilters) => void;
}) {
  const styles = useStyles();
  const colors = useColors();
  const [draft, setDraft] = useState<DiscoverFilters>(props.value);
  const n = filterCount(draft);
  const base = props.me ? worldsFor(props.me) : new Set<World>(['music', 'content']);
  const [added, setAdded] = useState<World[]>([]);
  // A filter already set from the other world keeps that world visible.
  const usesWorld = (w: World) =>
    GROUPS.some((g) => g.world === w && g.options.some((o) => draft[g.key].includes(o.value)));
  const worlds = new Set<World>([...base, ...added, ...(['music', 'content'] as World[]).filter(usesWorld)]);
  const missing = (['music', 'content'] as World[]).filter((w) => !worlds.has(w));

  // Merge the per-world parts of the same section ("Who", "Here to") into one list.
  const sections: { key: keyof DiscoverFilters; title: string; icons?: boolean; options: Option[] }[] = [];
  for (const g of GROUPS) {
    if (g.world && !worlds.has(g.world)) continue;
    const mine = new Set(props.me ? g.mine(props.me) : []);
    const ranked = [...g.options].sort((a, b) => {
      // Ranked by what was applied when the sheet opened, so chips don't jump around while tapping.
      const score = (o: Option) => (props.value[g.key].includes(o.value) ? 2 : mine.has(o.value) ? 1 : 0);
      return score(b) - score(a);
    });
    const prev = sections.find((s) => s.title === g.title);
    if (prev) prev.options.push(...ranked.filter((o) => !prev.options.some((p) => p.value === o.value)));
    else sections.push({ key: g.key, title: g.title, icons: g.icons, options: ranked });
  }

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
      {sections.map((s) => (
        <View key={s.title} style={styles.group}>
          <Text style={styles.groupTitle}>{s.title}</Text>
          <TwoRows>
            {s.options.map((o) => (
              <Chip
                key={o.value}
                size="sm"
                label={o.label}
                value={s.icons ? o.value : undefined}
                selected={draft[s.key].includes(o.value)}
                onPress={() => setDraft((d) => ({ ...d, [s.key]: toggleIn(d[s.key], o.value) }))}
              />
            ))}
          </TwoRows>
        </View>
      ))}
      {missing.length ? (
        <View style={styles.addRow}>
          {missing.map((w) => (
            <Pressable key={w} onPress={() => setAdded((a) => [...a, w])} style={styles.add} accessibilityRole="button">
              <Ionicons name="add" size={16} color={colors.blue} />
              <Text style={styles.addText}>{w === 'music' ? 'Music filters' : 'Content filters'}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </Sheet>
  );
}

/** Shows two rows of chips, then "Show all". */
function TwoRows({ children }: { children: React.ReactNode }) {
  const styles = useStyles();
  const [open, setOpen] = useState(false);
  const [rowH, setRowH] = useState(0);
  const [fullH, setFullH] = useState(0);
  const max = rowH ? rowH * 2 + 10 : undefined; // 10 = ChipGrid gap
  const overflows = !!max && fullH > max + 2;
  return (
    <View style={{ gap: 8 }}>
      <View style={!open && max ? { maxHeight: max, overflow: 'hidden' } : null}>
        <View
          onLayout={(e) => {
            setFullH(e.nativeEvent.layout.height);
          }}
        >
          {/* Measure one chip's height for the row size. */}
          <View style={styles.measure} pointerEvents="none" onLayout={(e) => setRowH(e.nativeEvent.layout.height)}>
            <Chip size="sm" label="A" selected={false} onPress={() => {}} />
          </View>
          <ChipGrid>{children}</ChipGrid>
        </View>
      </View>
      {overflows ? (
        <Pressable onPress={() => setOpen((v) => !v)} hitSlop={8} accessibilityRole="button" style={styles.more}>
          <Text style={styles.moreText}>{open ? 'Show less' : 'Show all'}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  hint: { flex: 1, fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary },
  clear: { fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.blue },
  group: { gap: 10, marginTop: 8 },
  groupTitle: { fontFamily: fonts.heading, fontSize: 17, color: colors.text },
  measure: { position: 'absolute', opacity: 0, left: 0, top: 0 },
  more: { alignSelf: 'flex-start' },
  moreText: { fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.blue },
  addRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  add: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.blue,
  },
  addText: { fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.blue },
}));
