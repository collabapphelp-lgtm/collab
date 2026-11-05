import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { arrayRemove, arrayUnion, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { UI_PREVIEW } from './preview';

/**
 * Push notifications.
 *
 * The phone's Expo push token is saved to pushTokens/{uid} (private to the owner).
 * Cloud Functions (functions/index.js) read it to send "new match" and "new message" alerts.
 */

// Which chat is open right now, so a message from that person doesn't also pop a banner.
let openChatId: string | null = null;
export function setOpenChat(id: string | null) {
  openChatId = id;
}

if (!UI_PREVIEW && Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async (n) => {
      const data = n.request.content.data as { matchId?: string; type?: string } | undefined;
      const inThatChat = data?.type === 'message' && !!data.matchId && data.matchId === openChatId;
      return { shouldShowBanner: !inThatChat, shouldShowList: !inThatChat, shouldPlaySound: !inThatChat, shouldSetBadge: false };
    },
  });
}

let currentToken: string | null = null;

/** Asks permission (once; iOS remembers the answer) and saves this phone's token. Safe to call on every launch. */
export async function registerForPush(uid: string) {
  if (UI_PREVIEW || Platform.OS === 'web' || !Device.isDevice) return;
  try {
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    currentToken = token;
    await setDoc(doc(db, 'pushTokens', uid), { tokens: arrayUnion(token) }, { merge: true });
  } catch (e) {
    // Expo Go and simulators can't get a token; the app works fine without notifications.
    console.warn('Push registration skipped:', e);
  }
}

/** Stop sending this phone notifications for this account (called before logging out). */
export async function unregisterPush(uid: string) {
  if (!currentToken || UI_PREVIEW) return;
  try {
    await setDoc(doc(db, 'pushTokens', uid), { tokens: arrayRemove(currentToken) }, { merge: true });
  } catch {
    // Not fatal: the server also drops tokens Apple reports as dead.
  }
  currentToken = null;
}

/** Remove every saved token (account deletion). */
export async function deletePushTokens(uid: string) {
  if (UI_PREVIEW) return;
  await deleteDoc(doc(db, 'pushTokens', uid)).catch(() => {});
}
