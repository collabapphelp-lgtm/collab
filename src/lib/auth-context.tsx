import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from './firebase';
import type { UserProfile } from './types';

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
