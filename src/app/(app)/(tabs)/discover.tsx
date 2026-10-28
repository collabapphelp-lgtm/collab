import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Button } from '@/components/Button';
import { ProfileView } from '@/components/ProfileView';
import { Quote, QUOTES } from '@/components/Quote';
import { useAuth } from '@/lib/auth-context';
import { like, loadUnseenProfiles, passOn } from '@/lib/discover';
import { formatDistance, rankCandidates, type Candidate } from '@/lib/matching';
import { consumeJustFinished } from '@/lib/onboarding-context';
import { colors, fonts } from '@/lib/theme';

export default function Discover() {
  const { profile } = useAuth();
  const [queue, setQueue] = useState<Candidate[] | null>(null);
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

  const fetchQueue = useCallback(async (): Promise<{ queue: Candidate[]; error: string | null }> => {
    const me = profileRef.current;
    if (!me) return { queue: [], error: null };
    try {
      return { queue: rankCandidates(me, await loadUnseenProfiles(me.id)), error: null };
    } catch (e) {
      console.warn('Discover load failed', e);
      return { queue: [], error: 'Couldn’t load creatives. Check your connection and try again.' };
    }
  }, []);

  useEffect(() => {
    if (!meId) return;
    let cancelled = false;
    fetchQueue().then((r) => {
      if (cancelled) return;
      setQueue(r.queue);
      setError(r.error);
    });
    return () => {
      cancelled = true;
    };
  }, [meId, fetchQueue]);

  async function refresh() {
    setQueue(null);
    setError(null);
    const r = await fetchQueue();
    setQueue(r.queue);
    setError(r.error);
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
      <View style={styles.header}>
        <Text style={styles.title}>Discover</Text>
        {queue && queue.length > 0 ? <Text style={styles.count}>{queue.length} to explore</Text> : null}
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
              <ProfileView
                profile={current.profile}
                distanceLabel={formatDistance(current.distanceMiles, current.profile.location)}
                reasons={current.reasons}
              />
            </View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </ScrollView>

          <View style={styles.actions} pointerEvents="box-none">
            <ActionButton kind="pass" onPress={() => decide('pass')} disabled={acting} />
            <ActionButton kind="like" onPress={() => decide('like')} disabled={acting} />
          </View>
        </View>
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
      accessibilityLabel={like ? 'Like' : 'Pass'}
      style={({ pressed }) => [
        styles.action,
        like ? styles.actionLike : styles.actionPass,
        { transform: [{ scale: pressed ? 0.92 : 1 }], opacity: disabled ? 0.6 : 1 },
      ]}
    >
      <Ionicons name={like ? 'heart' : 'close'} size={like ? 32 : 30} color={like ? colors.white : colors.red} />
    </Pressable>
  );
}

function EmptyState({ error, onRefresh, global }: { error: string | null; onRefresh: () => void; global: boolean }) {
  return (
    <ScrollView contentContainerStyle={styles.empty}>
      <Text style={styles.emptyEmoji}>{error ? '📡' : '🌊'}</Text>
      <Text style={styles.emptyTitle}>{error ? 'Something went wrong' : 'You’ve seen everyone for now'}</Text>
      <Text style={styles.emptyBody}>
        {error
          ? error
          : global
            ? 'New creatives join every day. Check back soon, and invite artists you’d love to work with.'
            : 'New creatives join every day. Opening up to global collabs will show you more people.'}
      </Text>
      <Button title="Refresh" variant="secondary" onPress={onRefresh} style={{ marginTop: 8 }} />
      {!error ? <Quote quote={QUOTES.ocean} style={{ marginTop: 36 }} /> : null}
    </ScrollView>
  );
}

function WelcomeModal({ visible, name, onClose }: { visible: boolean; name: string; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.welcome}>
          <Text style={styles.welcomeEmoji}>🎉</Text>
          <Text style={styles.welcomeTitle}>You’re in{name ? `, ${name}` : ''}!</Text>
          <Text style={styles.welcomeBody}>
            Here’s how Discover works: tap ♥ if you’d like to collab, ✕ to pass. When it’s mutual, it’s a match and you can
            start talking.
          </Text>
          <Button title="Start exploring" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgSecondary },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  title: { fontFamily: fonts.heading, fontSize: 28, color: colors.text },
  count: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.textMuted },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loading: { fontFamily: fonts.body, fontSize: 15, color: colors.textSecondary },
  scroll: { paddingHorizontal: 12, paddingBottom: 120 },
  card: { borderRadius: 24, overflow: 'hidden', backgroundColor: colors.white },
  error: { fontFamily: fonts.body, fontSize: 14, color: colors.red, textAlign: 'center', marginTop: 12 },
  actions: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 18,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 28,
  },
  action: {
    width: 66,
    height: 66,
    borderRadius: 33,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  actionPass: { backgroundColor: colors.white },
  actionLike: { backgroundColor: colors.blue },
  empty: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  emptyEmoji: { fontSize: 52 },
  emptyTitle: { fontFamily: fonts.heading, fontSize: 24, color: colors.text, textAlign: 'center' },
  emptyBody: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.textSecondary, textAlign: 'center', maxWidth: 320 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  welcome: { width: '100%', maxWidth: 380, backgroundColor: colors.white, borderRadius: 24, padding: 24, gap: 12, alignItems: 'center' },
  welcomeEmoji: { fontSize: 48 },
  welcomeTitle: { fontFamily: fonts.heading, fontSize: 26, color: colors.text, textAlign: 'center' },
  welcomeBody: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.textSecondary, textAlign: 'center', marginBottom: 8 },
});

