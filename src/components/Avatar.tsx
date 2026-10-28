import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts } from '@/lib/theme';

const GRADIENTS: [string, string][] = [
  [colors.blue, colors.purple],
  [colors.purple, colors.red],
  [colors.orange, colors.yellow],
  [colors.teal, colors.blue],
];

/** Pick a stable gradient per person so their placeholder looks the same everywhere. */
function gradientFor(seed: string) {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return GRADIENTS[h % GRADIENTS.length];
}

type Props = { uri?: string | null; name: string; seed: string; size?: number; radius?: number; style?: StyleProp<ViewStyle> };

/** Profile photo, or a colored placeholder with their initial if they didn't add one. */
export function Avatar({ uri, name, seed, size = 56, radius, style }: Props) {
  const r = radius ?? size / 2;
  if (uri) {
    return (
      <View style={[{ width: size, height: size, borderRadius: r, overflow: 'hidden' }, style]}>
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
      </View>
    );
  }
  return (
    <LinearGradient colors={gradientFor(seed)} style={[{ width: size, height: size, borderRadius: r }, styles.center, style]}>
      <Text style={[styles.initial, { fontSize: size * 0.42 }]}>{name.trim().charAt(0).toUpperCase() || '?'}</Text>
    </LinearGradient>
  );
}

/** Full-bleed version for profile heroes. */
export function HeroPhoto({ uri, name, seed }: { uri?: string | null; name: string; seed: string }) {
  if (uri) return <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />;
  return (
    <LinearGradient colors={gradientFor(seed)} style={[StyleSheet.absoluteFill, styles.center]}>
      <View style={styles.heroCircle}>
        <Text style={styles.heroInitial}>{name.trim().charAt(0).toUpperCase() || '?'}</Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  initial: { fontFamily: fonts.heading, color: colors.white },
  heroCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 60,
  },
  heroInitial: { fontFamily: fonts.heading, fontSize: 56, color: colors.white },
});
