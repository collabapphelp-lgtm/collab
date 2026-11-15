import { useEffect } from 'react';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useFonts, Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold } from '@expo-google-fonts/outfit';
import { SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { AppState } from 'react-native';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { trackActiveDay } from '@/lib/activity';
import { useColors, useScheme } from '@/lib/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

// When a guard below turns off (sign in, sign out, onboarding done), the app falls back to
// the index screen, which sends the person to the right section.
export const unstable_settings = { anchor: 'index' };

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold, SpaceGrotesk_700Bold });

  // Follows the phone's Light/Dark setting (app.json userInterfaceStyle: automatic).
  const scheme = useScheme();
  const colors = useColors();
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: { ...base.colors, primary: colors.blue, background: colors.bg, card: colors.bg, text: colors.text, border: colors.border },
  };

  return (
    <ThemeProvider value={navTheme}>
      <AuthProvider>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        <RootNavigator fontsLoaded={fontsLoaded} />
      </AuthProvider>
    </ThemeProvider>
  );
}

function RootNavigator({ fontsLoaded }: { fontsLoaded: boolean }) {
  const { initializing, user, profile, signupInProgress, deletingAccount } = useAuth();

  // Count a day of use whenever the app is opened or brought back (for the tester dashboard).
  const uid = user?.uid;
  useEffect(() => {
    trackActiveDay(uid);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && trackActiveDay(uid));
    return () => sub.remove();
  }, [uid]);
  const ready = fontsLoaded && !initializing;
  const colors = useColors();

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  // Keep the native splash screen up until we know where to send the person.
  if (!ready) return null;

  // During account deletion the profile disappears before the login does; stay put until it's all gone.
  const signedOut = !deletingAccount && (!user || signupInProgress);
  const needsOnboarding = !deletingAccount && !signedOut && !profile?.onboardingComplete;
  const inApp = deletingAccount || (!signedOut && !!profile?.onboardingComplete);

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
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
