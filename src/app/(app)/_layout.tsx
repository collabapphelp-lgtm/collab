import { useEffect } from 'react';
import { Platform } from 'react-native';
import { router, Stack } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useAuth } from '@/lib/auth-context';
import { registerForPush } from '@/lib/push';
import { UI_PREVIEW } from '@/lib/preview';
import { MatchesProvider } from '@/lib/use-matches';

export const unstable_settings = { anchor: '(tabs)' };

type PushData = { type?: 'match' | 'message'; matchId?: string };

function openFromNotification(data: PushData | undefined) {
  if (!data?.matchId) return;
  router.push(`/chat/${data.matchId}`);
}

/** Registers this phone for notifications and opens the right chat when one is tapped. */
function usePushNotifications() {
  const { user } = useAuth();
  const uid = user?.uid;

  useEffect(() => {
    if (uid) void registerForPush(uid);
  }, [uid]);

  useEffect(() => {
    if (UI_PREVIEW || Platform.OS === 'web') return;
    // App was closed and opened by tapping a notification.
    const last = Notifications.getLastNotificationResponse();
    if (last) openFromNotification(last.notification.request.content.data as PushData);
    // App was open or in the background.
    const sub = Notifications.addNotificationResponseReceivedListener((r) =>
      openFromNotification(r.notification.request.content.data as PushData),
    );
    return () => sub.remove();
  }, []);
}

export default function AppLayout() {
  usePushNotifications();
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
