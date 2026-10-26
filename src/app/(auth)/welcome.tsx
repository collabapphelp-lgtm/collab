import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Button } from '@/components/Button';
import { colors, fonts, gradients, radius } from '@/lib/theme';

const PRODUCER_PHOTO = 'https://images.unsplash.com/photo-1531384441138-2736e62e0919?w=400&h=500&fit=crop&crop=face';
const SINGER_PHOTO = 'https://images.unsplash.com/photo-1516575869333-e9d8e43b0e33?w=400&h=500&fit=crop&crop=face';

export default function Welcome() {
  return (
    <LinearGradient colors={gradients.welcome} style={styles.flex}>
      <SafeAreaView style={styles.container}>
        <View style={styles.hero}>
          <View style={styles.cards}>
            <ProfileCard photo={PRODUCER_PHOTO} icon="🎹" role="Producer" genre="Indie" tilt="-6deg" tagColor={colors.blue} />
            <View style={styles.connector}>
              <Text style={styles.connectorIcon}>🤝</Text>
            </View>
            <ProfileCard photo={SINGER_PHOTO} icon="🎤" role="Singer" genre="R&B" tilt="6deg" tagColor={colors.purple} />
          </View>

          <Image source={require('../../../assets/logo.png')} style={styles.logo} contentFit="contain" />
          <Text style={styles.title}>Collab</Text>
          <Text style={styles.tagline}>Join a community of artists looking to collaborate</Text>
        </View>

        <View style={styles.actions}>
          <Button title="Create an account" onPress={() => router.push('/signup')} />
          <Button title="Log in" variant="secondary" onPress={() => router.push('/login')} />
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

function ProfileCard(props: { photo: string; icon: string; role: string; genre: string; tilt: string; tagColor: string }) {
  return (
    <View style={[styles.card, { transform: [{ rotate: props.tilt }] }]}>
      <Image source={{ uri: props.photo }} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} />
      <View style={styles.badge}>
        <Text style={styles.badgeIcon}>{props.icon}</Text>
        <Text style={styles.badgeText}>{props.role}</Text>
      </View>
      <View style={[styles.tag, { backgroundColor: props.tagColor }]}>
        <Text style={styles.tagText}>{props.genre}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, paddingHorizontal: 24, paddingBottom: 16 },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cards: { flexDirection: 'row', alignItems: 'center', marginBottom: 36 },
  card: {
    width: 136,
    height: 176,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.purple,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  connector: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
  connectorIcon: { fontSize: 20 },
  badge: {
    position: 'absolute',
    bottom: 36,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
  },
  badgeIcon: { fontSize: 13 },
  badgeText: { fontFamily: fonts.bodySemibold, fontSize: 12, color: colors.text },
  tag: { position: 'absolute', bottom: 8, alignSelf: 'center', paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.full },
  tagText: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.white },
  logo: { width: 96, height: 56, marginBottom: 4 },
  title: { fontFamily: fonts.heading, fontSize: 40, color: colors.text, letterSpacing: -0.5 },
  tagline: {
    fontFamily: fonts.bodyMedium,
    fontSize: 18,
    lineHeight: 26,
    color: colors.text,
    textAlign: 'center',
    maxWidth: 290,
    marginTop: 8,
  },
  actions: { gap: 12 },
});
