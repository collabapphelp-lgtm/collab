import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Share, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';
import { INVITE_URL } from '@/lib/legal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from '@/components/ThemedGradient';
import { Image } from 'expo-image';
import { Button } from '@/components/Button';
import { ProfileView } from '@/components/ProfileView';
import { GoingTo } from '@/components/GoingTo';
import { DiscoverFilterSheet } from '@/components/DiscoverFilterSheet';
import { NO_FILTERS, filterCount, passesFilters, saveFilters, type DiscoverFilters } from '@/lib/discover-filters';
import { SafetyButton } from '@/components/SafetyButton';
import { useAuth } from '@/lib/auth-context';
import { canonicalList, displayName, optionFor, roleLine } from '@/lib/labels';
import { Avatar } from '@/components/Avatar';
import { CONTENT_SKILLS, INSTRUMENTS, MUSICIAN_SKILLS } from '@/lib/onboarding-data';
import { toggleIn } from '@/lib/toggle';
import type { UserProfile } from '@/lib/types';
import { useMatches } from '@/lib/use-matches';
import { like, loadUnseenProfiles, passOn } from '@/lib/discover';
import { formatDistance, rankCandidates, type Candidate } from '@/lib/matching';
import { consumeJustFinished } from '@/lib/onboarding-context';
import { fonts, makeStyles, useColors } from '@/lib/theme';

const LOGO = require('../../../../assets/logo.png');
const LOGO_WHITE = require('../../../../assets/logo-white.png');
// Slate-violet: sits with the blue→purple Collab button instead of fighting it like red did.
const PASS = '#6B6690';

/**
 * One-tap filters under the header, built from what you said you're looking for and your own sound,
 * so the chips that matter to you come first. The full sheet (button top right) has everything.
 */
function QuickFilters({ me, value, onChange }: { me: UserProfile; value: DiscoverFilters; onChange: (f: DiscoverFilters) => void }) {
  const styles = useStyles();
  const chips = useMemo(() => quickChips(me), [me]);
  const n = filterCount(value);
  const toggle = (key: keyof DiscoverFilters, v: string) => onChange({ ...value, [key]: toggleIn(value[key], v) });
  // Anything active from the full sheet that isn't a quick chip still shows, so it can be turned off here.
  const extra = (Object.keys(value) as (keyof DiscoverFilters)[]).flatMap((key) =>
    value[key].filter((v) => !chips.some((c) => c.key === key && c.value === v)).map((v) => ({ key, value: v, label: optionFor(v).label })),
  );
  const all = [...extra, ...chips];
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickWrap} contentContainerStyle={styles.quick}>
      <QuickChip label="Everyone" on={n === 0} onPress={() => onChange(NO_FILTERS)} />
      {all.map((c) => (
        <QuickChip key={`${c.key}:${c.value}`} label={c.label} on={value[c.key].includes(c.value)} onPress={() => toggle(c.key, c.value)} />
      ))}
    </ScrollView>
  );
}

function QuickChip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      style={({ pressed }) => [styles.quickChip, on && styles.quickChipOn, pressed && { opacity: 0.8 }]}
    >
      <Text style={[styles.quickText, on && styles.quickTextOn]}>{label}</Text>
    </Pressable>
  );
}

type QuickChipDef = { key: keyof DiscoverFilters; value: string; label: string };

function quickChips(me: UserProfile): QuickChipDef[] {
  const out: QuickChipDef[] = [];
  const add = (key: keyof DiscoverFilters, value: string) => {
    if (!out.some((c) => c.key === key && c.value === value)) out.push({ key, value, label: optionFor(value).label });
  };
  const skillValues = new Set([...MUSICIAN_SKILLS, ...CONTENT_SKILLS].map((o) => o.value));
  const wanted = me.lookingFor ?? [];
  const open = wanted.length === 0 || wanted.includes('anything');
  // Roles you're looking for (and the specific ones under a group, e.g. musician → producer).
  for (const w of wanted) {
    for (const d of canonicalList(me.lookingForDetails?.[w])) if (skillValues.has(d)) add('roles', d);
    if (skillValues.has(w)) add('roles', w);
  }
  if (open) ['producer', 'vocalist', 'instrumentalist', 'videographer', 'songwriter', 'dj'].forEach((v) => add('roles', v));
  // Instruments, if you want players.
  if (open || wanted.includes('instrumentalist') || wanted.includes('musician')) {
    const picked = canonicalList(me.lookingForDetails?.instrumentalist);
    picked.filter((v) => v.startsWith('type:')).forEach((v) => add('instruments', v));
    (picked.length ? picked : INSTRUMENTS.map((o) => o.value)).forEach((v) => INSTRUMENTS.some((o) => o.value === v) && add('instruments', v));
  }
  // Your own sound or niche.
  [...(me.genres ?? []), ...(me.interests ?? [])].forEach((v) => add('sounds', v));
  return out.slice(0, 18);
}

export default function Discover() {
  const styles = useStyles();
  const colors = useColors();
  const { profile } = useAuth();
  // Everything loaded and ranked; filters and removals apply on top, so changing a filter is instant.
  const [loaded, setLoaded] = useState<{ best: Candidate[]; more: Candidate[] } | null>(null);
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [exploring, setExploring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [welcome, setWelcome] = useState(() => consumeJustFinished());
  const [filters, setFilters] = useState<DiscoverFilters>(() => ({ ...NO_FILTERS, ...(profile?.discoverFilters ?? {}) }));
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeFilters = filterCount(filters);
  const scrollRef = useRef<ScrollViewInstance>(null);

  // Anyone you're already connected with (e.g. you accepted their request from Connections
  // after this queue was loaded) drops out right away.
  const { matches } = useMatches();
  const connected = useMemo(() => new Set((matches ?? []).map((m) => m.other.id)), [matches]);
  const visible = useCallback(
    (list: Candidate[]) => list.filter((c) => !removed.has(c.profile.id) && !connected.has(c.profile.id) && passesFilters(c.profile, filters)),
    [removed, connected, filters],
  );
  // Someone picked from the list view jumps to the front of the 1-on-1 card stack.
  const [front, setFront] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const queue = useMemo(() => {
    if (!loaded) return null;
    const base = visible(exploring ? loaded.more : loaded.best);
    if (!front) return base;
    const picked = visible([...loaded.best, ...loaded.more]).find((c) => c.profile.id === front);
    return picked ? [picked, ...base.filter((c) => c.profile.id !== front)] : base;
  }, [loaded, exploring, visible, front]);
  const more = useMemo(
    () => (loaded && !exploring ? visible(loaded.more).filter((c) => c.profile.id !== front) : []),
    [loaded, exploring, visible, front],
  );
  const drop = (id: string) => {
    setRemoved((r) => new Set(r).add(id));
    if (id === front) setFront(null);
  };
  function pickFromList(id: string) {
    setListOpen(false);
    setFront(id);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }

  // Fetch and rank; callers decide how to show loading. Keyed on the user id so a profile
  // field changing (e.g. a save elsewhere) doesn't reshuffle the queue mid-browse.
  const meId = profile?.id;
  const profileRef = useRef(profile);
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  type Loaded = { best: Candidate[]; more: Candidate[]; error: string | null };
  const fetchQueue = useCallback(async (): Promise<Loaded> => {
    const me = profileRef.current;
    if (!me) return { best: [], more: [], error: null };
    try {
      return { ...rankCandidates(me, await loadUnseenProfiles(me.id)), error: null };
    } catch (e) {
      console.warn('Discover load failed', e);
      return { best: [], more: [], error: 'Couldn’t load creatives. Check your connection and try again.' };
    }
  }, []);

  const apply = useCallback((r: Loaded) => {
    setLoaded({ best: r.best, more: r.more });
    setExploring(false);
    setError(r.error);
  }, []);

  useEffect(() => {
    if (!meId) return;
    let cancelled = false;
    fetchQueue().then((r) => {
      if (!cancelled) apply(r);
    });
    return () => {
      cancelled = true;
    };
  }, [meId, fetchQueue, apply]);

  async function refresh() {
    setLoaded(null);
    setError(null);
    apply(await fetchQueue());
  }

  function applyFilters(f: DiscoverFilters) {
    setFiltersOpen(false);
    setFilters(f);
    setExploring(false);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    if (profile) saveFilters(profile.id, f).catch((e) => console.warn('Saving filters failed', e));
  }

  function exploreMore() {
    setExploring(true);
  }

  const current = queue?.[0];

  async function decide(choice: 'like' | 'pass') {
    if (!profile || !current || acting) return;
    setActing(true);
    Haptics.impactAsync(choice === 'like' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      let matched = false;
      if (choice === 'like') matched = await like(profile, current.profile);
      else await passOn(profile.id, current.profile.id);
      drop(current.profile.id);
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      if (matched) router.push({ pathname: '/match', params: { id: current.profile.id } });
    } catch (e) {
      console.warn('Decision failed', e);
      setError('That didn’t go through. Try again.');
    } finally {
      setActing(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <LinearGradient colors={['#E6F1F7', '#F3E9D8']} style={StyleSheet.absoluteFill} />
      <View style={styles.header}>
        <Text style={styles.title}>Discover</Text>
        <View style={styles.headerRight}>
          {queue && queue.length > 0 ? (
            <Pressable
              onPress={() => setListOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={`${queue.length + more.length} to explore. See everyone as a list`}
              style={({ pressed }) => [styles.countPill, pressed && { opacity: 0.8 }]}
            >
              <View style={styles.countDot} />
              <Text style={styles.count}>{exploring ? `Exploring · ${queue.length} more` : `${queue.length} to explore`}</Text>
              <Ionicons name="list" size={15} color={colors.textSecondary} />
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => setFiltersOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={activeFilters ? `Filters, ${activeFilters} active` : 'Filters'}
            style={({ pressed }) => [styles.filterBtn, activeFilters > 0 && styles.filterBtnOn, pressed && { opacity: 0.8 }]}
          >
            <Ionicons name="options-outline" size={20} color={activeFilters ? colors.white : colors.text} />
            {activeFilters ? <Text style={styles.filterCount}>{activeFilters}</Text> : null}
          </Pressable>
        </View>
      </View>
      {profile ? <QuickFilters me={profile} value={filters} onChange={applyFilters} /> : null}

      {queue === null ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.blue} size="large" />
          <Text style={styles.loading}>Finding creatives for you…</Text>
        </View>
      ) : current ? (
        <View style={styles.flex}>
          <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            <View style={styles.card}>
              <View style={styles.cardClip}>
                <ProfileView
                layout="work"
                profile={current.profile}
                distanceLabel={formatDistance(current.distanceMiles, current.profile.location)}
                reasons={current.reasons}
                heroAccessory={
                  <SafetyButton them={current.profile} tone="light" onBlocked={() => drop(current.profile.id)} />
                }
                footer={<GoingTo uid={current.profile.id} name={current.profile.firstName} />}
                />
              </View>
            </View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </ScrollView>

          <LinearGradient colors={['rgba(243,233,216,0)', 'rgba(243,233,216,0.95)']} style={styles.fade} pointerEvents="none" />
          <View style={styles.actions} pointerEvents="box-none">
            <ActionButton kind="pass" onPress={() => decide('pass')} disabled={acting} />
            <ActionButton kind="like" onPress={() => decide('like')} disabled={acting} />
          </View>
        </View>
      ) : !error && more.length > 0 ? (
        <ExploreMore count={more.length} onExplore={exploreMore} />
      ) : (
        activeFilters > 0 && !error ? (
          <FilteredEmpty onClear={() => applyFilters(NO_FILTERS)} onEdit={() => setFiltersOpen(true)} />
        ) : (
          <EmptyState error={error} onRefresh={refresh} global={!!profile?.global} />
        )
      )}

      <DiscoverFilterSheet
        key={filtersOpen ? 'open' : 'closed'}
        visible={filtersOpen}
        value={filters}
        onClose={() => setFiltersOpen(false)}
        onApply={applyFilters}
      />
      <ExploreList
        visible={listOpen}
        best={queue ?? []}
        more={more}
        currentId={current?.profile.id}
        onPick={pickFromList}
        onClose={() => setListOpen(false)}
      />
      <WelcomeModal visible={welcome} name={profile?.firstName ?? ''} onClose={() => setWelcome(false)} />
    </SafeAreaView>
  );
}

/**
 * Everyone left to see, as a compact list in a sheet over Discover. Picking someone puts them on the
 * main card, so liking and passing still happen one-on-one.
 */
function ExploreList(props: {
  visible: boolean;
  best: Candidate[];
  more: Candidate[];
  currentId?: string;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const styles = useStyles();
  const colors = useColors();
  const sections = [
    { title: 'Best fits', data: props.best },
    { title: 'More to explore', data: props.more },
  ].filter((s) => s.data.length > 0);
  return (
    <Modal visible={props.visible} transparent animationType="slide" onRequestClose={props.onClose}>
      <Pressable style={styles.listBackdrop} onPress={props.onClose} accessibilityLabel="Close list" />
      <View style={styles.listSheet}>
        <View style={styles.listGrabber} />
        <View style={styles.listHead}>
          <Text style={styles.listTitle}>Everyone to explore</Text>
          <Pressable onPress={props.onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
            <Ionicons name="close" size={24} color={colors.textSecondary} />
          </Pressable>
        </View>
        <Text style={styles.listSub}>Tap someone to see their full profile on your Discover card.</Text>
        <ScrollView style={styles.listScroll} contentContainerStyle={styles.listBody}>
          {sections.map((sec) => (
            <View key={sec.title}>
              <Text style={styles.listSection}>{sec.title}</Text>
              {sec.data.map((c) => {
                const on = c.profile.id === props.currentId;
                const dist = formatDistance(c.distanceMiles, c.profile.location);
                return (
                  <Pressable
                    key={c.profile.id}
                    onPress={() => props.onPick(c.profile.id)}
                    style={({ pressed }) => [styles.listRow, on && styles.listRowOn, pressed && { opacity: 0.75 }]}
                    accessibilityRole="button"
                    accessibilityLabel={`${displayName(c.profile)}, ${roleLine(c.profile, 2)}`}
                  >
                    <Avatar uri={c.profile.photoURL} name={displayName(c.profile)} seed={c.profile.id} size={52} />
                    <View style={styles.flex}>
                      <Text style={styles.listName} numberOfLines={1}>
                        {displayName(c.profile)}
                        {dist ? <Text style={styles.listDist}>  {dist}</Text> : null}
                      </Text>
                      <Text style={styles.listRole} numberOfLines={1}>
                        {roleLine(c.profile, 3)}
                      </Text>
                      {c.reasons[0] ? (
                        <Text style={styles.listReason} numberOfLines={1}>
                          {c.reasons[0]}
                        </Text>
                      ) : null}
                    </View>
                    {on ? <Text style={styles.listNow}>Showing</Text> : <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

function ActionButton({ kind, onPress, disabled }: { kind: 'pass' | 'like'; onPress: () => void; disabled?: boolean }) {
  const styles = useStyles();
  const colors = useColors();
  const like = kind === 'like';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={like ? 'Collab' : 'Pass'}
      style={({ pressed }) => [
        styles.action,
        like ? styles.actionLike : styles.actionPass,
        { transform: [{ scale: pressed ? 0.92 : 1 }], opacity: disabled ? 0.6 : 1 },
      ]}
    >
      {like ? (
        <LinearGradient colors={[colors.blue, colors.purple]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.actionFill}>
          <Image source={LOGO_WHITE} style={styles.likeLogo} contentFit="contain" />
        </LinearGradient>
      ) : (
        <Ionicons name="close" size={38} color={PASS} />
      )}
    </Pressable>
  );
}

function FilteredEmpty({ onClear, onEdit }: { onClear: () => void; onEdit: () => void }) {
  const styles = useStyles();
  const colors = useColors();
  return (
    <ScrollView contentContainerStyle={styles.empty}>
      <Ionicons name="options-outline" size={44} color={colors.blue} />
      <Text style={styles.emptyTitle}>No one matches those filters yet</Text>
      <Text style={styles.emptyBody}>Try fewer filters, or clear them to see everyone who fits what you’re looking for.</Text>
      <Button title="Clear filters" onPress={onClear} style={{ marginTop: 8, alignSelf: 'stretch' }} />
      <Button title="Edit filters" variant="secondary" onPress={onEdit} style={{ alignSelf: 'stretch' }} />
    </ScrollView>
  );
}

function ExploreMore({ count, onExplore }: { count: number; onExplore: () => void }) {
  const styles = useStyles();
  return (
    <ScrollView contentContainerStyle={styles.empty}>
      <Text style={styles.emptyEmoji}>🧭</Text>
      <Text style={styles.emptyTitle}>You’ve seen your best fits</Text>
      <Text style={styles.emptyBody}>
        There are more creatives outside your usual search: different lanes, other cities. Some of the best collabs come
        from unexpected places.
      </Text>
      <Button title={`Explore ${count} more creative${count === 1 ? '' : 's'}`} onPress={onExplore} style={{ marginTop: 8 }} />
    </ScrollView>
  );
}

function EmptyState({ error, onRefresh, global }: { error: string | null; onRefresh: () => void; global: boolean }) {
  const styles = useStyles();
  if (error) {
    return (
      <ScrollView contentContainerStyle={styles.empty}>
        <Text style={styles.emptyEmoji}>📡</Text>
        <Text style={styles.emptyTitle}>Something went wrong</Text>
        <Text style={styles.emptyBody}>{error}</Text>
        <Button title="Try again" variant="secondary" onPress={onRefresh} style={{ marginTop: 8 }} />
      </ScrollView>
    );
  }
  return (
    <ScrollView contentContainerStyle={styles.empty}>
      <Image source={LOGO} style={styles.emptyLogo} contentFit="contain" />
      <Text style={styles.emptyTitle}>You’re all caught up</Text>
      <Text style={styles.emptyBody}>
        Collab is brand new, and we’re adding creatives every day. Check back soon: more people will be popping up here.
      </Text>
      {!global ? (
        <Text style={styles.emptyHint}>Want more people now? Turn on “Open to global collabs” in Edit profile → Location.</Text>
      ) : null}
      <Button title="Invite a creative" onPress={inviteCreative} style={{ marginTop: 8, alignSelf: 'stretch' }} />
      <Button title="Refresh" variant="secondary" onPress={onRefresh} style={{ alignSelf: 'stretch' }} />
    </ScrollView>
  );
}

function inviteCreative() {
  Share.share({
    message: `I’m on Collab, an app for finding musicians and creators to work with. Join me: ${INVITE_URL}`,
  }).catch(() => {});
}

function WelcomeModal({ visible, name, onClose }: { visible: boolean; name: string; onClose: () => void }) {
  const styles = useStyles();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.welcome}>
          <Text style={styles.welcomeEmoji}>🎉</Text>
          <Text style={styles.welcomeTitle}>You’re in{name ? `, ${name}` : ''}!</Text>
          <Text style={styles.welcomeBody}>
            Here’s how Discover works: tap the Collab button if you’d like to work with someone, ✕ to pass. When it’s mutual, you’re connected and can
            start talking.
          </Text>
          <Button title="Start exploring" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((colors) => ({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 10 },
  quickWrap: { flexGrow: 0, marginBottom: 10 },
  quick: { paddingHorizontal: 14, gap: 8 },
  quickChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: '#E3EEF4',
  },
  quickChipOn: { backgroundColor: colors.inverse, borderColor: colors.inverse },
  quickText: { fontFamily: fonts.bodySemibold, fontSize: 14, color: '#2A3B4D' },
  quickTextOn: { color: colors.onInverse },
  title: { fontFamily: fonts.heading, fontSize: 28, color: colors.text },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 36,
    minWidth: 36,
    paddingHorizontal: 9,
    borderRadius: 18,
    justifyContent: 'center',
    backgroundColor: colors.white,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  filterBtnOn: { backgroundColor: colors.blue },
  filterCount: { fontFamily: fonts.bodySemibold, fontSize: 13, color: colors.white },
  countPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  listBackdrop: { flex: 1, backgroundColor: 'rgba(15,18,24,0.35)' },
  listSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '72%',
    minHeight: '40%',
    backgroundColor: colors.white,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingTop: 8,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -6 },
    elevation: 12,
  },
  listGrabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colors.border, marginBottom: 6 },
  listHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 6 },
  listTitle: { fontFamily: fonts.heading, fontSize: 21, color: colors.text },
  listSub: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary, paddingHorizontal: 20, marginTop: 2, marginBottom: 6 },
  listScroll: { flexGrow: 0 },
  listBody: { paddingHorizontal: 12, paddingBottom: 40 },
  listSection: {
    fontFamily: fonts.bodySemibold,
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.textMuted,
    paddingHorizontal: 8,
    marginTop: 14,
    marginBottom: 4,
  },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 8, paddingVertical: 9, borderRadius: 14 },
  listRowOn: { backgroundColor: '#EEF5F9' },
  listName: { fontFamily: fonts.bodySemibold, fontSize: 16, color: colors.text },
  listDist: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },
  listRole: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary, marginTop: 1 },
  listReason: { fontFamily: fonts.bodyMedium, fontSize: 12, color: '#2F7FA6', marginTop: 2 },
  listNow: { fontFamily: fonts.bodySemibold, fontSize: 12, color: colors.blue },
  countDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.teal },
  count: { fontFamily: fonts.bodySemibold, fontSize: 13, color: colors.textSecondary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loading: { fontFamily: fonts.body, fontSize: 15, color: colors.textSecondary },
  scroll: { paddingHorizontal: 14, paddingTop: 2, paddingBottom: 130 },
  card: {
    borderRadius: 28,
    backgroundColor: colors.white,
    shadowColor: '#2A3B4D',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  cardClip: { borderRadius: 28, overflow: 'hidden' },
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 120 },
  error: { fontFamily: fonts.body, fontSize: 14, color: colors.red, textAlign: 'center', marginTop: 12 },
  actions: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 26,
  },
  action: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  actionPass: { backgroundColor: colors.white },
  actionLike: { width: 74, height: 74, borderRadius: 37, backgroundColor: colors.blue },
  likeLogo: { width: 44, height: 26 },
  emptyLogo: { width: 120, height: 70, marginBottom: 4 },
  actionFill: { width: '100%', height: '100%', borderRadius: 37, alignItems: 'center', justifyContent: 'center' },
  empty: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  emptyEmoji: { fontSize: 52 },
  emptyTitle: { fontFamily: fonts.heading, fontSize: 24, color: colors.text, textAlign: 'center' },
  emptyHint: { fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 19, color: colors.textMuted, textAlign: 'center', maxWidth: 300 },
  emptyBody: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.textSecondary, textAlign: 'center', maxWidth: 320 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  welcome: { width: '100%', maxWidth: 380, backgroundColor: colors.white, borderRadius: 24, padding: 24, gap: 12, alignItems: 'center' },
  welcomeEmoji: { fontSize: 48 },
  welcomeTitle: { fontFamily: fonts.heading, fontSize: 26, color: colors.text, textAlign: 'center' },
  welcomeBody: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.textSecondary, textAlign: 'center', marginBottom: 8 },
}));

