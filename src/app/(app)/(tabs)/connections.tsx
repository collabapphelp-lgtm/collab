import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCallback } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { Avatar } from '@/components/Avatar';
import { roleLine } from '@/lib/labels';
import { useMatches } from '@/lib/use-matches';
import { useLikedYou } from '@/lib/liked-you';
import type { UserProfile } from '@/lib/types';
import { colors, fonts, radius } from '@/lib/theme';

export default function Connections() {
  const { matches, error } = useMatches();
  const { refresh } = useLikedYou();
  // Passes made in Discover since last time should drop out of "Liked you".
  useFocusEffect(useCallback(() => refresh(), [refresh]));
  const { width } = useWindowDimensions();
  const tile = Math.floor((width - 16 * 2 - 14) / 2); // two columns with a 14pt gap

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Connections</Text>
        {matches && matches.length > 0 ? <Text style={styles.count}>{matches.length}</Text> : null}
      </View>

      {matches === null && !error ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.blue} />
        </View>
      ) : (
        <FlatList
          data={matches ?? []}
          keyExtractor={(m) => m.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={[styles.list, !matches?.length && { flexGrow: 1 }]}
          ListHeaderComponent={<LikedYouRow />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyEmoji}>{error ? '📡' : '💫'}</Text>
              <Text style={styles.emptyTitle}>{error ? 'Something went wrong' : 'No connections yet'}</Text>
              <Text style={styles.emptyBody}>
                {error ?? 'When you and another creative both tap ♥, you’re connected and they’ll show up here.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push({ pathname: '/user/[id]', params: { id: item.other.id } })}
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
              accessibilityRole="button"
              accessibilityLabel={`${item.other.firstName}, ${roleLine(item.other)}`}
            >
              <Avatar uri={item.other.photoURL} name={item.other.firstName} seed={item.other.id} size={tile} radius={16} />
              <Text style={styles.name} numberOfLines={1}>
                {item.other.firstName}
              </Text>
              <Text style={styles.role} numberOfLines={1}>
                {roleLine(item.other)}
              </Text>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

/** People who liked me and are waiting on my answer. Hidden when there's nobody. */
function LikedYouRow() {
  const { likedYou } = useLikedYou();
  if (!likedYou?.length) return null;
  return (
    <LinearGradient colors={['#EEF5F9', '#F3EFF8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.liked}>
      <View style={styles.likedHead}>
        <Text style={styles.likedTitle}>Liked you</Text>
        <Text style={styles.likedCount}>{likedYou.length}</Text>
      </View>
      <Text style={styles.likedSub}>Like them back to connect and start talking.</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.likedList}>
        {likedYou.map((p) => (
          <LikedPerson key={p.id} p={p} />
        ))}
      </ScrollView>
    </LinearGradient>
  );
}

function LikedPerson({ p }: { p: UserProfile }) {
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/user/[id]', params: { id: p.id, likedYou: '1' } })}
      style={({ pressed }) => [styles.likedPerson, pressed && { opacity: 0.8 }]}
      accessibilityRole="button"
      accessibilityLabel={`${p.firstName} liked you. Open profile`}
    >
      <LinearGradient colors={[colors.blue, colors.purple]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.likedRing}>
        <View style={styles.likedRingInner}>
          <Avatar uri={p.photoURL} name={p.firstName} seed={p.id} size={66} />
        </View>
      </LinearGradient>
      <Text style={styles.likedName} numberOfLines={1}>
        {p.firstName}
      </Text>
      <Text style={styles.likedRole} numberOfLines={1}>
        {roleLine(p)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  liked: { borderRadius: radius.md, paddingVertical: 14, marginBottom: 20 },
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
  safe: { flex: 1, backgroundColor: colors.white },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  title: { fontFamily: fonts.heading, fontSize: 28, color: colors.text },
  count: {
    fontFamily: fonts.bodySemibold,
    fontSize: 13,
    color: colors.white,
    backgroundColor: colors.blue,
    paddingHorizontal: 9,
    paddingVertical: 2,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontFamily: fonts.heading, fontSize: 22, color: colors.text },
  emptyBody: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.textSecondary, textAlign: 'center', maxWidth: 300 },
  list: { paddingHorizontal: 16, paddingBottom: 24, gap: 18 },
  row: { gap: 14 },
  card: { flex: 1, maxWidth: '50%', gap: 4 },
  name: { fontFamily: fonts.bodySemibold, fontSize: 16, color: colors.text, marginTop: 6 },
  role: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary },
});
