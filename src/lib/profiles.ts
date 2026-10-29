import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { UI_PREVIEW } from './preview';
import { PREVIEW_PROFILES } from './preview-data';
import type { UserProfile } from './types';

export async function getProfile(uid: string): Promise<UserProfile | null> {
  if (UI_PREVIEW) return PREVIEW_PROFILES.find((p) => p.id === uid) ?? null;
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as UserProfile) : null;
}
