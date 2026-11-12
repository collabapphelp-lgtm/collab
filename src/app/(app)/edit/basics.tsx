import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { doc, setDoc } from 'firebase/firestore';
import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/Button';
import { ErrorText } from '@/components/ErrorText';
import { TextField } from '@/components/TextField';
import { Avatar } from '@/components/Avatar';
import { useAuth } from '@/lib/auth-context';
import { db } from '@/lib/firebase';
import { UI_PREVIEW } from '@/lib/preview';
import { uploadProfilePhoto } from '@/lib/upload';
import { colors, fonts } from '@/lib/theme';
import { BLOCKED_LANGUAGE_MESSAGE, hasBlockedLanguage } from '@/lib/moderation';

// Photo and name: the only profile basics collected at signup rather than in onboarding.
export default function EditBasics() {
  const { profile } = useAuth();
  const [firstName, setFirstName] = useState(profile?.firstName ?? '');
  const [lastName, setLastName] = useState(profile?.lastName ?? '');
  const [newPhoto, setNewPhoto] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!profile) return null;

  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (!result.canceled) setNewPhoto(result.assets[0].uri);
  }

  async function save() {
    if (!profile) return;
    if (!firstName.trim()) return setError('Add your first name so people know who you are.');
    if (hasBlockedLanguage(firstName, lastName)) return setError(BLOCKED_LANGUAGE_MESSAGE);
    setSaving(true);
    setError(null);
    try {
      const patch: Record<string, unknown> = { firstName: firstName.trim(), lastName: lastName.trim() };
      if (newPhoto && !UI_PREVIEW) patch.photoURL = await uploadProfilePhoto(profile.id, newPhoto);
      if (!UI_PREVIEW) await setDoc(doc(db, 'users', profile.id), patch, { merge: true });
      router.back();
    } catch {
      setError('Couldn’t save. Check your connection and try again.');
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <BackButton onPress={() => router.back()} />
          <Text style={styles.title}>Photo & name</Text>

          <Pressable onPress={pickPhoto} style={styles.photoWrap} accessibilityRole="button" accessibilityLabel="Change profile photo">
            {newPhoto ? (
              <Image source={{ uri: newPhoto }} style={styles.photo} contentFit="cover" />
            ) : (
              <Avatar uri={profile.photoURL} name={profile.firstName} seed={profile.id} size={132} />
            )}
            <Text style={styles.change}>{profile.photoURL || newPhoto ? 'Change photo' : 'Add a photo'}</Text>
          </Pressable>

          <TextField label="First name" value={firstName} onChangeText={setFirstName} autoComplete="given-name" textContentType="givenName" maxLength={50} />
          <TextField label="Last name" optional value={lastName} onChangeText={setLastName} autoComplete="family-name" textContentType="familyName" maxLength={50} />
          <ErrorText message={error} />
        </ScrollView>
        <View style={styles.footer}>
          <Button title="Save" onPress={save} loading={saving} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  flex: { flex: 1 },
  content: { padding: 24, gap: 18 },
  title: { fontFamily: fonts.heading, fontSize: 28, color: colors.text },
  photoWrap: { alignItems: 'center', gap: 10 },
  photo: { width: 132, height: 132, borderRadius: 66 },
  change: { fontFamily: fonts.bodySemibold, fontSize: 15, color: colors.blue },
  footer: { paddingHorizontal: 24, paddingBottom: 8 },
});
