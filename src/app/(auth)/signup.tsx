import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View, type TextInputInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';
import { uploadProfilePhoto } from '@/lib/upload';
import { friendlyAuthError } from '@/lib/auth-errors';
import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/Button';
import { ErrorText } from '@/components/ErrorText';
import { TextField } from '@/components/TextField';
import { SignupIntro } from '@/components/SignupIntro';
import { SocialSignIn } from '@/components/SocialSignIn';
import { openLegal } from '@/lib/legal';
import { fonts, makeStyles } from '@/lib/theme';
import { BLOCKED_LANGUAGE_MESSAGE, hasBlockedLanguage } from '@/lib/moderation';

export default function Signup() {
  const styles = useStyles();
  const { setSignupInProgress } = useAuth();
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [exists, setExists] = useState(false);

  const firstRef = useRef<TextInputInstance>(null);
  const lastRef = useRef<TextInputInstance>(null);
  const passwordRef = useRef<TextInputInstance>(null);

  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  }

  async function handleSignup() {
    setError(null);
    setExists(false);
    if (!email.trim()) return setError('Enter your email.');
    if (password.length < 6) return setError('Use at least 6 characters for your password.');
    if (!firstName.trim()) return setError('Add your first name so people know who you are.');
    if (hasBlockedLanguage(firstName, lastName)) return setError(BLOCKED_LANGUAGE_MESSAGE);

    setSubmitting(true);
    setSignupInProgress(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);

      let photoURL: string | null = null;
      if (photoUri) {
        try {
          photoURL = await uploadProfilePhoto(cred.user.uid, photoUri);
        } catch (e) {
          // Don't block signup on a photo problem; they can add one later from their profile.
          console.warn('Photo upload failed', e);
        }
      }

      await setDoc(doc(db, 'users', cred.user.uid), {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        photoURL,
        createdAt: serverTimestamp(),
        onboardingComplete: false,
      });
      // Releasing the hold lets the root navigator move them into onboarding.
      setSignupInProgress(false);
    } catch (e) {
      setSignupInProgress(false);
      setSubmitting(false);
      // Already signed up: point them to log in (with their email filled in) instead of a dead end.
      if ((e as { code?: string })?.code === 'auth/email-already-in-use') setExists(true);
      else setError(friendlyAuthError(e));
    }
  }

  return (
    <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.headRow}>
            <BackButton />
            <Text style={styles.title}>Join Collab</Text>
          </View>
          <Text style={styles.subtitle}>Meet creatives who complement your sound, your style and your goals.</Text>

          <SignupIntro />

          <SocialSignIn onError={setError} />

          {/* Email first: anyone who already has an account finds out before typing anything else. */}
          <View style={styles.fields}>
            <TextField
              label="Email"
              value={email}
              onChangeText={(t) => (setEmail(t), setExists(false))}
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
              autoComplete="new-password"
              textContentType="newPassword"
              placeholder="At least 6 characters"
              returnKeyType="next"
              onSubmitEditing={() => firstRef.current?.focus()}
            />
            <View style={styles.nameRow}>
              <View style={styles.flex1}>
                <TextField
                  ref={firstRef}
                  label="First name"
                  value={firstName}
                  onChangeText={setFirstName}
                  autoComplete="given-name"
                  textContentType="givenName"
                  returnKeyType="next"
                  onSubmitEditing={() => lastRef.current?.focus()}
                />
              </View>
              <View style={styles.flex1}>
                <TextField
                  ref={lastRef}
                  label="Last name"
                  optional
                  value={lastName}
                  onChangeText={setLastName}
                  autoComplete="family-name"
                  textContentType="familyName"
                  returnKeyType="go"
                  onSubmitEditing={handleSignup}
                />
              </View>
            </View>
            <Pressable onPress={pickPhoto} accessibilityRole="button" accessibilityLabel="Add a profile photo, optional" style={styles.photoRow}>
              <View style={styles.photo}>
                {photoUri ? (
                  <Image source={{ uri: photoUri }} style={styles.photoImg} contentFit="cover" />
                ) : (
                  <Text style={styles.photoIcon}>📷</Text>
                )}
              </View>
              <Text style={styles.photoText}>
                {photoUri ? 'Change photo' : 'Add a photo'} <Text style={styles.photoOptional}>optional</Text>
              </Text>
            </Pressable>
          </View>

          {exists ? (
            <Pressable
              onPress={() => router.replace({ pathname: '/login', params: { email: email.trim() } })}
              style={styles.exists}
              accessibilityRole="button"
            >
              <Text style={styles.existsText}>
                You already have an account with this email. <Text style={styles.switchLink}>Log in instead</Text>
              </Text>
            </Pressable>
          ) : null}
          <ErrorText message={error} />

          <View style={styles.footer}>
            <Text style={styles.legal}>
              By creating an account, you agree to our{' '}
              <Text style={styles.legalLink} onPress={() => openLegal('terms')} accessibilityRole="link">
                Terms
              </Text>{' '}
              and{' '}
              <Text style={styles.legalLink} onPress={() => openLegal('privacy')} accessibilityRole="link">
                Privacy Policy
              </Text>
              , and confirm you’re 18 or older.
            </Text>
            <Button title="Create account" onPress={handleSignup} loading={submitting} />
            <Pressable onPress={() => router.replace('/login')} hitSlop={8}>
              <Text style={styles.switchText}>
                Already have an account? <Text style={styles.switchLink}>Log in</Text>
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles((colors) => ({
  flex: { flex: 1, backgroundColor: colors.bg },
  content: { flexGrow: 1, padding: 24, gap: 20 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  title: { flex: 1, fontFamily: fonts.heading, fontSize: 28, color: colors.text },
  subtitle: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.textSecondary, marginTop: -8 },
  nameRow: { flexDirection: 'row', gap: 12 },
  flex1: { flex: 1 },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, alignSelf: 'flex-start' },
  exists: { padding: 14, borderRadius: 14, backgroundColor: 'rgba(75,163,199,0.1)' },
  existsText: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.text, textAlign: 'center' },
  photo: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.blue,
    backgroundColor: 'rgba(75,163,199,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoImg: { width: '100%', height: '100%' },
  photoIcon: { fontSize: 18 },
  photoText: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.blue },
  photoOptional: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },
  fields: { gap: 14 },
  footer: { marginTop: 'auto', gap: 16, alignItems: 'center' },
  switchText: { fontFamily: fonts.body, fontSize: 15, color: colors.textSecondary },
  switchLink: { fontFamily: fonts.bodySemibold, color: colors.blue },
  legal: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.textMuted, textAlign: 'center' },
  legalLink: { fontFamily: fonts.bodySemibold, color: colors.textSecondary, textDecorationLine: 'underline' },
}));
