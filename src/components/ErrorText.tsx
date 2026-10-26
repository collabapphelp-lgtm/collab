import { StyleSheet, Text } from 'react-native';
import { colors, fonts } from '@/lib/theme';

export function ErrorText({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <Text accessibilityLiveRegion="polite" style={styles.text}>
      {message}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: { fontFamily: fonts.body, fontSize: 14, color: colors.red, textAlign: 'center' },
});
