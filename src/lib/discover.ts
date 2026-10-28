import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { db } from './firebase';
import { UI_PREVIEW } from './preview';
import { PREVIEW_PROFILES } from './preview-data';
import type { UserProfile } from './types';

/**
 * Firestore layout:
 *   users/{uid}                     profile
 *   users/{uid}/likes/{otherUid}    I liked them
 *   users/{uid}/passes/{otherUid}   I passed on them
 *   matches/{uidA_uidB}             created when both liked each other; members: [uidA, uidB]
 * A top-level `matches` doc (instead of copies under each user) is what Phase 4 chat hangs off.
 */

type FirestoreTime = { toMillis?: () => number };
export type Match = { id: string; members: string[]; createdAt?: FirestoreTime; other: UserProfile };

export const pairId = (a: string, b: string) => [a, b].sort().join('_');

/** Everyone who finished onboarding, minus me and anyone I've already liked or passed. */
export async function loadUnseenProfiles(me: string): Promise<UserProfile[]> {
  if (UI_PREVIEW) return PREVIEW_PROFILES.filter((p) => !previewSeen.has(p.id));

  const [usersSnap, likesSnap, passesSnap] = await Promise.all([
    // Fine for early testing; Phase 5+ will need paging / server-side filtering as users grow.
    getDocs(query(collection(db, 'users'), where('onboardingComplete', '==', true), limit(500))),
    getDocs(collection(db, 'users', me, 'likes')),
    getDocs(collection(db, 'users', me, 'passes')),
  ]);
  const seen = new Set([...likesSnap.docs.map((d) => d.id), ...passesSnap.docs.map((d) => d.id), me]);
  return usersSnap.docs.filter((d) => !seen.has(d.id)).map((d) => ({ id: d.id, ...d.data() }) as UserProfile);
}

export async function passOn(me: string, them: string) {
  if (UI_PREVIEW) return void previewSeen.add(them);
  await setDoc(doc(db, 'users', me, 'passes', them), { createdAt: serverTimestamp() });
}

/** Records a like. Returns true if they'd already liked me, in which case a match is created. */
export async function like(me: UserProfile, them: UserProfile): Promise<boolean> {
  if (UI_PREVIEW) {
    previewSeen.add(them.id);
    const matched = !!(them as UserProfile & { likesYou?: boolean }).likesYou;
    if (matched) previewMatches.unshift({ id: pairId(me.id, them.id), members: [me.id, them.id], other: them });
    previewListeners.forEach((l) => l([...previewMatches]));
    return matched;
  }

  await setDoc(doc(db, 'users', me.id, 'likes', them.id), { createdAt: serverTimestamp() });
  const theirLike = await getDoc(doc(db, 'users', them.id, 'likes', me.id));
  if (!theirLike.exists()) return false;

  // Deterministic id: if both people like each other at the same moment, they write the same doc.
  await setDoc(
    doc(db, 'matches', pairId(me.id, them.id)),
    { members: [me.id, them.id].sort(), createdAt: serverTimestamp() },
    { merge: true },
  );
  return true;
}

export async function getProfile(uid: string): Promise<UserProfile | null> {
  if (UI_PREVIEW) return PREVIEW_PROFILES.find((p) => p.id === uid) ?? null;
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as UserProfile) : null;
}

/** Live list of my matches, newest first, each with the other person's profile. */
export function listenToMatches(me: string, onChange: (matches: Match[]) => void, onError?: (e: Error) => void) {
  if (UI_PREVIEW) {
    previewListeners.add(onChange);
    onChange([...previewMatches]);
    return () => void previewListeners.delete(onChange);
  }

  const cache = new Map<string, UserProfile>();
  return onSnapshot(
    query(collection(db, 'matches'), where('members', 'array-contains', me)),
    async (snap) => {
      const rows = await Promise.all(
        snap.docs.map(async (d): Promise<Match | null> => {
          const data = d.data() as { members: string[]; createdAt?: FirestoreTime };
          const otherId = data.members.find((m) => m !== me);
          if (!otherId) return null;
          if (!cache.has(otherId)) {
            const p = await getProfile(otherId);
            if (p) cache.set(otherId, p);
          }
          const other = cache.get(otherId);
          return other ? { id: d.id, members: data.members, createdAt: data.createdAt, other } : null;
        }),
      );
      const millis = (m: Match) => m.createdAt?.toMillis?.() ?? Date.now();
      onChange(rows.filter((r): r is Match => r !== null).sort((a, b) => millis(b) - millis(a)));
    },
    (e) => onError?.(e),
  );
}

// ---- Preview-mode state (in memory only) ----
const previewSeen = new Set<string>();
const previewMatches: Match[] = [];
const previewListeners = new Set<(m: Match[]) => void>();
