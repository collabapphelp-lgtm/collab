// Share links: collab-609ac.web.app/s/{id}. Saves a small snapshot (only what the page shows) to
// `shares/{id}`; functions/share.js renders it for anyone with the link, app or not.
import { Share } from 'react-native';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { UI_PREVIEW } from './preview';
import { displayName, lookingOptionFor, optionFor, roleLine, shortLocation } from './labels';
import { metaFor, type EventOccurrence } from './events';
import type { UserProfile } from './types';

const SITE = 'https://collab-609ac.web.app/s/';

/** Short, stable id: sharing the same thing again reuses (and refreshes) the same link. */
function shortId(s: string) {
  let a = 5381;
  let b = 52711;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    a = (a * 33) ^ c;
    b = (b * 31) ^ c;
  }
  return ((a >>> 0).toString(36) + (b >>> 0).toString(36)).slice(0, 10);
}

const clean = <T extends Record<string, unknown>>(o: T) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== '')) as T;

async function save(id: string, data: Record<string, unknown>) {
  if (UI_PREVIEW) return;
  await setDoc(doc(db, 'shares', id), { ...clean(data), at: serverTimestamp() });
}

export async function shareEvent(e: EventOccurrence, me: string) {
  const id = shortId(`${me}|e|${e.key}`);
  await save(id, {
    by: me,
    kind: 'event',
    key: e.key,
    eventId: e.eventId,
    source: e.source,
    title: e.title.slice(0, 120),
    typeLabel: metaFor(e).label,
    venue: e.venue,
    address: e.address,
    neighborhood: e.neighborhood,
    start: e.start,
    end: e.end,
    cost: e.cost,
    description: e.description?.slice(0, 1200),
    flyerURL: e.flyerURL,
  });
  const url = SITE + id;
  const day = new Date(e.start).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  await Share.share({ message: `${e.title}, ${day} at ${e.venue}. Who's coming? ${url}`, url }).catch(() => {});
}

/** Your own profile only: the page shows your name, photo, role, area and what you're into. */
export async function shareMyProfile(p: UserProfile) {
  const id = shortId(`${p.id}|p`);
  const tags = [...(p.genres ?? []), ...(p.interests ?? [])].slice(0, 6).map((v) => optionFor(v).label);
  const looking = (p.lookingFor ?? []).slice(0, 4).map((v) => lookingOptionFor(v).label).join(', ');
  await save(id, {
    by: p.id,
    kind: 'profile',
    uid: p.id,
    name: displayName(p).slice(0, 60),
    role: roleLine(p),
    place: shortLocation(p.location),
    tags,
    lookingFor: looking,
    photoURL: p.photoURL ?? undefined,
  });
  const url = SITE + id;
  await Share.share({ message: `I'm on Collab. Check out my profile and let's make something: ${url}`, url }).catch(() => {});
}
