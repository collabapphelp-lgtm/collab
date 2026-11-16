import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { doc, setDoc } from 'firebase/firestore';
import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/Button';
import { ErrorText } from '@/components/ErrorText';
import { useAuth } from '@/lib/auth-context';
import { db } from '@/lib/firebase';
import { BLOCKED_LANGUAGE_MESSAGE, hasBlockedLanguage } from '@/lib/moderation';
import { BIO_MAX_CHARS } from '@/lib/onboarding-data';
import { UI_PREVIEW } from '@/lib/preview';
import { fonts, makeStyles, useColors } from '@/lib/theme';

const IDEAS = [
  'A producer who’s down to link weekly in Brooklyn.',
  'Someone who finishes songs, not just starts them.',
  'A videographer for a music video this spring.',
];

/** The partner note (stored as `bio`): what you want in a collab partner. Shown big on your Discover card. */
export default function EditBio() {
  const styles = useStyles();
  const colors = useColors();
  const { profile } = useAuth();
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!profile) return null;

  async function save() {
    if (!profile) return;
    if (hasBlockedLanguage(bio)) return setError(BLOCKED_LANGUAGE_MESSAGE);
    setSaving(true);
    setError(null);
    try {
      if (!UI_PREVIEW) await setDoc(doc(db, 'users', profile.id), { bio: bio.trim() }, { merge: true });
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
          <Text style={styles.title}>Your partner note</Text>
          <Text style={styles.sub}>What are you looking for in a collab partner? This shows up big on your Discover card.</Text>
          <TextInput
            value={bio}
            onChangeText={(t) => {
              setBio(t);
              setError(null);
            }}
            multiline
            maxLength={BIO_MAX_CHARS}
            placeholder="e.g. A vocalist with a strong pen who’s serious about finishing songs."
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            accessibilityLabel="What are you looking for in a collab partner"
            autoFocus={!profile.bio}
          />
          <Text style={styles.count}>
            {bio.length}/{BIO_MAX_CHARS}
          </Text>
          {!bio.trim() ? (
            <View style={styles.ideas}>
              <Text style={styles.ideasTitle}>Need ideas?</Text>
              {IDEAS.map((i) => (
                <Text key={i} style={styles.idea} onPress={() => setBio(i)}>
                  {i}
                </Text>
              ))}
            </View>
          ) : null}
          <ErrorText message={error} />
        </ScrollView>
        <View style={styles.footer}>
          <Button title="Save" onPress={save} loading={saving} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles((colors) => ({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: { padding: 24, gap: 12 },
  title: { fontFamily: fonts.heading, fontSize: 28, color: colors.text },
  sub: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.textSecondary },
  input: {
    minHeight: 140,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: 14,
    fontFamily: fonts.heading,
    fontSize: 18,
    lineHeight: 24,
    color: colors.text,
    textAlignVertical: 'top',
    marginTop: 6,
  },
  count: { alignSelf: 'flex-end', fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },
  ideas: { gap: 8, padding: 14, borderRadius: 16, backgroundColor: '#FFF4DF' },
  ideasTitle: { fontFamily: fonts.bodySemibold, fontSize: 13, color: '#8A5A12' },
  idea: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.text },
  footer: { paddingHorizontal: 24, paddingBottom: 8 },
}));
