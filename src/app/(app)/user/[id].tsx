import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Button } from '@/components/Button';
import { ProfileView } from '@/components/ProfileView';
import { useAuth } from '@/lib/auth-context';
import { getProfile } from '@/lib/discover';
import { distanceMiles, formatDistance } from '@/lib/matching';
import type { UserProfile } from '@/lib/types';
import { colors, fonts } from '@/lib/theme';

// Someone's full profile, opened from Matches.
export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile: me } = useAuth();
  const [them, setThem] = useState<UserProfile | null | undefined>(undefined);

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
      </SafeAreaView>
      <SafeAreaView edges={['bottom']} style={styles.bottomBar}>
        <Button title={`Message ${them.firstName}`} onPress={() => router.navigate('/messages')} />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.white },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, backgroundColor: colors.white },
  missing: { fontFamily: fonts.body, fontSize: 16, color: colors.textSecondary },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 16, paddingTop: 8 },
  back: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 12, backgroundColor: 'rgba(255,255,255,0.96)' },
});
