import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from './firebase';
import type { UserProfile } from './types';
import { UI_PREVIEW, UI_PREVIEW_STAGE } from './preview';

type AuthState = {
  /** True until Firebase has told us whether someone is signed in. */
  initializing: boolean;
  user: User | null;
  profile: UserProfile | null;
  signOutUser: () => Promise<void>;
  /**
   * Signup creates the account first and the profile a moment later. While that
   * is happening we keep the person on the signup screen so errors stay visible.
   */
  signupInProgress: boolean;
  setSignupInProgress: (v: boolean) => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  if (UI_PREVIEW) return <PreviewAuthProvider>{children}</PreviewAuthProvider>;
  return <FirebaseAuthProvider>{children}</FirebaseAuthProvider>;
}

function PreviewAuthProvider({ children }: { children: ReactNode }) {
  const [profile] = useState<UserProfile>(() =>
    UI_PREVIEW_STAGE === 'app'
      ? {
          id: 'preview',
          firstName: 'Kam',
          email: 'preview@collab.app',
          onboardingComplete: true,
          location: 'Atlanta, Georgia, USA',
          geo: { lat: 33.749, lng: -84.388 },
          maxDistance: 50,
          global: true,
          creatorType: 'musician',
          skills: ['producer', 'instrumentalist'],
          instruments: ['piano'],
          lookingFor: ['vocalist', 'content'],
          lookingForDetails: { content: ['videographer'] },
          genres: ['rnb', 'hiphop'],
          showcase: [
            { type: 'media', source: 'link', url: 'https://soundcloud.com/demo', platform: 'soundcloud', title: 'Beat tape vol. 2' },
            { type: 'prompt', question: 'My creative process looks like...', answer: 'Chords first, drums second, then I hand it to someone who can sing.' },
          ],
          bio: 'Atlanta producer. Ableton + Push. Always down to cook.',
        }
      : { id: 'preview', firstName: 'Kam', email: 'preview@collab.app', onboardingComplete: false },
  );
  const value: AuthState = {
    initializing: false,
    user: UI_PREVIEW_STAGE === 'auth' ? null : ({ uid: 'preview', email: profile.email } as User),
    profile: UI_PREVIEW_STAGE === 'auth' ? null : profile,
    signOutUser: async () => {},
    signupInProgress: false,
    setSignupInProgress: () => {},
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function FirebaseAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profileReady, setProfileReady] = useState(false);
  const [signupInProgress, setSignupInProgress] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
      if (!u) {
        setProfile(null);
        setProfileReady(true);
      } else {
        setProfileReady(false);
      }
    });
  }, []);

  // Live-subscribe to the signed-in user's profile so routing reacts as soon as
  // signup creates it or onboarding marks it complete.
  useEffect(() => {
    if (!user) return;
    return onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => {
        setProfile(snap.exists() ? ({ id: snap.id, ...snap.data() } as UserProfile) : null);
        setProfileReady(true);
      },
      (err) => {
        console.warn('Profile listener error', err);
        setProfileReady(true);
      },
    );
  }, [user]);

  const value: AuthState = {
    initializing: !authReady || !profileReady,
    user,
    profile,
    signOutUser: () => signOut(auth),
    signupInProgress,
    setSignupInProgress,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
