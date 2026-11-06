import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts, radius } from '@/lib/theme';

/** The Collab logo's watercolor rainbow, left to right. */
export const LOGO_RAINBOW = ['#E8452C', '#F28C28', '#F5C824', '#8DC63F', '#2F8FE0', '#9B5BD6', '#D94BB3'] as const;

const LOGO = require('../../../assets/logo-mark.png');

/**
 * "Open to anything / all genres" toggle. Soft lavender like the rest of the app,
 * with a touch of the logo: the rainbow mark, and a thin rainbow outline once selected.
 */
export function OpenToAll(props: { label: string; selected: boolean; onPress: () => void }) {
  const { selected } = props;
  const content = (
    <View style={[styles.inner, selected && styles.innerOn]}>
      <Image source={LOGO} style={styles.logo} contentFit="contain" />
      <Text style={styles.label}>{props.label}</Text>
      {selected ? <Text style={styles.check}>✓</Text> : null}
    </View>
  );
  return (
    <Pressable
      onPress={props.onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={props.label}
      style={({ pressed }) => pressed && { opacity: 0.85 }}
    >
      {selected ? (
        <LinearGradient colors={LOGO_RAINBOW} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.border}>
          {content}
        </LinearGradient>
      ) : (
        <View style={[styles.border, styles.borderOff]}>{content}</View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  border: { borderRadius: radius.md, padding: 2 },
  borderOff: { backgroundColor: 'rgba(163,153,199,0.14)' },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    borderRadius: radius.md - 2,
  },
  innerOn: { backgroundColor: '#F8F6FC' },
  logo: { width: 34, height: 18 },
  label: { fontFamily: fonts.bodySemibold, fontSize: 16, color: colors.text },
  check: { fontFamily: fonts.bodySemibold, fontSize: 16, color: '#9B5BD6' },
});
