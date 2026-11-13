import type { UserProfile } from './types';

export type StrengthStep = { key: string; label: string; done: boolean; route: string };

/** What makes a profile "complete", most valuable first. Drives the Profile strength card. */
export function profileStrength(p: UserProfile) {
  const work = p.showcase?.length ?? 0;
  const steps: StrengthStep[] = [
    { key: 'work', label: 'Add a snippet or answer a prompt', done: work > 0, route: '/edit/showcase' },
    { key: 'photo', label: 'Add a profile photo', done: !!p.photoURL, route: '/edit/basics' },
    { key: 'looking', label: 'Say who you want to collab with', done: (p.lookingFor?.length ?? 0) > 0 || !!p.openToAll, route: '/edit/looking' },
    { key: 'sound', label: 'Pick your sound', done: (p.genres?.length ?? 0) > 0, route: '/edit/taste' },
    { key: 'more', label: 'Show more work (3+ items)', done: work >= 3, route: '/edit/showcase' },
    { key: 'partner', label: 'Describe your ideal collab partner', done: !!p.bio?.trim(), route: '/edit/showcase' },
  ];
  const done = steps.filter((s) => s.done).length;
  return { percent: Math.round((done / steps.length) * 100), next: steps.find((s) => !s.done) ?? null, steps };
}
