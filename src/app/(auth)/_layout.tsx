import { Stack } from 'expo-router';
import { useColors } from '@/lib/theme';

// Where this group starts when the app redirects into it.
export const unstable_settings = { anchor: 'welcome' };

export default function AuthLayout() {
  const colors = useColors();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />;
}
