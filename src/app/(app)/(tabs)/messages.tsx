import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Avatar } from '@/components/Avatar';
import { useAuth } from '@/lib/auth-context';
import { isUnread, type Match } from '@/lib/connections';
import { roleLine } from '@/lib/labels';
import { listTime } from '@/lib/time';
import { useMatches } from '@/lib/use-matches';
import { colors, fonts } from '@/lib/theme';

export default function Messages() {
  const { user } = useAuth();
  const { matches, error } = useMatches();
  const me = user?.uid ?? '';

  // New connections you haven't talked to yet get their own row at the top, like a waiting room.
  const fresh = (matches ?? []).filter((m) => !m.lastMessage);
  const chats = (matches ?? []).filter((m) => m.lastMessage);

  const open = (m: Match) => router.push({ pathname: '/chat/[id]', params: { id: m.id } });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Text style={styles.title}>Messages</Text>

      {matches === null && !error ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.blue} />
        </View>
      ) : !matches || matches.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>{error ? '📡' : '💬'}</Text>
          <Text style={styles.emptyTitle}>{error ? 'Something went wrong' : 'No conversations yet'}</Text>
          <Text style={styles.emptyBody}>
            {error ?? 'When you connect with a creative on Discover, you can message them here.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={chats}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ paddingBottom: 24 }}
          ListHeaderComponent={
            fresh.length > 0 ? (
              <View style={styles.freshWrap}>
                <Text style={styles.section}>New connections</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.freshRow}>
                  {fresh.map((m) => (
                    <Pressable key={m.id} onPress={() => open(m)} style={styles.fresh} accessibilityRole="button" accessibilityLabel={`Message ${m.other.firstName}`}>
                      <View style={styles.freshRing}>
                        <Avatar uri={m.other.photoURL} name={m.other.firstName} seed={m.other.id} size={64} />
                      </View>
                      <Text style={styles.freshName} numberOfLines={1}>
                        {m.other.firstName}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
                {chats.length > 0 ? <Text style={[styles.section, { marginTop: 8 }]}>Conversations</Text> : null}
              </View>
            ) : undefined
          }
          ListEmptyComponent={
            <Text style={styles.hint}>Tap someone above to say hi. A quick note about their work goes a long way.</Text>
          }
          renderItem={({ item }) => {
            const unread = isUnread(item, me);
            const mine = item.lastMessage?.senderId === me;
            return (
              <Pressable onPress={() => open(item)} style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.bgSecondary }]}>
                <Avatar uri={item.other.photoURL} name={item.other.firstName} seed={item.other.id} size={56} />
                <View style={styles.rowText}>
                  <View style={styles.rowTop}>
                    <Text style={[styles.name, unread && styles.bold]} numberOfLines={1}>
                      {item.other.firstName}
                      <Text style={styles.role}>  {roleLine(item.other, 1)}</Text>
                    </Text>
                    <Text style={[styles.time, unread && { color: colors.blue }]}>{listTime(item.lastMessage!.at)}</Text>
                  </View>
                  <View style={styles.rowBottom}>
                    <Text style={[styles.preview, unread && styles.previewUnread]} numberOfLines={1}>
                      {mine ? 'You: ' : ''}
                      {item.lastMessage!.text}
                    </Text>
                    {unread ? <View style={styles.dot} /> : null}
                  </View>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  title: { fontFamily: fonts.heading, fontSize: 28, color: colors.text, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8 },
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
  fresh: { alignItems: 'center', width: 72, gap: 6 },
  freshRing: { padding: 3, borderRadius: 40, borderWidth: 2, borderColor: colors.yellow },
  freshName: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.text },
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
});
