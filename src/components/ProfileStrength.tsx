import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { profileStrength } from '@/lib/profile-strength';
import type { UserProfile } from '@/lib/types';
import { colors, fonts, radius } from '@/lib/theme';

/** "Profile strength" card with the single next thing to do. Hidden once everything's done. */
export function ProfileStrength({ profile }: { profile: UserProfile }) {
  const { percent, next } = profileStrength(profile);
  if (!next) return null;
  return (
    <Pressable
      onPress={() => router.push(next.route as Href)}
      accessibilityRole="button"
      accessibilityLabel={`Profile strength ${percent} percent. Next: ${next.label}`}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.head}>
        <Text style={styles.title}>Profile strength</Text>
        <Text style={styles.percent}>{percent}%</Text>
      </View>
      <View style={styles.track}>
        <LinearGradient
          colors={[colors.blue, colors.purple]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.fill, { width: `${Math.max(percent, 6)}%` }]}
        />
      </View>
      <View style={styles.next}>
        <Text style={styles.nextLabel}>Next: {next.label}</Text>
        <Text style={styles.arrow}>›</Text>
      </View>
      {next.key === 'work' ? <Text style={styles.hint}>Profiles with work get shown first in Discover.</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 16,
    gap: 10,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#E3EEF4',
    shadowColor: '#2A3B4D',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  title: { fontFamily: fonts.heading, fontSize: 17, color: colors.text },
  percent: { fontFamily: fonts.heading, fontSize: 17, color: colors.blue },
  track: { height: 8, borderRadius: 4, backgroundColor: '#EDF2F6', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  next: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nextLabel: { flex: 1, fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.text },
  arrow: { fontFamily: fonts.bodySemibold, fontSize: 22, color: colors.blue, marginTop: -2 },
  hint: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary, marginTop: -4 },
});
