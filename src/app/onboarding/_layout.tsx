import { Stack } from 'expo-router';

// Where this group starts when the app redirects into it.
export const unstable_settings = { initialRouteName: 'index' };

export default function OnboardingLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#fff' } }} />;
}
