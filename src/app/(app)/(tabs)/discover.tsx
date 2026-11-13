import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Share, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';
import { INVITE_URL } from '@/lib/legal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Button } from '@/components/Button';
import { ProfileView } from '@/components/ProfileView';
import { SafetyButton } from '@/components/SafetyButton';
import { Quote, QUOTES } from '@/components/Quote';
import { useAuth } from '@/lib/auth-context';
import { like, loadUnseenProfiles, passOn } from '@/lib/discover';
import { formatDistance, rankCandidates, type Candidate } from '@/lib/matching';
import { consumeJustFinished } from '@/lib/onboarding-context';
import { colors, fonts } from '@/lib/theme';

const LOGO = require('../../../../assets/logo.png');
const LOGO_WHITE = require('../../../../assets/logo-white.png');

export default function Discover() {
  const { profile } = useAuth();
  const [queue, setQueue] = useState<Candidate[] | null>(null);
  // Non-direct fits, held back until best fits run out and the person chooses to explore.
  const [more, setMore] = useState<Candidate[]>([]);
  const [exploring, setExploring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [welcome, setWelcome] = useState(() => consumeJustFinished());
  const scrollRef = useRef<ScrollViewInstance>(null);

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
    setQueue(r.best);
    setMore(r.more);
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
    setQueue(null);
    setError(null);
    apply(await fetchQueue());
  }

  function exploreMore() {
    setQueue(more);
    setMore([]);
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
      setQueue((q) => (q ? q.slice(1) : q));
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
      <LinearGradient colors={['#E6F1F7', '#F4F2EC']} style={StyleSheet.absoluteFill} />
      <View style={styles.header}>
        <Text style={styles.title}>Discover</Text>
        {queue && queue.length > 0 ? (
          <View style={styles.countPill}>
            <View style={styles.countDot} />
            <Text style={styles.count}>{exploring ? `Exploring · ${queue.length} more` : `${queue.length} to explore`}</Text>
          </View>
        ) : null}
      </View>

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
                profile={current.profile}
                distanceLabel={formatDistance(current.distanceMiles, current.profile.location)}
                reasons={current.reasons}
                heroHeight={340}
                heroAccessory={
                  <SafetyButton them={current.profile} tone="light" onBlocked={() => setQueue((q) => (q ? q.slice(1) : q))} />
                }
                />
              </View>
            </View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </ScrollView>

          <LinearGradient colors={['rgba(244,242,236,0)', 'rgba(244,242,236,0.95)']} style={styles.fade} pointerEvents="none" />
          <View style={styles.actions} pointerEvents="box-none">
            <ActionButton kind="pass" onPress={() => decide('pass')} disabled={acting} />
            <ActionButton kind="like" onPress={() => decide('like')} disabled={acting} />
          </View>
        </View>
      ) : !error && more.length > 0 ? (
        <ExploreMore count={more.length} onExplore={exploreMore} />
      ) : (
        <EmptyState error={error} onRefresh={refresh} global={!!profile?.global} />
      )}

      <WelcomeModal visible={welcome} name={profile?.firstName ?? ''} onClose={() => setWelcome(false)} />
    </SafeAreaView>
  );
}

function ActionButton({ kind, onPress, disabled }: { kind: 'pass' | 'like'; onPress: () => void; disabled?: boolean }) {
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
        <Ionicons name="close" size={30} color={colors.red} />
      )}
    </Pressable>
  );
}

function ExploreMore({ count, onExplore }: { count: number; onExplore: () => void }) {
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
      <Quote quote={QUOTES.ocean} style={{ marginTop: 28 }} />
    </ScrollView>
  );
}

function inviteCreative() {
  Share.share({
    message: `I’m on Collab, an app for finding musicians and creators to work with. Join me: ${INVITE_URL}`,
  }).catch(() => {});
}

function WelcomeModal({ visible, name, onClose }: { visible: boolean; name: string; onClose: () => void }) {
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F4F2EC' },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 14 },
  title: { fontFamily: fonts.heading, fontSize: 28, color: colors.text },
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
    width: 62,
    height: 62,
    borderRadius: 31,
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
});

