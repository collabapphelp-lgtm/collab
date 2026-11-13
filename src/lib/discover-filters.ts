import { doc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { canonicalList } from './labels';
import { UI_PREVIEW } from './preview';
import type { UserProfile } from './types';

/** Quick filters on Discover. Empty group = no filter for that group. */
export type DiscoverFilters = {
  roles: string[];
  instruments: string[];
  sounds: string[];
  intents: string[];
  experience: string[];
};

export const NO_FILTERS: DiscoverFilters = { roles: [], instruments: [], sounds: [], intents: [], experience: [] };

export function filterCount(f: DiscoverFilters) {
  return f.roles.length + f.instruments.length + f.sounds.length + f.intents.length + f.experience.length;
}

const hits = (want: string[], have: string[] = []) => want.length === 0 || want.some((w) => have.includes(w));

/** Does this person pass every active filter group? */
export function passesFilters(p: UserProfile, f: DiscoverFilters) {
  return (
    hits(f.roles, p.skills) &&
    hits(f.instruments, canonicalList(p.instruments)) &&
    hits(f.sounds, [...(p.genres ?? []), ...(p.interests ?? [])]) &&
    hits(f.intents, p.intents) &&
    hits(f.experience, p.experience ? [p.experience] : [])
  );
}

/** Remember filters on the profile so they follow you across devices. */
export async function saveFilters(uid: string, f: DiscoverFilters) {
  if (UI_PREVIEW) return;
  await setDoc(doc(db, 'users', uid), { discoverFilters: f }, { merge: true });
}
