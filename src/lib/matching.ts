import { DEFAULT_RADIUS_MILES } from './onboarding-data';
import { lookingOptionFor, optionFor } from './labels';
import type { UserProfile } from './types';

/**
 * Who you see on Discover, and in what order.
 *
 * 1. Location: someone shows up if they're within your radius, or if you're both open to global.
 *    (No city on file counts as global only.)
 * 2. Fit: does this person match what you're looking for, and do you match what they're looking for?
 *    If you both listed specific needs and neither of you fits the other, they're hidden.
 *    Skipped "looking for" = open to anyone.
 * 3. Ranking: two-way fit first, then one-way; shared genres/niches and closeness break ties.
 */

export type Candidate = {
  profile: UserProfile;
  score: number;
  distanceMiles: number | null;
  /** Short, human reasons shown on the card, e.g. "Producer — you're looking for producers". */
  reasons: string[];
};

const EARTH_RADIUS_MILES = 3958.8;

export function distanceMiles(a?: { lat: number; lng: number } | null, b?: { lat: number; lng: number } | null) {
  if (!a || !b) return null;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(h));
}

const article = (word: string) => (/^[aeiou]/i.test(word) ? 'an' : 'a');

const intersects = (a: string[] = [], b: string[] = []) => a.some((x) => b.includes(x));

/** Does `person` satisfy one "looking for" entry of the searcher? */
function satisfies(person: UserProfile, entry: string, details: string[] = []): boolean {
  const skills = person.skills ?? [];
  switch (entry) {
    case 'anything':
      return true;
    case 'musician':
    case 'content':
      return person.creatorType === entry && (details.length === 0 || intersects(details, skills));
    case 'instrumentalist':
      return skills.includes('instrumentalist') && (details.length === 0 || intersects(details, person.instruments));
    default:
      return skills.includes(entry);
  }
}

/** Which of the searcher's "looking for" entries this person fits. Empty list = searcher is open to anyone. */
function fitsWanted(searcher: UserProfile, person: UserProfile): { open: boolean; matched: string[] } {
  const wanted = searcher.lookingFor ?? [];
  if (wanted.length === 0 || wanted.includes('anything')) return { open: true, matched: [] };
  const details = searcher.lookingForDetails ?? {};
  return { open: false, matched: wanted.filter((w) => satisfies(person, w, details[w])) };
}

function withinReach(me: UserProfile, them: UserProfile, miles: number | null) {
  const radius = me.maxDistance ?? DEFAULT_RADIUS_MILES;
  if (miles !== null && miles <= radius) return true;
  return !!me.global && !!them.global;
}

function tastes(p: UserProfile) {
  return p.creatorType === 'content' ? (p.interests ?? []) : (p.genres ?? []);
}

export function scoreCandidate(me: UserProfile, them: UserProfile): Candidate | null {
  const miles = distanceMiles(me.geo, them.geo);
  if (!withinReach(me, them, miles)) return null;

  const iWant = fitsWanted(me, them);
  const theyWant = fitsWanted(them, me);
  const iMatch = iWant.open || iWant.matched.length > 0;
  const theyMatch = theyWant.open || theyWant.matched.length > 0;
  // Both were specific and neither fits the other: not a useful suggestion.
  if (!iWant.open && !theyWant.open && iWant.matched.length === 0 && theyWant.matched.length === 0) return null;

  let score = 0;
  const reasons: string[] = [];

  if (iWant.matched.length) {
    score += 40;
    const what = lookingOptionFor(iWant.matched[0]).label.toLowerCase();
    reasons.push(`You’re looking for ${what}`);
  } else if (iMatch) score += 15;

  if (theyWant.matched.length) {
    score += 40;
    const e = theyWant.matched[0];
    // Name the specific skill of mine they want: the entry itself, or a narrowed group pick (e.g. musician → producer).
    const mine = me.skills ?? [];
    const skill = mine.includes(e) ? e : (them.lookingForDetails?.[e] ?? []).find((d) => mine.includes(d));
    const label = skill ? optionFor(skill).label.toLowerCase() : null;
    reasons.push(label ? `Looking for ${article(label)} ${label} like you` : 'Looking for someone like you');
  } else if (theyMatch) score += 15;

  const shared = tastes(me).filter((t) => tastes(them).includes(t));
  score += Math.min(shared.length, 3) * 5;
  if (shared.length) reasons.push(`Both into ${shared.slice(0, 2).map((s) => optionFor(s).label).join(' & ')}`);
  if (them.openToAll) score += 3;

  if (miles !== null) {
    const r = me.maxDistance ?? DEFAULT_RADIUS_MILES;
    score += Math.max(0, 10 * (1 - Math.min(miles, r) / r)); // closer = a little higher
  }

  const radius = me.maxDistance ?? DEFAULT_RADIUS_MILES;
  if (reasons.length < 2 && (miles === null || miles > radius)) reasons.push('Open to remote collabs');
  if (reasons.length === 0 && theyWant.open) reasons.push('Open to all kinds of collabs');

  return { profile: them, score, distanceMiles: miles, reasons: reasons.slice(0, 2) };
}

/** Score, filter and sort everyone not yet seen. Best fits first. */
export function rankCandidates(me: UserProfile, others: UserProfile[]): Candidate[] {
  return others
    .map((o) => scoreCandidate(me, o))
    .filter((c): c is Candidate => c !== null)
    .sort((a, b) => b.score - a.score);
}

export function formatDistance(miles: number | null, location?: string) {
  if (miles === null) return location ? location.split(',')[0] : 'Remote';
  if (miles < 1) return 'Less than a mile away';
  if (miles < 100) return `${Math.round(miles)} mi away`;
  return location ? location.split(',')[0] : `${Math.round(miles)} mi away`;
}
