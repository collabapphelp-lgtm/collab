import { addDoc, collection, doc, getDoc, getDocs, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import { UI_PREVIEW } from './preview';
import { pairId } from './ids';
import { previewBlock, previewBlocked } from './connections';

export const REPORT_REASONS = [
  'Fake profile or spam',
  'Inappropriate messages',
  'Harassment or hate',
  'Inappropriate photos or media',
  'Scam or asking for money',
  'Something else',
] as const;

/** Files a report for review. Reports are write-only from the app; read them in the Firebase console. */
export async function reportUser(me: string, them: string, reason: string, details?: string) {
  if (UI_PREVIEW) return;
  await addDoc(collection(db, 'reports'), {
    reporterId: me,
    reportedId: them,
    reason,
    details: details?.trim() ? details.trim().slice(0, 1000) : null,
    createdAt: serverTimestamp(),
  });
}

/**
 * Blocks someone: they disappear from your Discover, your like is withdrawn (so you can't connect
 * again), and if you were connected, the chat is closed for both of you.
 */
export async function blockUser(me: string, them: string) {
  if (UI_PREVIEW) return previewBlock(them);
  const batch = writeBatch(db);
  batch.set(doc(db, 'users', me, 'blocks', them), { createdAt: serverTimestamp() });
  batch.delete(doc(db, 'users', me, 'likes', them));
  const matchRef = doc(db, 'matches', pairId(me, them));
  if ((await getDoc(matchRef)).exists()) batch.update(matchRef, { blockedBy: me });
  await batch.commit();
}

export async function loadBlockedIds(me: string): Promise<string[]> {
  if (UI_PREVIEW) return [...previewBlocked];
  const snap = await getDocs(collection(db, 'users', me, 'blocks'));
  return snap.docs.map((d) => d.id);
}
