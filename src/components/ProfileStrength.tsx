import { useSyncExternalStore } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, type Href } from 'expo-router';
import { LinearGradient } from '@/components/ThemedGradient';
import { profileStrength } from '@/lib/profile-strength';
import type { UserProfile } from '@/lib/types';
import { fonts, radius, makeStyles, useColors } from '@/lib/theme';

// Dismissing: the first X just hides it until the app is next opened. The next time someone closes it
// (in a later session), they're asked whether to hide it for good.
const KEY = 'collab.strength.dismissed'; // 'once' | 'never'
let stored: string | null = null;
let hiddenThisSession = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
AsyncStorage.getItem(KEY)
  .then((v) => {
    stored = v;
    notify();
  })
  .catch(() => {});
const snapshot = () => (stored === 'never' ? 'never' : hiddenThisSession ? 'hidden' : 'shown');
function useDismissed() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    snapshot,
    snapshot,
  );
}

function dismiss() {
  const save = (v: string) => {
    stored = v;
    AsyncStorage.setItem(KEY, v).catch(() => {});
  };
  if (stored !== 'once') {
    save('once');
    hiddenThisSession = true;
    return notify();
  }
  Alert.alert('Hide profile strength?', undefined, [
    {
      text: 'Hide for now',
      onPress: () => {
        hiddenThisSession = true;
        notify();
      },
    },
    {
      text: 'Don’t show this again',
      style: 'destructive',
      onPress: () => {
        save('never');
        notify();
      },
    },
    { text: 'Cancel', style: 'cancel' },
  ]);
}

/** "Profile strength" card with the single next thing to do. Hidden once everything's done, or dismissed. */
export function ProfileStrength({ profile }: { profile: UserProfile }) {
  const styles = useStyles();
  const colors = useColors();
  const dismissed = useDismissed();
  const { percent, next } = profileStrength(profile);
  if (!next || dismissed !== 'shown') return null;
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
        <Pressable onPress={dismiss} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close profile strength" style={styles.close}>
          <Ionicons name="close" size={20} color={colors.textMuted} />
        </Pressable>
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

const useStyles = makeStyles((colors) => ({
  card: {
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
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontFamily: fonts.heading, fontSize: 17, color: colors.text },
  close: { marginRight: -4 },
  percent: { fontFamily: fonts.heading, fontSize: 17, color: colors.blue },
  track: { height: 8, borderRadius: 4, backgroundColor: '#EDF2F6', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  next: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nextLabel: { flex: 1, fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.text },
  arrow: { fontFamily: fonts.bodySemibold, fontSize: 22, color: colors.blue, marginTop: -2 },
  hint: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary, marginTop: -4 },
}));
