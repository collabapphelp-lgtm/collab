import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Button } from '@/components/Button';
import { ProfileView } from '@/components/ProfileView';
import { SafetyButton } from '@/components/SafetyButton';
import { useAuth } from '@/lib/auth-context';
import { getProfile, like, pairId, passOn } from '@/lib/discover';
import { useLikedYou } from '@/lib/liked-you';
import { useMatches } from '@/lib/use-matches';
import { distanceMiles, formatDistance } from '@/lib/matching';
import type { UserProfile } from '@/lib/types';
import { colors, fonts } from '@/lib/theme';

// Someone's full profile, opened from Connections (incl. "Liked you"), Messages or a chat.
export default function UserProfileScreen() {
  const { id, likedYou } = useLocalSearchParams<{ id: string; likedYou?: string }>();
  const { dismiss } = useLikedYou();
  const [busy, setBusy] = useState(false);
  const { profile: me } = useAuth();
  const [them, setThem] = useState<UserProfile | null | undefined>(undefined);
  const { matches } = useMatches();
  const connected = !!(me && id && matches?.some((m) => m.id === pairId(me.id, id)));

  useEffect(() => {
    if (id) getProfile(id).then(setThem).catch(() => setThem(null));
  }, [id]);

  const back = (
    <Pressable onPress={() => router.back()} style={styles.back} accessibilityRole="button" accessibilityLabel="Back" hitSlop={8}>
      <Ionicons name="chevron-back" size={24} color={colors.text} />
    </Pressable>
  );

  if (them === undefined) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.blue} />
      </SafeAreaView>
    );
  }
  if (them === null) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.missing}>This profile isn’t available.</Text>
        <Button title="Go back" variant="secondary" onPress={() => router.back()} style={{ width: 200 }} />
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.fill}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <ProfileView
          profile={them}
          distanceLabel={formatDistance(distanceMiles(me?.geo, them.geo), them.location)}
        />
      </ScrollView>
      <SafeAreaView edges={['top']} style={styles.topBar} pointerEvents="box-none">
        {back}
        <SafetyButton them={them} tone="light" onBlocked={() => router.back()} />
      </SafeAreaView>
      {likedYou && !connected && me ? (
        <SafeAreaView edges={['bottom']} style={styles.bottomBar}>
          <Text style={styles.likedNote}>{them.firstName} wants to collab with you 👀</Text>
          <View style={styles.actions}>
            <Button
              title="Pass"
              variant="secondary"
              disabled={busy}
              style={styles.flex}
              onPress={async () => {
                setBusy(true);
                try {
                  await passOn(me.id, them.id);
                  dismiss(them.id);
                  router.back();
                } catch {
                  setBusy(false);
                }
              }}
            />
            <Button
              title="Collab back"
              loading={busy}
              style={styles.flex2}
              onPress={async () => {
                setBusy(true);
                try {
                  const matched = await like(me, them);
                  dismiss(them.id);
                  if (matched) router.replace({ pathname: '/match', params: { id: them.id } });
                  else router.back();
                } catch {
                  setBusy(false);
                }
              }}
            />
          </View>
        </SafeAreaView>
      ) : null}
      {connected && me ? (
        <SafeAreaView edges={['bottom']} style={styles.bottomBar}>
          <Button
            title={`Message ${them.firstName}`}
            onPress={() => router.push({ pathname: '/chat/[id]', params: { id: pairId(me.id, them.id) } })}
          />
        </SafeAreaView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.white },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, backgroundColor: colors.white },
  missing: { fontFamily: fonts.body, fontSize: 16, color: colors.textSecondary },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  back: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1 },
  flex2: { flex: 2 },
  actions: { flexDirection: 'row', gap: 10 },
  likedNote: { fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: 10 },
  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 12, backgroundColor: 'rgba(255,255,255,0.96)' },
});
