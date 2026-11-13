import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { ProfileView } from '@/components/ProfileView';
import { ProfileStrength } from '@/components/ProfileStrength';
import { useAuth } from '@/lib/auth-context';
import { shortLocation } from '@/lib/labels';
import { openLegal, SUPPORT_EMAIL } from '@/lib/legal';
import { colors, fonts } from '@/lib/theme';

// Which version is running: the build's own code, or an over-the-air update (and when it was published).
function versionLine() {
  const v = Constants.expoConfig?.version ?? '';
  if (Updates.isEmbeddedLaunch || !Updates.createdAt) return `Collab ${v}`;
  const when = Updates.createdAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `Collab ${v} · updated ${when} (${(Updates.updateId ?? '').slice(0, 6)})`;
}

// Your own profile, as others see it.
export default function MyProfile() {
  const { profile, signOutUser } = useAuth();
  const insets = useSafeAreaInsets();
  if (!profile) return null;

  return (
    <View style={styles.fill}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={{ paddingTop: insets.top + 8 }}>
          <ProfileStrength profile={profile} />
        </View>
        <ProfileView profile={profile} isSelf distanceLabel={shortLocation(profile.location) ?? 'Location not set'} />
        <View style={styles.actions}>
          <Text style={styles.note}>This is how other creatives see your profile.</Text>
          <Button
            title="Edit profile"
            onPress={() => router.push('/edit')}
          />
          <Button
            title="Log out"
            variant="secondary"
            onPress={() =>
              Alert.alert('Log out?', undefined, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Log out', style: 'destructive', onPress: () => void signOutUser() },
              ])
            }
          />
          <Pressable onPress={() => router.push('/delete-account')} hitSlop={8} style={styles.deleteLink} accessibilityRole="button">
            <Text style={styles.deleteText}>Delete account</Text>
          </Pressable>
          <View style={styles.legalRow}>
            <Text style={styles.legalLink} onPress={() => openLegal('privacy')}>
              Privacy
            </Text>
            <Text style={styles.legalDot}>·</Text>
            <Text style={styles.legalLink} onPress={() => openLegal('terms')}>
              Terms
            </Text>
            <Text style={styles.legalDot}>·</Text>
            <Text style={styles.legalLink} onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() => {})}>
              Help
            </Text>
          </View>
          <Text style={styles.version}>{versionLine()}</Text>
        </View>
      </ScrollView>
      <SafeAreaView edges={['top']} style={styles.topFade} pointerEvents="none" />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.white },
  actions: { paddingHorizontal: 20, gap: 12 },
  note: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, textAlign: 'center', marginBottom: 4 },
  deleteLink: { alignSelf: 'center', paddingVertical: 12 },
  deleteText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.red },
  legalRow: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  legalLink: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.textMuted },
  legalDot: { fontSize: 13, color: colors.textMuted },
  version: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: 6 },
  topFade: { position: 'absolute', top: 0, left: 0, right: 0 },
});
