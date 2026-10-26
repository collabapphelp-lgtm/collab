import { Stack } from 'expo-router';

export const unstable_settings = { initialRouteName: 'discover' };

// Becomes the tab bar (Discover / Matches / Messages / Profile) in Phase 3.
export default function AppLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#fff' } }} />;
}
