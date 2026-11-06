import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, type Href } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar } from '@/components/Avatar';
import { useAuth } from '@/lib/auth-context';
import { fullName, lookingOptionFor, optionFor, roleLine, shortLocation } from '@/lib/labels';
import { colors, fonts } from '@/lib/theme';

const list = (values: string[] | undefined, n = 3) => {
  if (!values?.length) return undefined;
  const labels = values.slice(0, n).map((v) => optionFor(v).label);
  return values.length > n ? `${labels.join(', ')} +${values.length - n}` : labels.join(', ');
};

export default function EditProfile() {
  const { profile } = useAuth();
  if (!profile) return null;
  const isMusician = profile.creatorType !== 'content';
  const showcaseCount = profile.showcase?.length ?? 0;

  const rows: { title: string; value?: string; href: Href }[] = [
    { title: 'Location', value: profile.global ? `${shortLocation(profile.location) ?? 'Not set'} · Open to global` : shortLocation(profile.location), href: '/edit/location' },
    {
      title: 'I am a…',
      value: [profile.creatorType === 'content' ? 'Content Creator' : profile.creatorType === 'musician' ? 'Musician' : null, roleLine(profile, 3)]
        .filter(Boolean)
        .join(' · ') || undefined,
      href: '/edit/type',
    },
    { title: 'Looking to collab with', value: profile.lookingFor?.map((v) => lookingOptionFor(v).label).join(', ') || undefined, href: '/edit/looking' },
    {
      title: isMusician ? 'Your sound' : 'Your vibe',
      value: [list(isMusician ? profile.genres : profile.interests), profile.openToAll ? 'Open to all' : null].filter(Boolean).join(' · ') || undefined,
      href: '/edit/taste',
    },
    { title: 'Showcase', value: showcaseCount ? `${showcaseCount} item${showcaseCount === 1 ? '' : 's'}` : undefined, href: '/edit/showcase' },
    { title: 'Anything else', value: profile.bio || undefined, href: '/edit/bio' },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Done">
          <Text style={styles.done}>Done</Text>
        </Pressable>
        <Text style={styles.title}>Edit profile</Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <Pressable onPress={() => router.push('/edit/basics')} style={styles.basics} accessibilityRole="button" accessibilityLabel="Edit photo and name">
          <Avatar uri={profile.photoURL} name={profile.firstName} seed={profile.id} size={72} />
          <View style={styles.flex}>
            <Text style={styles.name}>{fullName(profile)}</Text>
            <Text style={styles.link}>Change photo or name</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </Pressable>

        {rows.map((r) => (
          <Pressable key={r.title} onPress={() => router.push(r.href)} style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.bgSecondary }]}>
            <View style={styles.flex}>
              <Text style={styles.rowTitle}>{r.title}</Text>
              <Text style={[styles.rowValue, !r.value && styles.empty]} numberOfLines={1}>
                {r.value ?? 'Not set yet. Tap to add'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  title: { fontFamily: fonts.bodySemibold, fontSize: 17, color: colors.text },
  done: { fontFamily: fonts.bodySemibold, fontSize: 16, color: colors.blue, width: 44 },
  body: { paddingBottom: 32 },
  basics: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 20 },
  name: { fontFamily: fonts.heading, fontSize: 20, color: colors.text },
  link: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.blue, marginTop: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  rowTitle: { fontFamily: fonts.bodySemibold, fontSize: 15, color: colors.text },
  rowValue: { fontFamily: fonts.body, fontSize: 14, color: colors.textSecondary, marginTop: 2 },
  empty: { color: colors.blue },
});
