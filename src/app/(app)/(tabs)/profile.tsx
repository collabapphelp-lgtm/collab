import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { ProfileView } from '@/components/ProfileView';
import { useAuth } from '@/lib/auth-context';
import { shortLocation } from '@/lib/labels';
import { colors, fonts } from '@/lib/theme';

// Your own profile, as others see it.
export default function MyProfile() {
  const { profile, signOutUser } = useAuth();
  if (!profile) return null;

  return (
    <View style={styles.fill}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
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
  topFade: { position: 'absolute', top: 0, left: 0, right: 0 },
});
