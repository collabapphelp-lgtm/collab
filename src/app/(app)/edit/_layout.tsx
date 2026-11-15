import { Stack } from 'expo-router';
import { useColors } from '@/lib/theme';
import { OnboardingProvider } from '@/lib/onboarding-context';

export const unstable_settings = { anchor: 'index' };

// Edit profile reuses the onboarding step screens in "edit" mode: Save returns here.
export default function EditLayout() {
  const colors = useColors();
  return (
    <OnboardingProvider mode="edit">
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
    </OnboardingProvider>
  );
}
