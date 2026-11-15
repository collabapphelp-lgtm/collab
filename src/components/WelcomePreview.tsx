import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from '@/components/ThemedGradient';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { fonts, makeStyles } from '@/lib/theme';

// Example profiles for the welcome screen, so people see what a filled-in Collab looks like
// before they sign up. Photos are bundled (stock), names and details are made up.
const SAMPLES = [
  {
    photo: require('../../assets/welcome/sample-singer.jpg'),
    name: 'Ava',
    role: 'Vocalist · Songwriter',
    sound: 'POP · R&B',
    accent: '#A8325E',
    miles: '3 mi away',
    track: 'Golden hour (demo)',
    platform: 'SoundCloud',
    q: 'What I’m working on right now…',
    a: 'A 4-song pop EP. Need a producer who loves big choruses.',
    looking: ['Producers', 'Guitar'],
  },
  {
    photo: require('../../assets/welcome/sample-producer.jpg'),
    name: 'Leo',
    role: 'Producer · Audio Engineer',
    sound: 'ELECTRONIC · INDIE',
    accent: '#1F5A85',
    miles: '6 mi away',
    track: 'Night drive (beat)',
    platform: 'Spotify',
    q: 'My ideal session…',
    a: 'Late night, one idea, no pressure. We finish a hook before we leave.',
    looking: ['Vocalists', 'Songwriters'],
  },
  {
    photo: require('../../assets/welcome/sample-keys.jpg'),
    name: 'Dre',
    role: 'Producer · Keys',
    sound: 'HIP HOP · R&B',
    accent: '#3B2A6B',
    miles: '2 mi away',
    track: 'Uptown keys vol. 1',
    platform: 'YouTube',
    q: 'What I bring to a collab…',
    a: 'Chords that hit and a studio in Harlem. Bring the words.',
    looking: ['Rappers', 'Videographers'],
  },
] as const;

const HOLD_MS = 3400;

/** Auto-playing stack of example profiles: photo drifts in, card fades to the next. */
export function WelcomePreview({ compact = false }: { compact?: boolean }) {
  const styles = useStyles();
  const [i, setI] = useState(0);
  const [fade] = useState(() => new Animated.Value(1));
  const [zoom] = useState(() => new Animated.Value(0));

  useEffect(() => {
    zoom.setValue(0);
    Animated.timing(zoom, {
      toValue: 1,
      duration: HOLD_MS + 400,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start();
    const t = setTimeout(() => {
      Animated.timing(fade, {
        toValue: 0,
        duration: 260,
        useNativeDriver: true,
      }).start(() => {
        setI((n) => (n + 1) % SAMPLES.length);
        Animated.timing(fade, {
          toValue: 1,
          duration: 320,
          useNativeDriver: true,
        }).start();
      });
    }, HOLD_MS);
    return () => clearTimeout(t);
  }, [i, fade, zoom]);

  const s = SAMPLES[i];
  const scale = zoom.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.08],
  });
  const lift = fade.interpolate({ inputRange: [0, 1], outputRange: [10, 0] });

  return (
    <View style={styles.wrap} accessible accessibilityLabel="Example profiles on Collab">
      <Animated.View style={[styles.card, { opacity: fade, transform: [{ translateY: lift }] }]}>
        <View style={[styles.hero, { backgroundColor: s.accent }, compact && { height: 180 }]}>
          <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ scale }] }]}>
            <Image source={s.photo} style={StyleSheet.absoluteFill} contentFit="cover" />
          </Animated.View>
          <LinearGradient colors={['transparent', s.accent + 'EE', s.accent]} locations={[0, 0.75, 1]} style={styles.shade} />
          <View style={styles.heroText}>
            <Text style={styles.sound}>{s.sound}</Text>
            <Text style={styles.name}>{s.name}</Text>
            <View style={styles.row}>
              <Text style={styles.role}>{s.role}</Text>
              <Text style={styles.miles}>{s.miles}</Text>
            </View>
          </View>
        </View>
        <View style={styles.body}>
          <View style={styles.track}>
            <View style={styles.play}>
              <MaterialCommunityIcons name="play" size={16} color="#17151F" />
            </View>
            <View style={styles.flex}>
              <Text style={styles.trackTitle} numberOfLines={1}>
                {s.track}
              </Text>
              <Text style={styles.trackKind}>{s.platform}</Text>
            </View>
            <View style={styles.wave}>
              {[10, 18, 24, 14, 20, 9, 22, 16, 12, 19].map((h, k) => (
                <View key={k} style={[styles.bar, { height: h, opacity: k < 4 ? 1 : 0.4 }]} />
              ))}
            </View>
          </View>
          {compact ? null : (
            <View style={styles.prompt}>
              <Text style={styles.q}>{s.q}</Text>
              <Text style={styles.a} numberOfLines={2}>
                {s.a}
              </Text>
            </View>
          )}
          <View style={styles.chips}>
            <Text style={styles.lookingLabel}>Looking for</Text>
            {s.looking.map((l) => (
              <View key={l} style={styles.chip}>
                <Text style={styles.chipText}>{l}</Text>
              </View>
            ))}
          </View>
        </View>
      </Animated.View>
      <View style={styles.dots}>
        {SAMPLES.map((_, k) => (
          <View key={k} style={[styles.dot, k === i && styles.dotOn]} />
        ))}
        <Text style={styles.example}>Example profiles</Text>
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  flex: { flex: 1 },
  wrap: { gap: 10 },
  card: {
    borderRadius: 26,
    overflow: 'hidden',
    backgroundColor: '#F7F5F0',
    shadowColor: '#1F2328',
    shadowOpacity: 0.18,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  hero: { height: 230, justifyContent: 'flex-end', overflow: 'hidden' },
  shade: { position: 'absolute', left: 0, right: 0, bottom: 0, top: '35%' },
  heroText: { paddingHorizontal: 16, paddingBottom: 14, gap: 2 },
  sound: {
    fontFamily: fonts.bodySemibold,
    fontSize: 11,
    letterSpacing: 1.8,
    color: '#F2C14E',
  },
  name: {
    fontFamily: fonts.heading,
    fontSize: 32,
    lineHeight: 35,
    letterSpacing: -0.8,
    color: colors.white,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  role: {
    flex: 1,
    fontFamily: fonts.bodySemibold,
    fontSize: 14,
    color: 'rgba(255,255,255,0.92)',
  },
  miles: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.white,
    opacity: 0.85,
  },
  body: { padding: 12, gap: 8 },
  track: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 16,
    backgroundColor: '#17151F',
  },
  play: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F2C14E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackTitle: {
    fontFamily: fonts.bodySemibold,
    fontSize: 14,
    color: colors.white,
  },
  trackKind: { fontFamily: fonts.body, fontSize: 12, color: '#B9B3C9' },
  wave: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  bar: { width: 3, borderRadius: 2, backgroundColor: '#F2C14E' },
  prompt: {
    padding: 12,
    borderRadius: 16,
    backgroundColor: colors.white,
    gap: 3,
  },
  q: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
  a: {
    fontFamily: fonts.heading,
    fontSize: 15,
    lineHeight: 20,
    color: colors.text,
  },
  chips: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  lookingLabel: {
    fontFamily: fonts.bodySemibold,
    fontSize: 12,
    color: colors.textSecondary,
    marginRight: 2,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#E3F0F6',
  },
  chipText: { fontFamily: fonts.bodySemibold, fontSize: 12, color: '#1F5F7F' },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(31,35,40,0.2)',
  },
  dotOn: { width: 18, backgroundColor: colors.blue },
  example: {
    position: 'absolute',
    right: 2,
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.textMuted,
  },
}));
