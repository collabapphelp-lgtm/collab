import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Button } from '@/components/Button';
import { WelcomePreview } from '@/components/WelcomePreview';
import { colors, fonts, gradients } from '@/lib/theme';

export default function Welcome() {
  // Small phones (SE): a shorter preview so the buttons stay on screen.
  const { height } = useWindowDimensions();
  return (
    <LinearGradient colors={gradients.welcome} style={styles.flex}>
      <SafeAreaView style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} bounces={false}>
          <View style={styles.brandRow}>
            <Image source={require('../../../assets/logo.png')} style={styles.logo} contentFit="contain" />
            <Text style={styles.brand}>Collab</Text>
          </View>

          <View style={styles.preview}>
            <WelcomePreview compact={height < 760} />
          </View>

          <Text style={styles.headline}>Find your next collab.</Text>
          <Text style={styles.subhead}>Every kind of artist. Show your work, see who fits your vibe, and connect when it’s mutual.</Text>

          <View style={styles.actions}>
            <Button title="Create an account" onPress={() => router.push('/signup')} />
            <Button title="Log in" variant="secondary" onPress={() => router.push('/login')} />
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 8, paddingBottom: 16 },
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  logo: { width: 40, height: 24 },
  brand: { fontFamily: fonts.heading, fontSize: 22, color: colors.text },

  preview: { marginTop: 16, marginBottom: 22 },

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

  actions: { gap: 12, marginTop: 'auto', paddingTop: 22 },
});
