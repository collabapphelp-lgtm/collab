import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { useAuth } from '@/lib/auth-context';
import { colors, fonts } from '@/lib/theme';

// Temporary screen for parts of the app we haven't built yet.
export function Placeholder({ emoji, title, body }: { emoji: string; title: string; body: string }) {
  const { profile, user, signOutUser } = useAuth();
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.center}>
        <Text style={styles.emoji}>{emoji}</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
        <Text style={styles.meta}>Signed in as {profile?.firstName ?? user?.email}</Text>
      </View>
      <Button title="Log out" variant="secondary" onPress={signOutUser} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: colors.white },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emoji: { fontSize: 56 },
  title: { fontFamily: fonts.heading, fontSize: 28, color: colors.text, textAlign: 'center' },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 23, color: colors.textSecondary, textAlign: 'center', maxWidth: 300 },
  meta: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, marginTop: 12 },
});
