import { Stack } from 'expo-router';
import { MatchesProvider } from '@/lib/use-matches';

export const unstable_settings = { anchor: '(tabs)' };

export default function AppLayout() {
  return (
    <MatchesProvider>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#fff' } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="user/[id]" options={{ presentation: 'card' }} />
        <Stack.Screen name="chat/[id]" options={{ presentation: 'card' }} />
        <Stack.Screen name="match" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
        <Stack.Screen name="delete-account" options={{ presentation: 'modal' }} />
        <Stack.Screen name="edit" options={{ presentation: 'modal' }} />
      </Stack>
    </MatchesProvider>
  );
}
