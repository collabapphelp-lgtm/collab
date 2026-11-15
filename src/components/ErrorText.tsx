import { StyleSheet, Text } from 'react-native';
import { fonts, makeStyles } from '@/lib/theme';

export function ErrorText({ message }: { message: string | null }) {
  const styles = useStyles();
  if (!message) return null;
  return (
    <Text accessibilityLiveRegion="polite" style={styles.text}>
      {message}
    </Text>
  );
}

const useStyles = makeStyles((colors) => ({
  text: { fontFamily: fonts.body, fontSize: 14, color: colors.red, textAlign: 'center' },
}));
