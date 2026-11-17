import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { GoingTo } from '@/components/GoingTo';
import { ProfileView } from '@/components/ProfileView';
import { useAuth } from '@/lib/auth-context';
import { shortLocation } from '@/lib/labels';
import { fonts, makeStyles } from '@/lib/theme';

/**
 * Your profile the way other people see it on Discover. Lives inside the Edit stack, so it slides in
 * on top of Edit profile (opening the normal profile screen put it behind the Edit sheet).
 */
export default function PreviewProfile() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  if (!profile) return null;
  return (
    <View style={styles.fill}>
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        <ProfileView
          profile={profile}
          layout="work"
          topInset={insets.top}
          distanceLabel={shortLocation(profile.location) ?? undefined}
          heroAccessory={
            <Pressable onPress={() => router.back()} style={styles.done} accessibilityRole="button" accessibilityLabel="Back to editing">
              <Ionicons name="chevron-back" size={16} color="#17151F" />
              <Text style={styles.doneText}>Back to editing</Text>
            </Pressable>
          }
          belowHero={
            <View style={styles.banner}>
              <Ionicons name="eye-outline" size={16} color="#2F7FA6" />
              <Text style={styles.bannerText}>This is how others see you on Discover.</Text>
            </View>
          }
          footer={<GoingTo uid={profile.id} name={profile.firstName} />}
        />
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  fill: { flex: 1, backgroundColor: colors.bg },
  done: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingLeft: 10,
    paddingRight: 14,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgb(255,255,255)',
  },
  doneText: { fontFamily: fonts.bodySemibold, fontSize: 14, color: '#17151F' },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 14, backgroundColor: '#E6F1F7' },
  bannerText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 14, color: '#1F5F7F' },
}));
