import {
  CONTENT_SKILLS,
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
];

const byValue = new Map<string, Option>();
for (const o of ALL) if (!byValue.has(o.value)) byValue.set(o.value, o);

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

export function fullName(p: Pick<UserProfile, 'firstName' | 'lastName'>) {
  return [p.firstName, p.lastName].filter(Boolean).join(' ');
}

/** "Atlanta, Georgia, USA" → "Atlanta, Georgia" for compact display. */
export function shortLocation(location?: string) {
  if (!location) return undefined;
  return location.split(',').slice(0, 2).join(',').trim();
}
