import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts, radius } from '@/lib/theme';

/** The Collab logo's watercolor rainbow, left to right. */
export const LOGO_RAINBOW = ['#E8452C', '#F28C28', '#F5C824', '#8DC63F', '#2F8FE0', '#9B5BD6', '#D94BB3'] as const;

const LOGO = require('../../../assets/logo-mark.png');

/** "Open to anything / all genres" toggle, wearing the logo's rainbow: an outline when off, filled when on. */
export function OpenToAll(props: { label: string; detail?: string; selected: boolean; onPress: () => void }) {
  const { selected } = props;
  return (
    <Pressable
      onPress={props.onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={props.label}
      style={({ pressed }) => pressed && { opacity: 0.85 }}
    >
      <LinearGradient colors={LOGO_RAINBOW} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.border}>
        <View style={[styles.inner, selected && styles.innerOn]}>
          <View style={[styles.logoWrap, selected && styles.logoWrapOn]}>
            <Image source={LOGO} style={styles.logo} contentFit="contain" />
          </View>
          <View style={styles.text}>
            <Text style={[styles.label, selected && styles.labelOn]}>{props.label}</Text>
            {props.detail ? <Text style={[styles.detail, selected && styles.detailOn]}>{props.detail}</Text> : null}
          </View>
          <View style={[styles.check, selected && styles.checkOn]}>{selected ? <Text style={styles.checkMark}>✓</Text> : null}</View>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  border: { borderRadius: radius.md, padding: 2 },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: radius.md - 2,
    backgroundColor: colors.white,
  },
  innerOn: { backgroundColor: 'transparent' },
  logoWrap: { width: 46, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  logoWrapOn: { backgroundColor: colors.white },
  logo: { width: 38, height: 20 },
  text: { flex: 1 },
  label: { fontFamily: fonts.bodySemibold, fontSize: 16, color: colors.text },
  labelOn: { color: colors.white },
  detail: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary, marginTop: 1 },
  detailOn: { color: 'rgba(255,255,255,0.92)' },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  checkOn: { borderColor: colors.white, backgroundColor: colors.white },
  checkMark: { fontFamily: fonts.bodySemibold, fontSize: 14, color: '#9B5BD6' },
});
