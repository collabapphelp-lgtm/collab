import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as AppleAuthentication from 'expo-apple-authentication';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';
import { appleAvailable, Cancelled, googleReady, signInWithApple, signInWithGoogle, type SocialSignIn as Result } from '@/lib/social-auth';
import { friendlyAuthError } from '@/lib/auth-errors';
import { BLOCKED_LANGUAGE_MESSAGE, hasBlockedLanguage } from '@/lib/moderation';
import { Button } from '@/components/Button';
import { ErrorText } from '@/components/ErrorText';
import { TextField } from '@/components/TextField';
import { fonts, makeStyles, useScheme } from '@/lib/theme';
import { UI_PREVIEW } from '@/lib/preview';

/**
 * "Continue with Apple / Google" for both sign-up and log-in. New people get a Collab profile
 * started (name and photo from Apple/Google), then go into setup like an email sign-up.
 */
export function SocialSignIn({ onError }: { onError: (message: string | null) => void }) {
  const styles = useStyles();
  const scheme = useScheme();
  const { setSignupInProgress } = useAuth();
  const [apple, setApple] = useState(UI_PREVIEW);
  const [busy, setBusy] = useState(false);
  // New account without a name (Apple only shares it the first time): ask before going on.
  const [pending, setPending] = useState<Result | null>(null);
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    appleAvailable().then((ok) => live && setApple(ok || UI_PREVIEW));
    return () => {
      live = false;
    };
  }, []);

  async function createProfile(r: Result, firstName: string, lastName: string) {
    await setDoc(doc(db, 'users', r.user.uid), {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      photoURL: r.photoURL,
      createdAt: serverTimestamp(),
      onboardingComplete: false,
    });
  }

  async function run(provider: 'apple' | 'google') {
    onError(null);
    setBusy(true);
    // Hold navigation until we know whether this is a new account that needs a profile first.
    setSignupInProgress(true);
    try {
      const r = provider === 'apple' ? await signInWithApple() : await signInWithGoogle();
      const existing = await getDoc(doc(db, 'users', r.user.uid));
      if (existing.exists()) return setSignupInProgress(false);
      if (r.firstName.trim() && !hasBlockedLanguage(r.firstName, r.lastName)) {
        await createProfile(r, r.firstName, r.lastName);
        return setSignupInProgress(false);
      }
      setFirst('');
      setLast('');
      setPending(r);
    } catch (e) {
      setSignupInProgress(false);
      if (e instanceof Cancelled) return;
      const code = (e as { code?: string })?.code;
      onError(
        code === 'auth/account-exists-with-different-credential'
          ? 'This email already has a Collab account. Log in with your email and password.'
          : friendlyAuthError(e),
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveName() {
    if (!pending) return;
    setNameError(null);
    if (!first.trim()) return setNameError('Add your first name so people know who you are.');
    if (hasBlockedLanguage(first, last)) return setNameError(BLOCKED_LANGUAGE_MESSAGE);
    try {
      await createProfile(pending, first, last);
      setPending(null);
      setSignupInProgress(false);
    } catch (e) {
      setNameError(friendlyAuthError(e));
    }
  }

  async function cancelName() {
    setPending(null);
    setSignupInProgress(false);
    await signOut(auth).catch(() => {});
  }

  if (!apple && !googleReady) return null;
  return (
    <View style={styles.wrap}>
      {apple ? (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
          buttonStyle={
            scheme === 'dark' ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
          }
          cornerRadius={16}
          style={styles.apple}
          onPress={() => !busy && run('apple')}
        />
      ) : null}
      {googleReady ? (
        <Pressable onPress={() => !busy && run('google')} style={({ pressed }) => [styles.google, pressed && { opacity: 0.85 }]} accessibilityRole="button">
          <Ionicons name="logo-google" size={20} color="rgb(66,133,244)" />
          <Text style={styles.googleText}>Continue with Google</Text>
        </Pressable>
      ) : null}
      <View style={styles.orRow}>
        <View style={styles.line} />
        <Text style={styles.or}>or use your email</Text>
        <View style={styles.line} />
      </View>

      <Modal visible={!!pending} transparent animationType="fade" onRequestClose={cancelName}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>What should we call you?</Text>
            <Text style={styles.sheetSub}>This is the name people see on your profile.</Text>
            <TextField label="First name" value={first} onChangeText={setFirst} autoComplete="given-name" textContentType="givenName" />
            <TextField label="Last name" optional value={last} onChangeText={setLast} autoComplete="family-name" textContentType="familyName" />
            <ErrorText message={nameError} />
            <Button title="Continue" onPress={saveName} />
            <Pressable onPress={cancelName} hitSlop={8} style={{ alignSelf: 'center' }}>
              <Text style={styles.cancel}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  wrap: { gap: 12 },
  apple: { height: 52, width: '100%' },
  google: {
    height: 52,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  googleText: { fontFamily: fonts.bodySemibold, fontSize: 17, color: colors.text },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  or: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },
  backdrop: { flex: 1, backgroundColor: 'rgba(10,12,16,0.6)', justifyContent: 'center', padding: 20 },
  sheet: { backgroundColor: colors.bg, borderRadius: 24, padding: 20, gap: 14 },
  sheetTitle: { fontFamily: fonts.heading, fontSize: 22, color: colors.text },
  sheetSub: { fontFamily: fonts.body, fontSize: 14, color: colors.textSecondary, marginTop: -8 },
  cancel: { fontFamily: fonts.bodySemibold, fontSize: 15, color: colors.textSecondary },
}));
