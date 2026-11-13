import {
  CONTENT_SKILLS,
  EXPERIENCE,
  INTENTS,
  GENRES,
  INSTRUMENTS,
  INTERESTS,
  MUSICIAN_LOOKING,
  CONTENT_LOOKING,
  MUSICIAN_SKILLS,
  type Option,
} from './onboarding-data';
import type { UserProfile } from './types';

const ALL: Option[] = [
  ...MUSICIAN_SKILLS,
  ...CONTENT_SKILLS,
  ...INSTRUMENTS,
  ...GENRES,
  ...INTERESTS,
  ...MUSICIAN_LOOKING,
  ...CONTENT_LOOKING,
  ...INTENTS,
  ...EXPERIENCE,
];

const byValue = new Map<string, Option>();
for (const o of ALL) if (!byValue.has(o.value)) byValue.set(o.value, o);

// Options we've since merged: older profiles still show a sensible label.
const RETIRED: Record<string, string> = {
  violin: 'strings',
  cello: 'strings',
  ukulele: 'strings',
  trumpet: 'brass',
  edm: 'electronic',
  drums: 'percussion',
  saxophone: 'woodwinds',
  flute: 'woodwinds',
};
for (const [old, now] of Object.entries(RETIRED)) byValue.set(old, byValue.get(now)!);

/** Map a stored value to its current option value ('drums' → 'percussion'), for matching and re-saving. */
export function canonical(value: string): string {
  return RETIRED[value] ?? value;
}

/** Canonical values, de-duplicated (['saxophone', 'flute'] → ['woodwinds']). */
export function canonicalList(values: string[] = []): string[] {
  return [...new Set(values.map(canonical))];
}

/** Turn a stored value like 'producer' into what people see: { label: 'Producer', emoji: '💻' }. */
export function optionFor(value: string): Option {
  return byValue.get(value) ?? { value, label: value, emoji: '•' };
}

/** "Looking for" uses plural labels (Vocalists, Content Creators). */
export function lookingOptionFor(value: string): Option {
  return [...MUSICIAN_LOOKING, ...CONTENT_LOOKING].find((o) => o.value === value) ?? optionFor(value);
}

/** Short role line for cards: "Producer · Instrument Player". */
export function roleLine(p: Pick<UserProfile, 'skills' | 'creatorType'>, max = 2) {
  const skills = (p.skills ?? []).slice(0, max).map((s) => optionFor(s).label);
  if (skills.length) return skills.join(' · ');
  return p.creatorType === 'content' ? 'Content Creator' : p.creatorType === 'musician' ? 'Musician' : 'Creative';
}

/** What to call someone in short UI ("Message Maya", "Block The Midnight Kings"). */
export function displayName(p: Pick<UserProfile, 'firstName'> & Partial<Pick<UserProfile, 'profileKind' | 'groupName'>>) {
  return p.profileKind === 'group' && p.groupName?.trim() ? p.groupName.trim() : p.firstName;
}

export function fullName(p: Pick<UserProfile, 'firstName' | 'lastName'> & Partial<Pick<UserProfile, 'profileKind' | 'groupName'>>) {
  if (p.profileKind === 'group' && p.groupName?.trim()) return p.groupName.trim();
  return [p.firstName, p.lastName].filter(Boolean).join(' ');
}

/** "Atlanta, Georgia, USA" → "Atlanta, Georgia" for compact display. */
export function shortLocation(location?: string) {
  if (!location) return undefined;
  return location.split(',').slice(0, 2).join(',').trim();
}
