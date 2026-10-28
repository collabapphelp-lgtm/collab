import { Stack } from 'expo-router';
import { OnboardingProvider } from '@/lib/onboarding-context';

// Where this group starts when the app redirects into it.
export const unstable_settings = { initialRouteName: 'index' };

export default function OnboardingLayout() {
  return (
    <OnboardingProvider>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#fff' } }} />
    </OnboardingProvider>
  );
}
