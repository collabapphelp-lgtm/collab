// Sign in with Apple / Google, on top of the Firebase JS SDK.
// Apple: native sheet (expo-apple-authentication) → Firebase credential with a nonce.
// Google: native sheet (@react-native-google-signin) → Firebase credential from the ID token.
// Neither needs a password; deleting such an account confirms with the same provider instead.
import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import {
  GoogleAuthProvider,
  OAuthProvider,
  reauthenticateWithCredential,
  revokeAccessToken,
  signInWithCredential,
  type AuthCredential,
  type User,
} from 'firebase/auth';
import { auth } from './firebase';

/**
 * Google OAuth client IDs (public, not secrets). Web: Firebase console → Authentication → Google →
 * Web SDK configuration. iOS: Google Cloud console → Credentials → "iOS client". The Google button
 * stays hidden until both are filled in (and the plugin in app.json has the matching iosUrlScheme).
 */
export const GOOGLE_WEB_CLIENT_ID = '';
export const GOOGLE_IOS_CLIENT_ID = '';
export const googleReady = !!GOOGLE_WEB_CLIENT_ID && !!GOOGLE_IOS_CLIENT_ID && Platform.OS === 'ios';

export type SocialSignIn = { user: User; firstName: string; lastName: string; photoURL: string | null };

/** Thrown when the person closes the Apple/Google sheet: not an error to show. */
export class Cancelled extends Error {}

// ---------- Apple ----------

export function appleAvailable() {
  return Platform.OS === 'ios' ? AppleAuthentication.isAvailableAsync().catch(() => false) : Promise.resolve(false);
}

async function appleCredential() {
  const rawNonce = `${Crypto.randomUUID()}${Crypto.randomUUID()}`;
  const nonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
  let r: AppleAuthentication.AppleAuthenticationCredential;
  try {
    r = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
      nonce,
    });
  } catch (e) {
    if ((e as { code?: string })?.code === 'ERR_REQUEST_CANCELED') throw new Cancelled();
    throw e;
  }
  if (!r.identityToken) throw new Error('Apple did not return a sign-in token.');
  const credential = new OAuthProvider('apple.com').credential({ idToken: r.identityToken, rawNonce });
  return { credential, r };
}

export async function signInWithApple(): Promise<SocialSignIn> {
  const { credential, r } = await appleCredential();
  const { user } = await signInWithCredential(auth, credential);
  // Apple only shares the name the very first time someone signs in to the app.
  return { user, firstName: r.fullName?.givenName ?? '', lastName: r.fullName?.familyName ?? '', photoURL: null };
}

// ---------- Google ----------

// Loaded lazily so builds without the native module (and the web preview) never touch it.
function googleModule() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@react-native-google-signin/google-signin') as typeof import('@react-native-google-signin/google-signin');
}
let googleConfigured = false;
function google() {
  const m = googleModule();
  if (!googleConfigured) {
    m.GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID, iosClientId: GOOGLE_IOS_CLIENT_ID });
    googleConfigured = true;
  }
  return m;
}

async function googleCredential() {
  const { GoogleSignin, isSuccessResponse } = google();
  const res = await GoogleSignin.signIn();
  if (!isSuccessResponse(res)) throw new Cancelled();
  if (!res.data.idToken) throw new Error('Google did not return a sign-in token.');
  return { credential: GoogleAuthProvider.credential(res.data.idToken), data: res.data };
}

export async function signInWithGoogle(): Promise<SocialSignIn> {
  const { credential, data } = await googleCredential();
  const { user } = await signInWithCredential(auth, credential);
  return { user, firstName: data.user.givenName ?? '', lastName: data.user.familyName ?? '', photoURL: data.user.photo ?? null };
}

// ---------- Account deletion ----------

/** Which way this account signs in, for the delete-account screen. */
export function signInMethod(user: User | null): 'password' | 'apple' | 'google' | null {
  const ids = (user?.providerData ?? []).map((p) => p.providerId);
  if (ids.includes('password')) return 'password';
  if (ids.includes('apple.com')) return 'apple';
  if (ids.includes('google.com')) return 'google';
  return null;
}

/**
 * Confirms it's really them (Firebase needs a fresh sign-in to delete an account). For Apple, also
 * revokes Collab's access to their Apple ID, which Apple requires when an account is deleted.
 */
export async function reauthWithProvider(user: User, method: 'apple' | 'google') {
  let credential: AuthCredential;
  if (method === 'apple') {
    const { credential: c, r } = await appleCredential();
    credential = c;
    await reauthenticateWithCredential(user, credential);
    if (r.authorizationCode) await revokeAccessToken(auth, r.authorizationCode).catch((e) => console.warn('Apple revoke failed', e));
  } else {
    credential = (await googleCredential()).credential;
    await reauthenticateWithCredential(user, credential);
  }
}

/** Also forget the Google session on the phone when they sign out. */
export async function signOutOfGoogle() {
  if (!googleReady) return;
  await google().GoogleSignin.signOut().catch(() => {});
}
