import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from '@/components/ThemedGradient';
import { router, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar } from '@/components/Avatar';
import { GroupAvatar } from '@/components/GroupAvatar';
import { useAuth } from '@/lib/auth-context';
import { groupTitle, isGroupUnread, isUnread, respondToGroup, type Group, type Match } from '@/lib/connections';
import { displayName, optionFor, roleLine } from '@/lib/labels';
import { useLikedYou } from '@/lib/liked-you';
import { listTime } from '@/lib/time';
import type { UserProfile } from '@/lib/types';
import { useMatches } from '@/lib/use-matches';
import { fonts, radius, makeStyles, useColors } from '@/lib/theme';

// Connections and Messages in one place: who wants to collab, new connections you haven't
// talked to yet, group invites, then every conversation (1:1 and groups), newest first.

type Chat = { kind: 'dm'; id: string; at: number; match: Match } | { kind: 'group'; id: string; at: number; group: Group };

const UNREAD = 'unread';
const GROUPS = 'groups';

export default function Collabs() {
  const styles = useStyles();
  const colors = useColors();
  const { user } = useAuth();
  const { matches, groups, error } = useMatches();
  const { refresh } = useLikedYou();
  // Passes made in Discover since last time should drop out of "Wants to collab".
  useFocusEffect(useCallback(() => refresh(), [refresh]));
  const me = user?.uid ?? '';

  const [search, setSearch] = useState('');
  const [chip, setChip] = useState<string | null>(null);

  const invites = (groups ?? []).filter((g) => g.invited.includes(me));
  const myGroups = (groups ?? []).filter((g) => g.members.includes(me));

  // Role chips: the most common roles among your connections.
  const roleChips = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of matches ?? []) for (const s of m.other.skills ?? []) counts.set(s, (counts.get(s) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([v]) => v);
  }, [matches]);

  const q = search.trim().toLowerCase();
  const filtering = !!q || !!chip;
  const personFits = useCallback(
    (p: UserProfile) => {
      if (q && !`${displayName(p)} ${p.firstName} ${p.lastName ?? ''} ${roleLine(p, 4)}`.toLowerCase().includes(q)) return false;
      if (chip && chip !== UNREAD && chip !== GROUPS && !(p.skills ?? []).includes(chip)) return false;
      return true;
    },
    [q, chip],
  );

  const fresh = (matches ?? []).filter((m) => !m.lastMessage && chip !== UNREAD && chip !== GROUPS && personFits(m.other));
  const chats: Chat[] = [
    ...(chip === GROUPS ? [] : (matches ?? []))
      .filter((m) => m.lastMessage && personFits(m.other) && (chip !== UNREAD || isUnread(m, me)))
      .map((m): Chat => ({ kind: 'dm', id: m.id, at: m.lastMessage!.at, match: m })),
    ...myGroups
      .filter((g) => {
        if (chip === UNREAD && !isGroupUnread(g, me)) return false;
        const others = g.members.filter((u) => u !== me).map((u) => g.people[u]).filter(Boolean);
        if (chip && chip !== UNREAD && chip !== GROUPS && !others.some((p) => (p.skills ?? []).includes(chip))) return false;
        if (q && !groupTitle(g, me).toLowerCase().includes(q) && !others.some((p) => personFits(p))) return false;
        return true;
      })
      .map((g): Chat => ({ kind: 'group', id: g.id, at: g.lastMessage?.at ?? g.createdAt, group: g })),
  ].sort((a, b) => b.at - a.at);

  const total = matches?.length ?? 0;
  const loading = matches === null && !error;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Collabs</Text>
        {total >= 2 ? (
          <Pressable
            onPress={() => router.push('/group/new')}
            style={({ pressed }) => [styles.newGroup, pressed && { opacity: 0.8 }]}
            accessibilityRole="button"
            accessibilityLabel="New group chat"
          >
            <Ionicons name="people-outline" size={18} color={colors.blue} />
            <Text style={styles.newGroupText}>New group</Text>
          </Pressable>
        ) : null}
      </View>

      {total > 0 ? (
        <View style={styles.filters}>
          <View style={styles.search}>
            <Ionicons name="search" size={17} color={colors.textMuted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search your connections"
              placeholderTextColor={colors.textMuted}
              style={styles.searchInput}
              autoCorrect={false}
              returnKeyType="search"
              clearButtonMode="while-editing"
              accessibilityLabel="Search your connections"
            />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} keyboardShouldPersistTaps="handled">
            {[UNREAD, ...(myGroups.length ? [GROUPS] : []), ...roleChips].map((c) => {
              const on = chip === c;
              const label = c === UNREAD ? 'Unread' : c === GROUPS ? 'Groups' : optionFor(c).label;
              return (
                <Pressable
                  key={c}
                  onPress={() => setChip(on ? null : c)}
                  style={[styles.chip, on && styles.chipOn]}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                >
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.blue} />
        </View>
      ) : (
        <FlatList
          data={chats}
          keyExtractor={(c) => c.id}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={[{ paddingBottom: 24 }, chats.length === 0 && { flexGrow: 1 }]}
          ListHeaderComponent={
            <View>
              {!filtering ? invites.map((g) => <GroupInvite key={g.id} group={g} />) : null}
              {!filtering ? <LikedYouRow /> : null}
              {fresh.length > 0 ? (
                <View style={styles.freshWrap}>
                  <Text style={styles.section}>New connections</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.freshRow}>
                    {fresh.map((m) => (
                      <Pressable
                        key={m.id}
                        onPress={() => router.push({ pathname: '/chat/[id]', params: { id: m.id } })}
                        onLongPress={() => router.push({ pathname: '/user/[id]', params: { id: m.other.id } })}
                        style={styles.fresh}
                        accessibilityRole="button"
                        accessibilityLabel={`Message ${displayName(m.other)}`}
                        accessibilityHint="Long-press to view their profile"
                      >
                        <View style={styles.freshRing}>
                          <Avatar uri={m.other.photoURL} name={displayName(m.other)} seed={m.other.id} size={64} />
                        </View>
                        <Text style={styles.freshName} numberOfLines={1}>
                          {displayName(m.other)}
                        </Text>
                        <Text style={styles.freshRole} numberOfLines={1}>
                          {roleLine(m.other, 1)}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              ) : null}
              {chats.length > 0 ? <Text style={[styles.section, { marginTop: 8 }]}>Conversations</Text> : null}
            </View>
          }
          ListEmptyComponent={
            filtering ? (
              <Text style={styles.hint}>No one matches that. Try another search or filter.</Text>
            ) : total === 0 && !myGroups.length ? (
              <View style={styles.center}>
                <Text style={styles.emptyEmoji}>{error ? '📡' : '💬'}</Text>
                <Text style={styles.emptyTitle}>{error ? 'Something went wrong' : 'No connections yet'}</Text>
                <Text style={styles.emptyBody}>
                  {error ?? 'When you and another creative both tap Collab, you’re connected and can message each other here.'}
                </Text>
              </View>
            ) : (
              <Text style={styles.hint}>Tap someone above to say hi. A quick note about their work goes a long way.</Text>
            )
          }
          renderItem={({ item }) => (item.kind === 'dm' ? <DmRow match={item.match} me={me} /> : <GroupRow group={item.group} me={me} />)}
        />
      )}
    </SafeAreaView>
  );
}

function DmRow({ match, me }: { match: Match; me: string }) {
  const styles = useStyles();
  const colors = useColors();
  const unread = isUnread(match, me);
  const mine = match.lastMessage?.senderId === me;
  const name = displayName(match.other);
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/chat/[id]', params: { id: match.id } })}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.bgSecondary }]}
    >
      <Pressable
        onPress={() => router.push({ pathname: '/user/[id]', params: { id: match.other.id } })}
        hitSlop={4}
        accessibilityRole="button"
        accessibilityLabel={`View ${name}'s profile`}
      >
        <Avatar uri={match.other.photoURL} name={name} seed={match.other.id} size={56} />
      </Pressable>
      <View style={styles.rowText}>
        <View style={styles.rowTop}>
          <Text style={[styles.name, unread && styles.bold]} numberOfLines={1}>
            {name}
            <Text style={styles.role}>  {roleLine(match.other, 1)}</Text>
          </Text>
          <Text style={[styles.time, unread && { color: colors.blue }]}>{listTime(match.lastMessage!.at)}</Text>
        </View>
        <View style={styles.rowBottom}>
          <Text style={[styles.preview, unread && styles.previewUnread]} numberOfLines={1}>
            {mine ? 'You: ' : ''}
            {match.lastMessage!.text}
          </Text>
          {unread ? <View style={styles.dot} /> : null}
        </View>
      </View>
    </Pressable>
  );
}

function GroupRow({ group, me }: { group: Group; me: string }) {
  const styles = useStyles();
  const colors = useColors();
  const unread = isGroupUnread(group, me);
  const last = group.lastMessage;
  const sender = last && last.senderId !== 'system' ? (last.senderId === me ? 'You' : group.people[last.senderId]?.firstName) : null;
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/chat/[id]', params: { id: group.id } })}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.bgSecondary }]}
    >
      <GroupAvatar group={group} me={me} size={56} />
      <View style={styles.rowText}>
        <View style={styles.rowTop}>
          <Text style={[styles.name, unread && styles.bold]} numberOfLines={1}>
            {groupTitle(group, me)}
            <Text style={styles.role}>  {group.members.length} people</Text>
          </Text>
          {last ? <Text style={[styles.time, unread && { color: colors.blue }]}>{listTime(last.at)}</Text> : null}
        </View>
        <View style={styles.rowBottom}>
          <Text style={[styles.preview, unread && styles.previewUnread]} numberOfLines={1}>
            {sender ? `${sender}: ` : ''}
            {last?.text ?? ''}
          </Text>
          {unread ? <View style={styles.dot} /> : null}
        </View>
      </View>
    </Pressable>
  );
}

function GroupInvite({ group }: { group: Group }) {
  const styles = useStyles();
  const colors = useColors();
  const { profile } = useAuth();
  const [busy, setBusy] = useState(false);
  const from = group.people[group.createdBy];
  const others = [...group.members, ...group.invited].filter((u) => u !== profile?.id).map((u) => group.people[u]?.firstName ?? 'Someone');

  async function answer(accept: boolean) {
    if (!profile) return;
    setBusy(true);
    try {
      await respondToGroup(group.id, profile, accept);
      if (accept) router.push({ pathname: '/chat/[id]', params: { id: group.id } });
    } catch (e) {
      console.warn('Group answer failed', e);
      Alert.alert('That didn’t go through', 'Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <LinearGradient colors={['#FFF6DE', '#F3EFF8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.invite}>
      <View style={styles.inviteHead}>
        <GroupAvatar group={group} me={profile?.id ?? ''} size={48} />
        <View style={styles.flex}>
          <Text style={styles.inviteTitle} numberOfLines={1}>
            {group.name || 'Group chat'}
          </Text>
          <Text style={styles.inviteBody} numberOfLines={2}>
            {from ? `${from.firstName} added you` : 'You were added'} · with {others.join(', ')}
          </Text>
        </View>
      </View>
      <Text style={styles.inviteNote}>Joining also connects you with anyone in it you aren’t connected with yet.</Text>
      <View style={styles.inviteButtons}>
        <Pressable
          onPress={() => answer(false)}
          disabled={busy}
          style={({ pressed }) => [styles.inviteBtn, styles.inviteNo, pressed && { opacity: 0.8 }]}
          accessibilityRole="button"
        >
          <Text style={styles.inviteNoText}>Decline</Text>
        </Pressable>
        <Pressable
          onPress={() => answer(true)}
          disabled={busy}
          style={({ pressed }) => [styles.inviteBtn, styles.inviteYes, pressed && { opacity: 0.85 }]}
          accessibilityRole="button"
        >
          {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.inviteYesText}>Join chat</Text>}
        </Pressable>
      </View>
    </LinearGradient>
  );
}

/** People who liked me and are waiting on my answer. Hidden when there's nobody. */
function LikedYouRow() {
  const styles = useStyles();
  const { likedYou } = useLikedYou();
  if (!likedYou?.length) return null;
  return (
    <LinearGradient colors={['#EEF5F9', '#F3EFF8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.liked}>
      <View style={styles.likedHead}>
        <Text style={styles.likedTitle}>Wants to collab</Text>
        <Text style={styles.likedCount}>{likedYou.length}</Text>
      </View>
      <Text style={styles.likedSub}>These creatives want to work with you. Collab back to connect.</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.likedList}>
        {likedYou.map((p) => (
          <LikedPerson key={p.id} p={p} />
        ))}
      </ScrollView>
    </LinearGradient>
  );
}

function LikedPerson({ p }: { p: UserProfile }) {
  const styles = useStyles();
  const colors = useColors();
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/user/[id]', params: { id: p.id, likedYou: '1' } })}
      style={({ pressed }) => [styles.likedPerson, pressed && { opacity: 0.8 }]}
      accessibilityRole="button"
      accessibilityLabel={`${displayName(p)} wants to collab with you. Open profile`}
    >
      <LinearGradient colors={[colors.blue, colors.purple]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.likedRing}>
        <View style={styles.likedRingInner}>
          <Avatar uri={p.photoURL} name={displayName(p)} seed={p.id} size={66} />
        </View>
      </LinearGradient>
      <Text style={styles.likedName} numberOfLines={1}>
        {displayName(p)}
      </Text>
      <Text style={styles.likedRole} numberOfLines={1}>
        {roleLine(p)}
      </Text>
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  flex: { flex: 1 },
  safe: { flex: 1, backgroundColor: colors.white },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8 },
  title: { fontFamily: fonts.heading, fontSize: 28, color: colors.text },
  newGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 34,
    borderRadius: radius.full,
    backgroundColor: '#E6F1F7',
  },
  newGroupText: { fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.blue },
  filters: { gap: 10, paddingBottom: 8 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.bgSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: { flex: 1, fontFamily: fonts.body, fontSize: 15, color: colors.text, paddingVertical: 0 },
  chips: { paddingHorizontal: 20, gap: 8 },
  chip: { paddingHorizontal: 13, paddingVertical: 6, borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.white },
  chipOn: { backgroundColor: colors.inverse, borderColor: colors.inverse },
  chipText: { fontFamily: fonts.bodySemibold, fontSize: 13, color: '#2A3B4D' },
  chipTextOn: { color: colors.onInverse },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontFamily: fonts.heading, fontSize: 22, color: colors.text },
  emptyBody: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.textSecondary, textAlign: 'center', maxWidth: 300 },
  section: {
    fontFamily: fonts.bodySemibold,
    fontSize: 13,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.textMuted,
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  freshWrap: { paddingTop: 8, paddingBottom: 4 },
  freshRow: { paddingHorizontal: 20, gap: 16, paddingBottom: 12 },
  fresh: { alignItems: 'center', width: 76, gap: 2 },
  freshRing: { padding: 3, borderRadius: 40, borderWidth: 2, borderColor: colors.yellow, marginBottom: 4 },
  freshName: { fontFamily: fonts.bodySemibold, fontSize: 13, color: colors.text },
  freshRole: { fontFamily: fonts.body, fontSize: 11, color: colors.textSecondary },
  hint: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.textMuted, textAlign: 'center', paddingHorizontal: 40, marginTop: 24 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 12 },
  rowText: { flex: 1, gap: 3 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 16, color: colors.text },
  bold: { fontFamily: fonts.bodySemibold },
  role: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },
  time: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },
  rowBottom: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  preview: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.textSecondary },
  previewUnread: { color: colors.text, fontFamily: fonts.bodyMedium },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.blue },
  invite: { marginHorizontal: 16, marginTop: 6, marginBottom: 14, borderRadius: radius.md, padding: 14, gap: 10 },
  inviteHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  inviteTitle: { fontFamily: fonts.heading, fontSize: 17, color: colors.text },
  inviteBody: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  inviteNote: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },
  inviteButtons: { flexDirection: 'row', gap: 10 },
  inviteBtn: { flex: 1, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  inviteNo: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  inviteNoText: { fontFamily: fonts.bodySemibold, fontSize: 15, color: colors.textSecondary },
  inviteYes: { backgroundColor: colors.blue },
  inviteYesText: { fontFamily: fonts.bodySemibold, fontSize: 15, color: colors.white },
  liked: { borderRadius: radius.md, paddingVertical: 14, marginHorizontal: 16, marginTop: 6, marginBottom: 14 },
  likedHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14 },
  likedTitle: { fontFamily: fonts.heading, fontSize: 18, color: colors.text },
  likedCount: {
    fontFamily: fonts.bodySemibold,
    fontSize: 12,
    color: colors.white,
    backgroundColor: colors.purple,
    paddingHorizontal: 8,
    paddingVertical: 1,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  likedSub: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary, paddingHorizontal: 14, marginTop: 2 },
  likedList: { gap: 14, paddingHorizontal: 14, paddingTop: 12 },
  likedPerson: { width: 80, alignItems: 'center', gap: 2 },
  likedRing: { width: 76, height: 76, borderRadius: 38, padding: 3 },
  likedRingInner: { flex: 1, borderRadius: 35, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  likedName: { fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.text, marginTop: 4 },
  likedRole: { fontFamily: fonts.body, fontSize: 11, color: colors.textSecondary },
}));
