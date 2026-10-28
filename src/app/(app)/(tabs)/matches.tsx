import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Avatar } from '@/components/Avatar';
import { roleLine } from '@/lib/labels';
import { useMatches } from '@/lib/use-matches';
import { colors, fonts, radius } from '@/lib/theme';

export default function Matches() {
  const { matches, error } = useMatches();
  const { width } = useWindowDimensions();
  const tile = Math.floor((width - 16 * 2 - 14) / 2); // two columns with a 14pt gap

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Matches</Text>
        {matches && matches.length > 0 ? <Text style={styles.count}>{matches.length}</Text> : null}
      </View>

      {matches === null && !error ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.blue} />
        </View>
      ) : !matches || matches.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>{error ? '📡' : '💫'}</Text>
          <Text style={styles.emptyTitle}>{error ? 'Something went wrong' : 'No matches yet'}</Text>
          <Text style={styles.emptyBody}>{error ?? 'When you and another creative both tap ♥, they’ll show up here.'}</Text>
        </View>
      ) : (
        <FlatList
          data={matches}
          keyExtractor={(m) => m.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.list}
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

const styles = StyleSheet.create({
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
