import { useEffect } from 'react';
import { Platform } from 'react-native';
import { type Href, router, Stack } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useAuth } from '@/lib/auth-context';
import { registerForPush } from '@/lib/push';
import { UI_PREVIEW } from '@/lib/preview';
import { MatchesProvider } from '@/lib/use-matches';
import { LikedYouProvider } from '@/lib/liked-you';
import { EventsProvider } from '@/lib/use-events';
import { useColors } from '@/lib/theme';

export const unstable_settings = { anchor: '(tabs)' };

type PushData = {
  type?: 'match' | 'message' | 'like' | 'report' | 'signup' | 'nudge' | 'event' | 'group';
  matchId?: string;
  groupId?: string;
  url?: string;
};

function openFromNotification(data: PushData | undefined) {
  if (data?.type === 'like') return router.push('/messages');
  if (data?.type === 'event') return router.push('/events');
  if (data?.type === 'nudge' && data.url?.startsWith('/edit')) return router.push(data.url as Href);
  const chatId = data?.groupId ?? data?.matchId;
  if (!chatId) return;
  router.push(`/chat/${chatId}`);
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
  const colors = useColors();
  usePushNotifications();
  return (
    <MatchesProvider>
      <LikedYouProvider>
      <EventsProvider>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="user/[id]" options={{ presentation: 'card' }} />
        <Stack.Screen name="chat/[id]" options={{ presentation: 'card' }} />
        <Stack.Screen name="group/new" options={{ presentation: 'modal' }} />
        <Stack.Screen name="match" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
        <Stack.Screen name="delete-account" options={{ presentation: 'modal' }} />
        <Stack.Screen name="edit" options={{ presentation: 'modal' }} />
        <Stack.Screen name="event/[key]" options={{ presentation: 'card' }} />
        <Stack.Screen name="event/new" options={{ presentation: 'modal' }} />
      </Stack>
      </EventsProvider>
      </LikedYouProvider>
    </MatchesProvider>
  );
}
