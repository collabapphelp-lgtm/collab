import type { UserProfile } from './types';

/** Deep, readable colors (white text passes on all of them), one per sound/vibe. */
const ACCENTS: Record<string, string> = {
  // music
  hiphop: '#3B2A6B',
  rnb: '#5B3A8C',
  pop: '#A8325E',
  rock: '#7E2B2B',
  electronic: '#1F5A85',
  latin: '#A94A26',
  afrobeats: '#2C6E48',
  country: '#7A5226',
  indie: '#46573A',
  jazz: '#1E3A5F',
  classical: '#55473A',
  // content
  comedy: '#A8325E',
  vlog: '#24698C',
  music: '#5B3A8C',
  fashion: '#7E2B55',
  fitness: '#2C6E48',
  culinary: '#A94A26',
  gaming: '#3B2A6B',
  travel: '#1F5A85',
  sports: '#9C4630',
  tech: '#2B4C7E',
  educational: '#46573A',
  art: '#6E3A93',
};

export const DEFAULT_ACCENT = '#3B4F7A';

/** Profile color, taken from the first genre/niche they picked. */
export function accentFor(p: Pick<UserProfile, 'creatorType' | 'genres' | 'interests'>): string {
  const first = (p.creatorType === 'content' ? p.interests : p.genres)?.[0];
  return (first && ACCENTS[first]) || DEFAULT_ACCENT;
}
