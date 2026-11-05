import { collection, doc, getDoc, getDocs, limit, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { db } from './firebase';
import { UI_PREVIEW } from './preview';
import { PREVIEW_PROFILES } from './preview-data';
import { addPreviewMatch } from './connections';
import { loadBlockedIds } from './safety';
import { pairId } from './ids';
import type { UserProfile } from './types';

/**
 * Firestore layout:
 *   users/{uid}                     profile
 *   users/{uid}/likes/{otherUid}    I liked them
 *   users/{uid}/passes/{otherUid}   I passed on them
 *   matches/{uidA_uidB}             created when both liked each other; members: [uidA, uidB]
 * A top-level `matches` doc (instead of copies under each user) is what Phase 4 chat hangs off.
 */

export { pairId } from './ids';

/** Everyone who finished onboarding, minus me and anyone I've already liked or passed. */
export async function loadUnseenProfiles(me: string): Promise<UserProfile[]> {
  if (UI_PREVIEW) {
    const blocked = new Set(await loadBlockedIds(me));
    return PREVIEW_PROFILES.filter((p) => !previewSeen.has(p.id) && !blocked.has(p.id));
  }

  const [usersSnap, likesSnap, passesSnap, blocked] = await Promise.all([
    // Fine for early testing; Phase 5+ will need paging / server-side filtering as users grow.
    getDocs(query(collection(db, 'users'), where('onboardingComplete', '==', true), limit(500))),
    getDocs(collection(db, 'users', me, 'likes')),
    getDocs(collection(db, 'users', me, 'passes')),
    loadBlockedIds(me),
  ]);
  const seen = new Set([...likesSnap.docs.map((d) => d.id), ...passesSnap.docs.map((d) => d.id), ...blocked, me]);
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
    if (matched) addPreviewMatch({ id: pairId(me.id, them.id), members: [me.id, them.id], other: them });
    return matched;
  }

  await setDoc(doc(db, 'users', me.id, 'likes', them.id), { createdAt: serverTimestamp() });
  const theirLike = await getDoc(doc(db, 'users', them.id, 'likes', me.id));
  if (!theirLike.exists()) return false;

  // Deterministic id: if both people like each other at the same moment, they target the same doc.
  // Only create it if it isn't there yet (security rules don't allow rewriting an existing one).
  const matchRef = doc(db, 'matches', pairId(me.id, them.id));
  if (!(await getDoc(matchRef)).exists()) {
    try {
      await setDoc(matchRef, { members: [me.id, them.id].sort(), createdAt: serverTimestamp() });
    } catch (e) {
      // Lost a race with the other person creating it at the same moment: that's still a match.
      if (!(await getDoc(matchRef)).exists()) throw e;
    }
  }
  return true;
}

// Profile lookups and connection listening live in profiles.ts / connections.ts.
export { getProfile } from './profiles';

// ---- Preview-mode state (in memory only) ----
// p6 is already connected in preview mode (see connections.ts), so she doesn't show on Discover.
const previewSeen = new Set<string>(['p6']);
