import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp, getApps, getApp } from 'firebase/app';
import * as FirebaseAuth from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Same Firebase project as the web prototype, so existing test accounts keep working.
// These values are safe to ship in the app; access is controlled by Firebase security rules.
const firebaseConfig = {
  apiKey: 'AIzaSyBCMbF8VSSauQfjHF1_DfvWDuDWTuvK0rc',
  authDomain: 'collab-609ac.firebaseapp.com',
  projectId: 'collab-609ac',
  storageBucket: 'collab-609ac.firebasestorage.app',
  messagingSenderId: '991980593637',
  appId: '1:991980593637:web:4931917caba588c69ecf0c',
};

const isFirstInit = getApps().length === 0;
export const app = isFirstInit ? initializeApp(firebaseConfig) : getApp();

// On the phone, keep people signed in between app launches by storing the session in AsyncStorage.
// getReactNativePersistence only exists in Firebase's React Native build, which Metro picks on iOS/Android.
function createAuth() {
  if (!isFirstInit) return FirebaseAuth.getAuth(app);
  if (Platform.OS === 'web') {
    return FirebaseAuth.initializeAuth(app, { persistence: FirebaseAuth.browserLocalPersistence });
  }
  const getRNPersistence = (FirebaseAuth as unknown as {
    getReactNativePersistence: (storage: typeof AsyncStorage) => FirebaseAuth.Persistence;
  }).getReactNativePersistence;
  return FirebaseAuth.initializeAuth(app, { persistence: getRNPersistence(AsyncStorage) });
}

export const auth = createAuth();
export const db = getFirestore(app);
export const storage = getStorage(app);
