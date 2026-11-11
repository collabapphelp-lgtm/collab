import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { collection, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { useAuth } from './auth-context';
import { useMatches } from './use-matches';
import { getProfile } from './profiles';
import { loadBlockedIds } from './safety';
import { UI_PREVIEW } from './preview';
import { PREVIEW_PROFILES } from './preview-data';
import type { UserProfile } from './types';

/**
 * "Liked you": people who tapped ♥ on me that I haven't answered yet.
 * users/{me}/likedBy/{them} is written by the server whenever someone likes me
 * (functions/index.js onLikeCreated). Anyone I've already liked (= connected), passed or blocked is left out.
 */
const PREVIEW_LIKERS = PREVIEW_PROFILES.filter((p) => p.likesYou).map((p) => p.id);

type State = { likedYou: UserProfile[] | null; dismiss: (id: string) => void; refresh: () => void };
const LikedYouContext = createContext<State | null>(null);

export function LikedYouProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { matches } = useMatches();
  const [liveIds, setLiveIds] = useState<string[] | null>(null);
  const [profiles, setProfiles] = useState<Map<string, UserProfile>>(new Map());
  const [answered, setAnswered] = useState<Set<string>>(new Set()); // passed, blocked or dismissed
  const [tick, setTick] = useState(0);
  const uid = user?.uid;

  // Live list of who liked me.
  useEffect(() => {
    if (!uid || UI_PREVIEW) return;
    return onSnapshot(
      collection(db, 'users', uid, 'likedBy'),
      (snap) => setLiveIds(snap.docs.map((d) => d.id)),
      () => setLiveIds([]),
    );
  }, [uid]);
  const likerIds = UI_PREVIEW ? PREVIEW_LIKERS : liveIds;

  // Who I've already passed on or blocked (re-checked whenever the list changes or on refresh).
  useEffect(() => {
    if (!uid || !likerIds || UI_PREVIEW) return;
    let live = true;
    Promise.all([getDocs(collection(db, 'users', uid, 'passes')), loadBlockedIds(uid)])
      .then(([passes, blocked]) => {
        if (live) setAnswered((prev) => new Set([...prev, ...passes.docs.map((d) => d.id), ...blocked]));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [uid, likerIds, tick]);

  // Load the profiles we don't have yet.
  useEffect(() => {
    if (!likerIds) return;
    const missing = likerIds.filter((id) => !profiles.has(id)).slice(0, 30);
    if (!missing.length) return;
    let live = true;
    Promise.all(missing.map((id) => getProfile(id).catch(() => null))).then((list) => {
      if (!live) return;
      setProfiles((prev) => {
        const next = new Map(prev);
        list.forEach((p) => p && next.set(p.id, p));
        return next;
      });
    });
    return () => {
      live = false;
    };
  }, [likerIds, profiles]);

  const connectedIds = useMemo(() => new Set((matches ?? []).map((m) => m.other.id)), [matches]);

  const likedYou = useMemo(() => {
    if (!likerIds) return null;
    return likerIds
      .filter((id) => !connectedIds.has(id) && !answered.has(id))
      .map((id) => profiles.get(id))
      .filter((p): p is UserProfile => !!p && p.onboardingComplete !== false);
  }, [likerIds, connectedIds, answered, profiles]);

  const dismiss = useCallback((id: string) => setAnswered((prev) => new Set(prev).add(id)), []);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  return <LikedYouContext.Provider value={{ likedYou, dismiss, refresh }}>{children}</LikedYouContext.Provider>;
}

export function useLikedYou() {
  const ctx = useContext(LikedYouContext);
  if (!ctx) throw new Error('useLikedYou must be used inside <LikedYouProvider>');
  return ctx;
}
