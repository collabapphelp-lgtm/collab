import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Button } from '@/components/Button';
import { Quote, QUOTES } from '@/components/Quote';
import { useAuth } from '@/lib/auth-context';
import { getProfile, pairId } from '@/lib/discover';
import { optionFor } from '@/lib/labels';
import type { UserProfile } from '@/lib/types';
import { colors, fonts, radius } from '@/lib/theme';

// "It's a Collab!" — shown right after two people like each other.
// Dark "studio at night" look; the tilted cards echo the welcome screen.
export default function ConnectionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile: me } = useAuth();
  const [them, setThem] = useState<UserProfile | null>(null);

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    if (id) getProfile(id).then(setThem).catch(() => {});
  }, [id]);

  const chatId = me && id ? pairId(me.id, id) : null;

  return (
    <LinearGradient colors={['#141629', '#231D45', '#2B2257']} style={styles.fill}>
      {/* Soft brand-colored glows for depth */}
      <View style={[styles.glow, { backgroundColor: colors.blue, top: -80, left: -90 }]} />
      <View style={[styles.glow, { backgroundColor: colors.yellow, bottom: 40, right: -120, opacity: 0.18 }]} />

      <SafeAreaView style={styles.safe}>
        <View style={styles.content}>
          <Text style={styles.eyebrow}>NEW CONNECTION</Text>

          <View style={styles.cards}>
            <PersonCard person={me} tilt="-7deg" accent={colors.blue} />
            <View style={styles.connector}>
              <Text style={styles.connectorIcon}>🤝</Text>
            </View>
            <PersonCard person={them} tilt="7deg" accent={colors.purple} />
          </View>

          <Text style={styles.title}>It’s a Collab!</Text>
          <Text style={styles.body}>
            You and {them?.firstName ?? 'this creative'} are now connected. Say hi and start making something.
          </Text>

          <Quote quote={QUOTES.maxwell} tone="light" style={{ marginTop: 22 }} />
        </View>

        <View style={styles.buttons}>
          <Button
            title="Send a message"
            onPress={() => (chatId ? router.replace({ pathname: '/chat/[id]', params: { id: chatId } }) : router.back())}
          />
          <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.ghost, pressed && { opacity: 0.7 }]} accessibilityRole="button">
            <Text style={styles.ghostText}>Keep exploring</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

function PersonCard({ person, tilt, accent }: { person: UserProfile | null | undefined; tilt: string; accent: string }) {
  const role = person?.skills?.[0] ? optionFor(person.skills[0]) : null;
  return (
    <View style={[styles.cardWrap, { transform: [{ rotate: tilt }] }]}>
      <View style={styles.card}>
        {person?.photoURL ? (
          <Image source={{ uri: person.photoURL }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
        ) : (
          <LinearGradient colors={[accent, colors.yellow]} style={[StyleSheet.absoluteFill, styles.center]}>
            <Text style={styles.initial}>{person?.firstName?.charAt(0).toUpperCase() ?? ''}</Text>
          </LinearGradient>
        )}
      </View>
      <View style={styles.labels}>
        <View style={styles.badge}>
          <Text style={styles.badgeText} numberOfLines={1}>
            {role ? `${role.emoji} ${role.label}` : person?.firstName ?? ''}
          </Text>
        </View>
        {person?.firstName && role ? <Text style={styles.name}>{person.firstName}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, overflow: 'hidden' },
  safe: { flex: 1, paddingHorizontal: 24, justifyContent: 'space-between' },
  glow: { position: 'absolute', width: 320, height: 320, borderRadius: 160, opacity: 0.22 },
  content: { alignItems: 'center', paddingTop: 36 },
  eyebrow: { fontFamily: fonts.bodySemibold, fontSize: 12, letterSpacing: 2.5, color: colors.yellow, marginBottom: 26 },

  cards: { flexDirection: 'row', alignItems: 'center', marginBottom: 58 },
  cardWrap: {
    width: 128,
    height: 164,
    borderRadius: radius.md,
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  card: { flex: 1, borderRadius: radius.md, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255,255,255,0.85)' },
  center: { alignItems: 'center', justifyContent: 'center' },
  initial: { fontFamily: fonts.heading, fontSize: 52, color: colors.white },
  labels: { position: 'absolute', bottom: -44, left: -10, right: -10, alignItems: 'center', gap: 4 },
  badge: { backgroundColor: colors.white, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full, maxWidth: '100%' },
  badgeText: { fontFamily: fonts.bodySemibold, fontSize: 12, color: colors.text },
  name: { fontFamily: fonts.bodyMedium, fontSize: 13, color: 'rgba(255,255,255,0.85)' },
  connector: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginHorizontal: -12,
    zIndex: 2,
    backgroundColor: colors.yellow,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.yellow,
    shadowOpacity: 0.6,
    shadowRadius: 14,
    elevation: 10,
  },
  connectorIcon: { fontSize: 22 },

  title: { fontFamily: fonts.heading, fontSize: 40, color: colors.white, textAlign: 'center', letterSpacing: -0.5 },
  body: {
    fontFamily: fonts.body,
    fontSize: 17,
    lineHeight: 24,
    color: 'rgba(255,255,255,0.82)',
    textAlign: 'center',
    maxWidth: 320,
    marginTop: 8,
  },
  buttons: { gap: 12, paddingBottom: 12 },
  ghost: {
    height: 56,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostText: { fontFamily: fonts.bodySemibold, fontSize: 17, color: colors.white },
});
