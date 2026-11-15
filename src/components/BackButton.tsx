import { Pressable, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { radius, makeStyles } from '@/lib/theme';

export function BackButton({ onPress }: { onPress?: () => void }) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Go back"
      hitSlop={12}
      onPress={onPress ?? (() => (router.canGoBack() ? router.back() : router.replace('/welcome')))}
      style={({ pressed }) => [styles.btn, pressed && { opacity: 0.6 }]}
    >
      <Text style={styles.arrow}>←</Text>
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  btn: {
    width: 44,
    height: 44,
    borderRadius: radius.sm + 4,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrow: { fontSize: 22, color: colors.red, marginTop: -2 },
}));
