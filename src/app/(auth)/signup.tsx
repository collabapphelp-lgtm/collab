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
import { colors, fonts } from '@/lib/theme';

// Shows people what signing up leads to. The first step (this screen) is highlighted.
const STEPS = [
  { icon: '✍️', title: 'Sign up', body: 'Takes 30 seconds' },
  { icon: '🎨', title: 'Build your profile', body: 'Your craft, sound and best work' },
  { icon: '🤝', title: 'Match & collab', body: 'Meet creatives who fit' },
];

export default function Signup() {
  const { setSignupInProgress } = useAuth();
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const lastRef = useRef<TextInputInstance>(null);
  const emailRef = useRef<TextInputInstance>(null);
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
    if (!firstName.trim()) return setError('Add your first name so people know who you are.');
    if (!email.trim()) return setError('Enter your email.');
    if (password.length < 6) return setError('Use at least 6 characters for your password.');

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
        email: email.trim().toLowerCase(),
        photoURL,
        createdAt: serverTimestamp(),
        onboardingComplete: false,
      });
      // Releasing the hold lets the root navigator move them into onboarding.
      setSignupInProgress(false);
    } catch (e) {
      setSignupInProgress(false);
      setSubmitting(false);
      setError(friendlyAuthError(e));
    }
  }

  return (
    <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <BackButton />

          <View style={styles.header}>
            <Text style={styles.title}>Get started</Text>
            <Text style={styles.subtitle}>Create your profile and start connecting with creators</Text>
          </View>

          <View style={styles.steps} accessibilityLabel="How Collab works: create your account, build your creative profile, then get matched and start collaborating">
            {STEPS.map((step, i) => (
              <View key={step.title} style={[styles.step, i === 0 && styles.stepActive]}>
                <Text style={styles.stepEmoji}>{step.icon}</Text>
                <Text style={[styles.stepTitle, i === 0 && styles.stepTitleActive]}>{step.title}</Text>
                <Text style={styles.stepBody}>{step.body}</Text>
              </View>
            ))}
          </View>

          <View style={styles.topRow}>
            <Pressable onPress={pickPhoto} accessibilityRole="button" accessibilityLabel="Add a profile photo" style={styles.photo}>
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={styles.photoImg} contentFit="cover" />
              ) : (
                <>
                  <Text style={styles.photoIcon}>📷</Text>
                  <Text style={styles.photoText}>Add photo</Text>
                </>
              )}
            </Pressable>
            <View style={styles.names}>
              <TextField
                label="First name"
                value={firstName}
                onChangeText={setFirstName}
                autoComplete="given-name"
                textContentType="givenName"
                returnKeyType="next"
                onSubmitEditing={() => lastRef.current?.focus()}
              />
              <TextField
                ref={lastRef}
                label="Last name"
                optional
                value={lastName}
                onChangeText={setLastName}
                autoComplete="family-name"
                textContentType="familyName"
                returnKeyType="next"
                onSubmitEditing={() => emailRef.current?.focus()}
              />
            </View>
          </View>

          <View style={styles.fields}>
            <TextField
              ref={emailRef}
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
              autoComplete="new-password"
              textContentType="newPassword"
              placeholder="At least 6 characters"
              returnKeyType="go"
              onSubmitEditing={handleSignup}
            />
          </View>

          <ErrorText message={error} />

          <View style={styles.footer}>
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

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.white },
  content: { flexGrow: 1, padding: 24, gap: 20 },
  header: { gap: 6, marginTop: 4 },
  title: { fontFamily: fonts.heading, fontSize: 32, color: colors.text },
  subtitle: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.textSecondary },
  steps: { flexDirection: 'row', gap: 8 },
  step: {
    flex: 1,
    padding: 10,
    borderRadius: 14,
    backgroundColor: colors.bgSecondary,
    borderWidth: 1.5,
    borderColor: 'transparent',
    gap: 2,
  },
  stepActive: { borderColor: colors.blue, backgroundColor: 'rgba(75,163,199,0.08)' },
  stepEmoji: { fontSize: 18, marginBottom: 2 },
  stepTitle: { fontFamily: fonts.bodySemibold, fontSize: 13, color: colors.text },
  stepTitleActive: { color: colors.blue },
  stepBody: { fontFamily: fonts.body, fontSize: 11.5, lineHeight: 15, color: colors.textSecondary },
  topRow: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  photo: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.blue,
    backgroundColor: 'rgba(75,163,199,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoImg: { width: '100%', height: '100%' },
  photoIcon: { fontSize: 26 },
  photoText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.blue, marginTop: 2 },
  names: { flex: 1, gap: 12 },
  fields: { gap: 14 },
  footer: { marginTop: 'auto', gap: 16, alignItems: 'center' },
  switchText: { fontFamily: fonts.body, fontSize: 15, color: colors.textSecondary },
  switchLink: { fontFamily: fonts.bodySemibold, color: colors.blue },
});
