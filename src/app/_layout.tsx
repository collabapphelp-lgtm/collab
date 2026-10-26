import { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useFonts, Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold } from '@expo-google-fonts/outfit';
import { SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { AuthProvider, useAuth } from '@/lib/auth-context';

SplashScreen.preventAutoHideAsync().catch(() => {});

// When a guard below turns off (sign in, sign out, onboarding done), the app falls back to
// the index screen, which sends the person to the right section.
export const unstable_settings = { initialRouteName: 'index' };

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold, SpaceGrotesk_700Bold });

  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <RootNavigator fontsLoaded={fontsLoaded} />
    </AuthProvider>
  );
}

function RootNavigator({ fontsLoaded }: { fontsLoaded: boolean }) {
  const { initializing, user, profile, signupInProgress } = useAuth();
  const ready = fontsLoaded && !initializing;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  // Keep the native splash screen up until we know where to send the person.
  if (!ready) return null;

  const signedOut = !user || signupInProgress;
  const needsOnboarding = !signedOut && !profile?.onboardingComplete;
  const inApp = !signedOut && !!profile?.onboardingComplete;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#fff' } }}>
      <Stack.Screen name="index" />
      <Stack.Protected guard={signedOut}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={needsOnboarding}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={inApp}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
    </Stack>
  );
}
