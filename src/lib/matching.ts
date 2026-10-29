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

/**
 * `best`: only people inside your reach who fit at least one way (returns null otherwise).
 * `explore`: everyone, so people who were filtered out can still be shown once best fits run out.
 */
export function scoreCandidate(me: UserProfile, them: UserProfile, mode: 'best' | 'explore' = 'best'): Candidate | null {
  const miles = distanceMiles(me.geo, them.geo);
  const inReach = withinReach(me, them, miles);
  if (mode === 'best' && !inReach) return null;

  const iWant = fitsWanted(me, them);
  const theyWant = fitsWanted(them, me);
  const iMatch = iWant.open || iWant.matched.length > 0;
  const theyMatch = theyWant.open || theyWant.matched.length > 0;
  // Both were specific and neither fits the other: not a direct fit.
  const noFit = !iWant.open && !theyWant.open && iWant.matched.length === 0 && theyWant.matched.length === 0;
  if (mode === 'best' && noFit) return null;

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
  if (noFit) reasons.unshift('A different lane. Could spark something new');
  if (reasons.length < 2 && (miles === null || miles > radius)) reasons.push(inReach ? 'Open to remote collabs' : 'Outside your usual area');
  if (reasons.length === 0 && theyWant.open) reasons.push('Open to all kinds of collabs');

  return { profile: them, score, distanceMiles: miles, reasons: reasons.slice(0, 2) };
}

const byScore = (a: Candidate, b: Candidate) => b.score - a.score;

/**
 * Split everyone not yet seen into:
 *   best — direct fits within reach, best first
 *   more — everyone else (different lanes, outside your area), offered once `best` runs out
 */
export function rankCandidates(me: UserProfile, others: UserProfile[]): { best: Candidate[]; more: Candidate[] } {
  const best: Candidate[] = [];
  const more: Candidate[] = [];
  for (const o of others) {
    const strict = scoreCandidate(me, o, 'best');
    if (strict) best.push(strict);
    else more.push(scoreCandidate(me, o, 'explore')!);
  }
  return { best: best.sort(byScore), more: more.sort(byScore) };
}

export function formatDistance(miles: number | null, location?: string) {
  if (miles === null) return location ? location.split(',')[0] : 'Remote';
  if (miles < 1) return 'Less than a mile away';
  if (miles < 100) return `${Math.round(miles)} mi away`;
  return location ? location.split(',')[0] : `${Math.round(miles)} mi away`;
}
