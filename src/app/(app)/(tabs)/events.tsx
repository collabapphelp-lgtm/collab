import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from '@/components/ThemedGradient';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { EventsMap, MAP_SUPPORTED } from '@/components/EventsMap';
import { dayHeading, metaFor, timeLabel, ymd, type EventOccurrence } from '@/lib/events';
import { useEvents } from '@/lib/use-events';
import { fonts, radius, shadow, makeStyles, useColors } from '@/lib/theme';

type When = 'going' | 'today' | 'tomorrow' | 'week' | 'all';
type Kind = 'all' | 'open-mic' | 'jam' | 'collab' | 'other';

const WHEN: { value: When; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'tomorrow', label: 'Tomorrow' },
  { value: 'week', label: 'This week' },
  { value: 'all', label: '2 weeks' },
];

const KINDS: { value: Kind; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'open-mic', label: 'Open mics' },
  { value: 'jam', label: 'Jams' },
  { value: 'collab', label: 'Collab events' },
  { value: 'other', label: 'Shows & meetups' },
];

function inWhen(e: EventOccurrence, when: When) {
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  if (when === 'today') return e.date === ymd(today);
  if (when === 'tomorrow') return e.date === ymd(tomorrow);
  if (when === 'week') return e.start < new Date(today).setHours(0, 0, 0, 0) + 7 * 86400000;
  return true;
}

function inKind(e: EventOccurrence, kind: Kind) {
  if (kind === 'all') return true;
  if (kind === 'collab') return e.collabHosted;
  if (kind === 'other') return !e.collabHosted && (e.type === 'show' || e.type === 'meetup');
  return !e.collabHosted && e.type === kind;
}

export default function Events() {
  const styles = useStyles();
  const colors = useColors();
  const { events, going, error, refresh, isGoing } = useEvents();
  const [when, setWhen] = useState<When>('today');
  const [kind, setKind] = useState<Kind>('all');
  const [selected, setSelected] = useState<EventOccurrence | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const { height } = useWindowDimensions();

  const mine = useMemo(() => (events ?? []).filter(isGoing), [events, isGoing]);
  const shown = useMemo(
    () => (when === 'going' ? mine : (events ?? []).filter((e) => inWhen(e, when))).filter((e) => inKind(e, kind)),
    [events, mine, when, kind],
  );

  // Group the list by day ("Today", "Tomorrow", "Friday, Nov 20").
  const days = useMemo(() => {
    const out: { title: string; items: EventOccurrence[] }[] = [];
    for (const e of shown) {
      const title = dayHeading(e.start);
      const last = out[out.length - 1];
      if (last?.title === title) last.items.push(e);
      else out.push({ title, items: [e] });
    }
    return out;
  }, [shown]);

  async function pullToRefresh() {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }

  const open = (e: EventOccurrence) => router.push({ pathname: '/event/[key]', params: { key: e.key } });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <LinearGradient colors={['#E6F1F7', '#F4F2EC']} style={StyleSheet.absoluteFill} />
      <View style={styles.header}>
        <View style={styles.flex}>
          <Text style={styles.title}>Events</Text>
          <Text style={styles.subtitle}>Open mics, jams and Collab nights in NYC</Text>
        </View>
        <Pressable onPress={() => router.push('/event/new')} style={styles.post} accessibilityRole="button" accessibilityLabel="Post an event">
          <Ionicons name="add" size={18} color={colors.white} />
          <Text style={styles.postText}>Post</Text>
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hScroll} contentContainerStyle={styles.segRow}>
        <Pill
          label={mine.length ? `★ I’m going · ${mine.length}` : '★ I’m going'}
          on={when === 'going'}
          onPress={() => (setWhen('going'), setSelected(null))}
          strong
        />
        {WHEN.map((w) => (
          <Pill key={w.value} label={w.label} on={when === w.value} onPress={() => (setWhen(w.value), setSelected(null))} strong />
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hScroll} contentContainerStyle={styles.kindRow}>
        {KINDS.map((k) => (
          <Pill
            key={k.value}
            label={k.label}
            on={kind === k.value}
            dot={k.value === 'collab' ? metaFor({ type: 'meetup', collabHosted: true }).color : k.value === 'open-mic' || k.value === 'jam' ? metaFor({ type: k.value, collabHosted: false }).color : undefined}
            onPress={() => (setKind(k.value), setSelected(null))}
          />
        ))}
      </ScrollView>

      {MAP_SUPPORTED ? (
        <View style={[styles.mapCard, { height: Math.round(height * 0.32) }]}>
          <EventsMap events={shown} selectedKey={selected?.key} onSelect={setSelected} style={StyleSheet.absoluteFill} />
          {selected ? <SelectedCard e={selected} goingCount={(going.get(selected.key) ?? []).length} onPress={() => open(selected)} onClose={() => setSelected(null)} /> : null}
        </View>
      ) : null}

      {events === null ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.blue} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={pullToRefresh} tintColor={colors.blue} />}
        >
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {days.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>{when === 'going' ? '🎟️' : '🎤'}</Text>
              {when === 'going' ? (
                <>
                  <Text style={styles.emptyTitle}>No plans yet</Text>
                  <Text style={styles.emptyBody}>Open any event and tap “I’m going”. Everything you’re going to shows up here.</Text>
                </>
              ) : (
                <>
                  <Text style={styles.emptyTitle}>Nothing listed {when === 'today' ? 'tonight' : when === 'tomorrow' ? 'tomorrow' : 'yet'}</Text>
                  <Text style={styles.emptyBody}>
                    {when === 'today' || when === 'tomorrow' ? 'Try “This week”, or ' : ''}post one: a jam at your studio, a listening session, a showcase.
                  </Text>
                </>
              )}
            </View>
          ) : (
            days.map((d) => (
              <View key={d.title} style={styles.day}>
                <Text style={styles.dayTitle}>{d.title}</Text>
                {d.items.map((e) => (
                  <EventRow key={e.key} e={e} goingCount={(going.get(e.key) ?? []).length} mine={isGoing(e)} onPress={() => open(e)} />
                ))}
              </View>
            ))
          )}
          <Text style={styles.footnote}>Listings change. Check with the venue before you head out.</Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Pill({ label, on, onPress, strong, dot }: { label: string; on: boolean; onPress: () => void; strong?: boolean; dot?: string }) {
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      style={[styles.pill, strong ? styles.pillStrong : null, on && (strong ? styles.pillStrongOn : styles.pillOn)]}
    >
      {dot ? <View style={[styles.dot, { backgroundColor: dot }]} /> : null}
      <Text style={[styles.pillText, on && (strong ? styles.pillStrongTextOn : styles.pillTextOn)]}>{label}</Text>
    </Pressable>
  );
}

function Badges({ e }: { e: EventOccurrence }) {
  const styles = useStyles();
  if (e.status === 'pending') return <Text style={[styles.badge, styles.badgePending]}>Pending review</Text>;
  return null;
}

function EventRow({ e, goingCount, mine, onPress }: { e: EventOccurrence; goingCount: number; mine?: boolean; onPress: () => void }) {
  const styles = useStyles();
  const colors = useColors();
  const meta = metaFor(e);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]} accessibilityRole="button">
      <View style={[styles.rowStripe, { backgroundColor: meta.color }]} />
      <View style={styles.rowTime}>
        <Text style={styles.rowTimeText}>{timeLabel(e.start).replace(' ', '\n')}</Text>
      </View>
      <View style={styles.flex}>
        <Text style={[styles.rowType, { color: meta.color }]}>{meta.label.toUpperCase()}</Text>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {e.title}
        </Text>
        <Text style={styles.rowVenue} numberOfLines={1}>
          {e.venue} · {e.neighborhood}
        </Text>
        <View style={styles.rowMeta}>
          <Badges e={e} />
          {mine ? <Text style={styles.youGoing}>✓ You’re going</Text> : null}
          {goingCount > (mine ? 1 : 0) ? (
            <Text style={styles.going}>
              <Ionicons name="people" size={12} color={colors.blue} /> {mine ? `${goingCount - 1} others` : `${goingCount}`} going
            </Text>
          ) : null}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

function SelectedCard({ e, goingCount, onPress, onClose }: { e: EventOccurrence; goingCount: number; onPress: () => void; onClose: () => void }) {
  const styles = useStyles();
  const colors = useColors();
  const meta = metaFor(e);
  return (
    <Pressable onPress={onPress} style={styles.selCard} accessibilityRole="button">
      <View style={[styles.selIcon, { backgroundColor: meta.color }]}>
        <Ionicons name={e.type === 'jam' ? 'musical-notes' : 'mic'} size={18} color={colors.white} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.selTitle} numberOfLines={1}>
          {e.title}
        </Text>
        <Text style={styles.selSub} numberOfLines={1}>
          {dayHeading(e.start)} · {timeLabel(e.start)} · {e.venue}
          {goingCount ? ` · ${goingCount} going` : ''}
        </Text>
      </View>
      <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
        <Ionicons name="close" size={18} color={colors.textMuted} />
      </Pressable>
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  safe: { flex: 1 },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 10, gap: 12 },
  title: { fontFamily: fonts.heading, fontSize: 30, color: colors.text },
  subtitle: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  post: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.blue, paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.full },
  postText: { fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.white },
  hScroll: { flexGrow: 0, flexShrink: 0 },
  segRow: { paddingHorizontal: 20, gap: 8, paddingBottom: 8 },
  kindRow: { paddingHorizontal: 20, gap: 8, paddingBottom: 10 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillOn: { borderColor: colors.blue, backgroundColor: '#EAF4F9' },
  pillStrong: { paddingHorizontal: 14, paddingVertical: 8 },
  pillStrongOn: { backgroundColor: colors.text, borderColor: colors.text },
  pillText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.textSecondary },
  pillTextOn: { color: colors.blue },
  pillStrongTextOn: { color: colors.white },
  dot: { width: 8, height: 8, borderRadius: 4 },
  mapCard: { marginHorizontal: 16, borderRadius: 20, overflow: 'hidden', backgroundColor: '#E9EDF0', ...shadow },
  selCard: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 14,
    backgroundColor: colors.white,
    ...shadow,
  },
  selIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  selTitle: { fontFamily: fonts.bodySemibold, fontSize: 15, color: colors.text },
  selSub: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 32 },
  error: { fontFamily: fonts.body, fontSize: 13, color: colors.red, marginBottom: 10, textAlign: 'center' },
  day: { marginBottom: 14 },
  dayTitle: { fontFamily: fonts.bodySemibold, fontSize: 13, color: colors.textSecondary, letterSpacing: 0.4, marginBottom: 8, marginLeft: 4, textTransform: 'uppercase' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: 16,
    paddingVertical: 12,
    paddingRight: 12,
    marginBottom: 8,
    overflow: 'hidden',
    ...shadow,
  },
  rowStripe: { width: 4, alignSelf: 'stretch' },
  rowTime: { width: 48, alignItems: 'center' },
  rowTimeText: { fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.text, textAlign: 'center', lineHeight: 17 },
  rowType: { fontFamily: fonts.bodySemibold, fontSize: 10, letterSpacing: 0.8 },
  rowTitle: { fontFamily: fonts.bodySemibold, fontSize: 16, color: colors.text, marginTop: 1 },
  rowVenue: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary, marginTop: 1 },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 5, flexWrap: 'wrap' },
  badge: { fontFamily: fonts.bodySemibold, fontSize: 11, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full, overflow: 'hidden' },
  badgePending: { backgroundColor: '#F1F1F1', color: colors.textSecondary },
  going: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.blue },
  youGoing: { fontFamily: fonts.bodySemibold, fontSize: 12, color: '#2E8B57' },
  empty: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24, gap: 6 },
  emptyEmoji: { fontSize: 36 },
  emptyTitle: { fontFamily: fonts.heading, fontSize: 18, color: colors.text, textAlign: 'center' },
  emptyBody: { fontFamily: fonts.body, fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  footnote: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: 8 },
}));
