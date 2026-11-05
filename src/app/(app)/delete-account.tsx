import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/Button';
import { ErrorText } from '@/components/ErrorText';
import { TextField } from '@/components/TextField';
import { deleteAccount } from '@/lib/account';
import { useAuth } from '@/lib/auth-context';
import { friendlyAuthError } from '@/lib/auth-errors';
import { colors, fonts, radius } from '@/lib/theme';

const WHAT_GOES = [
  'Your profile, photo and showcase uploads',
  'Your likes, passes and blocks',
  'Messages you’ve sent (your conversations close for the other person)',
  'Your login. You’ll need to sign up again to come back.',
];

export default function DeleteAccount() {
  const { setDeletingAccount, signOutUser } = useAuth();
  const [password, setPassword] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    if (!password) return setError('Enter your password to confirm.');
    setError(null);
    setWorking(true);
    setDeletingAccount(true);
    try {
      await deleteAccount(password);
      setDeletingAccount(false); // login is gone now, so the app returns to the welcome screen
      await signOutUser().catch(() => {});
    } catch (e) {
      setDeletingAccount(false);
      setWorking(false);
      const code = (e as { code?: string }).code ?? '';
      setError(
        code.startsWith('auth/')
          ? friendlyAuthError(e)
          : 'Something went wrong partway through. Check your connection and try again; it will pick up where it left off.',
      );
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <BackButton onPress={() => router.back()} />
          <Text style={styles.title}>Delete your account</Text>
          <Text style={styles.body}>This can’t be undone. Deleting your account permanently removes:</Text>
          <View style={styles.list}>
            {WHAT_GOES.map((t) => (
              <Text key={t} style={styles.item}>
                •  {t}
              </Text>
            ))}
          </View>
          <TextField label="Enter your password to confirm" value={password} onChangeText={setPassword} password autoComplete="current-password" textContentType="password" />
          <ErrorText message={error} />
        </ScrollView>
        <View style={styles.footer}>
          <Button title="Permanently delete my account" variant="danger" onPress={confirm} loading={working} disabled={!password} />
          <Button title="Keep my account" variant="secondary" onPress={() => router.back()} disabled={working} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  flex: { flex: 1 },
  content: { padding: 24, gap: 16 },
  title: { fontFamily: fonts.heading, fontSize: 28, color: colors.text, marginTop: 4 },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 23, color: colors.textSecondary },
  list: { gap: 8, padding: 16, borderRadius: radius.md, backgroundColor: 'rgba(229,75,75,0.06)' },
  item: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.text },
  footer: { paddingHorizontal: 24, paddingBottom: 8, gap: 10 },
});
