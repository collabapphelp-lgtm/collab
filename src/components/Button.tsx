import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts, gradients, radius } from '@/lib/theme';

type Props = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
};

export function Button({ title, onPress, variant = 'primary', loading, disabled, style }: Props) {
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' && styles.primaryShadow,
        { opacity: inactive ? 0.6 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
        style,
      ]}
    >
      {variant === 'primary' ? (
        <LinearGradient colors={gradients.primaryButton} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fill}>
          <Label title={title} loading={loading} />
        </LinearGradient>
      ) : variant === 'danger' ? (
        <View style={[styles.fill, styles.danger]}>
          <Label title={title} loading={loading} light />
        </View>
      ) : (
        <View style={[styles.fill, styles.secondary]}>
          <Label title={title} loading={loading} />
        </View>
      )}
    </Pressable>
  );
}

function Label({ title, loading, light }: { title: string; loading?: boolean; light?: boolean }) {
  return loading ? (
    <ActivityIndicator color={light ? colors.white : colors.text} />
  ) : (
    <Text style={[styles.label, light && { color: colors.white }]}>{title}</Text>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.md, width: '100%' },
  fill: { height: 56, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  secondary: { backgroundColor: colors.white, borderWidth: 2, borderColor: colors.border },
  danger: { backgroundColor: colors.red },
  primaryShadow: {
    shadowColor: colors.yellow,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  label: { fontFamily: fonts.bodySemibold, fontSize: 17, color: colors.text },
});
