import { Stack } from 'expo-router';
import { OnboardingProvider } from '@/lib/onboarding-context';

export const unstable_settings = { initialRouteName: 'index' };

// Edit profile reuses the onboarding step screens in "edit" mode: Save returns here.
export default function EditLayout() {
  return (
    <OnboardingProvider mode="edit">
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#fff' } }} />
    </OnboardingProvider>
  );
}
