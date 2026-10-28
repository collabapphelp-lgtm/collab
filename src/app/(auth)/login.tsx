import { useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View, type TextInputInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { sendPasswordResetEmail, signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { friendlyAuthError } from '@/lib/auth-errors';
import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/Button';
import { ErrorText } from '@/components/ErrorText';
import { TextField } from '@/components/TextField';
import { colors, fonts } from '@/lib/theme';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const passwordRef = useRef<TextInputInstance>(null);

  async function handleLogin() {
    setError(null);
    if (!email.trim() || !password) return setError('Enter your email and password.');
    setSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      // The root navigator routes them to onboarding or the app from here.
    } catch (e) {
      setSubmitting(false);
      setError(friendlyAuthError(e));
    }
  }

  async function handleForgot() {
    if (!email.trim()) return setError('Enter your email above, then tap "Forgot password?" again.');
    try {
      await sendPasswordResetEmail(auth, email.trim());
      Alert.alert('Check your email', `We sent a password reset link to ${email.trim()}.`);
    } catch (e) {
      setError(friendlyAuthError(e));
    }
  }

  return (
    <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <BackButton />
          <View style={styles.header}>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>Log in to pick up where you left off</Text>
          </View>

          <View style={styles.fields}>
            <TextField
              label="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
            />
            <TextField
              ref={passwordRef}
              label="Password"
              value={password}
              onChangeText={setPassword}
              password
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={handleLogin}
            />
            <Pressable onPress={handleForgot} hitSlop={8} style={styles.forgot}>
              <Text style={styles.link}>Forgot password?</Text>
            </Pressable>
          </View>

          <ErrorText message={error} />

          <View style={styles.footer}>
            <Button title="Log in" onPress={handleLogin} loading={submitting} />
            <Pressable onPress={() => router.replace('/signup')} hitSlop={8}>
              <Text style={styles.switchText}>
                New to Collab? <Text style={styles.link}>Create an account</Text>
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.white },
  content: { flexGrow: 1, padding: 24, gap: 20 },
  header: { gap: 6, marginTop: 4 },
  title: { fontFamily: fonts.heading, fontSize: 32, color: colors.text },
  subtitle: { fontFamily: fonts.body, fontSize: 15, color: colors.textSecondary },
  fields: { gap: 14 },
  forgot: { alignSelf: 'flex-end' },
  link: { fontFamily: fonts.bodySemibold, color: colors.blue, fontSize: 15 },
  footer: { marginTop: 'auto', gap: 16, alignItems: 'center' },
  switchText: { fontFamily: fonts.body, fontSize: 15, color: colors.textSecondary },
});
