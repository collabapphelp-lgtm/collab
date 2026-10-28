import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Avatar } from '@/components/Avatar';
import { useMatches } from '@/lib/use-matches';
import { colors, fonts, radius } from '@/lib/theme';

// Placeholder until Phase 4 (real-time chat + push notifications).
export default function Messages() {
  const { matches } = useMatches();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Text style={styles.title}>Messages</Text>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.notice}>
          <Text style={styles.noticeEmoji}>💬</Text>
          <Text style={styles.noticeTitle}>Chat is coming in the next update</Text>
          <Text style={styles.noticeBody}>
            You’ll be able to message every match here. For now, your matches are saved and waiting.
          </Text>
        </View>

        {matches && matches.length > 0 ? (
          <>
            <Text style={styles.section}>Your matches</Text>
            {matches.map((m) => (
              <Pressable
                key={m.id}
                onPress={() => router.push({ pathname: '/user/[id]', params: { id: m.other.id } })}
                style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
              >
                <Avatar uri={m.other.photoURL} name={m.other.firstName} seed={m.other.id} size={52} />
                <View style={styles.rowText}>
                  <Text style={styles.rowName}>{m.other.firstName}</Text>
                  <Text style={styles.rowSub}>New match · say hi soon</Text>
                </View>
              </Pressable>
            ))}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  title: { fontFamily: fonts.heading, fontSize: 28, color: colors.text, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  body: { paddingHorizontal: 20, paddingBottom: 24, gap: 12 },
  notice: { alignItems: 'center', gap: 8, padding: 24, borderRadius: radius.md, backgroundColor: 'rgba(75,163,199,0.08)' },
  noticeEmoji: { fontSize: 40 },
  noticeTitle: { fontFamily: fonts.bodySemibold, fontSize: 17, color: colors.text, textAlign: 'center' },
  noticeBody: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.textSecondary, textAlign: 'center' },
  section: { fontFamily: fonts.bodySemibold, fontSize: 13, letterSpacing: 0.6, textTransform: 'uppercase', color: colors.textMuted, marginTop: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 8 },
  rowText: { flex: 1 },
  rowName: { fontFamily: fonts.bodySemibold, fontSize: 16, color: colors.text },
  rowSub: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary },
});
