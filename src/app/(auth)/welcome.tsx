import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Button } from '@/components/Button';
import { colors, fonts, gradients, radius } from '@/lib/theme';

// Built into the app (not loaded from the internet) so they always show instantly.
const PRODUCER_PHOTO = require('../../../assets/welcome/producer.jpg');
const SINGER_PHOTO = require('../../../assets/welcome/singer.jpg');

// The three reasons to sign up. Keep each to one short line so the page stays scannable.
const BENEFITS = [
  { icon: '🎯', title: 'Find the right people', body: 'Producers, vocalists, instrumentalists, videographers and more, near you or worldwide' },
  { icon: '💡', title: 'Share your ideas', body: "Post snippets of your work and what you're looking for in a collab" },
  { icon: '💬', title: 'Match and create', body: "Browse other creatives, match when it's mutual, then start working together" },
];

export default function Welcome() {
  return (
    <LinearGradient colors={gradients.welcome} style={styles.flex}>
      <SafeAreaView style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} bounces={false}>
          <View style={styles.brandRow}>
            <Image source={require('../../../assets/logo.png')} style={styles.logo} contentFit="contain" />
            <Text style={styles.brand}>Collab</Text>
          </View>

          <View style={styles.cards}>
            <ProfileCard photo={PRODUCER_PHOTO} icon="🎹" role="Producer" genre="Indie" tilt="-6deg" accent={colors.blue} />
            <View style={styles.connector}>
              <Text style={styles.connectorIcon}>🤝</Text>
            </View>
            <ProfileCard photo={SINGER_PHOTO} icon="🎤" role="Singer" genre="R&B" tilt="6deg" accent={colors.purple} />
          </View>

          <Text style={styles.headline}>Find your next creative collab partner</Text>
          <Text style={styles.subhead}>
            Collab helps you find collaboration partners for a variety of creatives.
          </Text>

          <View style={styles.benefits}>
            {BENEFITS.map((b) => (
              <View key={b.title} style={styles.benefit}>
                <View style={styles.benefitIcon}>
                  <Text style={styles.benefitEmoji}>{b.icon}</Text>
                </View>
                <View style={styles.benefitText}>
                  <Text style={styles.benefitTitle}>{b.title}</Text>
                  <Text style={styles.benefitBody}>{b.body}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.actions}>
            <Button title="Create an account" onPress={() => router.push('/signup')} />
            <Button title="Log in" variant="secondary" onPress={() => router.push('/login')} />
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

function ProfileCard(props: { photo: number; icon: string; role: string; genre: string; tilt: string; accent: string }) {
  return (
    <View style={[styles.card, { backgroundColor: props.accent, transform: [{ rotate: props.tilt }] }]}>
      <Image source={props.photo} style={StyleSheet.absoluteFill} contentFit="cover" />
      {/* One slim label at the bottom edge so it doesn't hide what the person is doing. */}
      <View style={styles.badge}>
        <Text style={styles.badgeIcon}>{props.icon}</Text>
        <Text style={styles.badgeText} maxFontSizeMultiplier={1.1}>{props.role}</Text>
        <View style={[styles.dot, { backgroundColor: props.accent }]} />
        <Text style={[styles.genreText, { color: props.accent }]} maxFontSizeMultiplier={1.1}>
          {props.genre}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 8, paddingBottom: 16 },
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  logo: { width: 40, height: 24 },
  brand: { fontFamily: fonts.heading, fontSize: 22, color: colors.text },

  cards: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 20, marginBottom: 24 },
  card: {
    width: 124,
    height: 158,
    borderRadius: radius.md,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  connector: {
    width: 42,
    height: 42,
    borderRadius: 21,
    marginHorizontal: -10,
    zIndex: 2,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 8,
  },
  connectorIcon: { fontSize: 19 },
  badge: {
    position: 'absolute',
    bottom: 6,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  badgeIcon: { fontSize: 12 },
  badgeText: { fontFamily: fonts.bodySemibold, fontSize: 12, color: colors.text },
  dot: { width: 4, height: 4, borderRadius: 2, marginHorizontal: 1 },
  genreText: { fontFamily: fonts.bodySemibold, fontSize: 11 },

  headline: {
    fontFamily: fonts.heading,
    fontSize: 30,
    lineHeight: 35,
    color: colors.text,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subhead: {
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 23,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    marginHorizontal: 8,
  },

  benefits: {
    marginTop: 20,
    marginBottom: 24,
    gap: 14,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: radius.md,
    padding: 16,
  },
  benefit: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  benefitIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitEmoji: { fontSize: 19 },
  benefitText: { flex: 1 },
  benefitTitle: { fontFamily: fonts.bodySemibold, fontSize: 15, color: colors.text },
  benefitBody: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.textSecondary, marginTop: 1 },

  actions: { gap: 12, marginTop: 'auto' },
});
