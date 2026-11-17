import { useEffect, useSyncExternalStore } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from './firebase';
import { UI_PREVIEW } from './preview';

// Collab team tools inside the app (event review). The server decides who's on the team
// (ADMIN_UIDS in functions); everyone else just gets { admin: false }.

export type Submission = {
  id: string;
  title: string;
  type: string;
  venue: string;
  address: string;
  neighborhood?: string;
  startsAt: number;
  cost: string | null;
  signUp: string | null;
  description: string;
  link: string | null;
  hostId: string;
  hostName: string;
  status: string;
  collabHosted: boolean;
  flyerURL?: string | null;
  flyerAspect?: number | null;
};

const fns = () => getFunctions(app);
let state = { admin: false, pending: 0, checked: false };
const listeners = new Set<() => void>();
const set = (next: typeof state) => {
  state = next;
  listeners.forEach((l) => l());
};

export async function refreshTeam() {
  // Previews act as a team member, except screenshot builds (store screenshots shouldn't show team tools).
  if (UI_PREVIEW) return set({ admin: process.env.EXPO_PUBLIC_SHOT_PHOTOS !== '1', pending: 1, checked: true });
  try {
    const { data } = await httpsCallable<unknown, { admin: boolean; pending: number }>(fns(), 'teamStatus')();
    set({ ...data, checked: true });
  } catch {
    set({ ...state, checked: true });
  }
}

/** { admin, pending }. Checks once per app session; call refreshTeam() after reviewing. */
export function useTeam() {
  const s = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state,
  );
  useEffect(() => {
    if (!state.checked) refreshTeam();
  }, []);
  return s;
}

export async function loadSubmissions(): Promise<{ pending: Submission[]; approved: Submission[] }> {
  if (UI_PREVIEW) {
    return {
      pending: [
        {
          id: 'demo',
          title: 'Bushwick Beat Night',
          type: 'jam',
          venue: 'The Loft',
          address: '123 Wyckoff Ave, Brooklyn, NY',
          startsAt: Date.now() + 3 * 86400e3,
          cost: 'Free',
          signUp: null,
          description: 'Producers bring 3 beats, vocalists hop on. Speakers and mics provided.',
          link: null,
          hostId: 'p2',
          hostName: 'Blaze',
          status: 'pending',
          collabHosted: false,
        },
      ],
      approved: [],
    };
  }
  const { data } = await httpsCallable<unknown, { pending: Submission[]; approved: Submission[] }>(fns(), 'eventSubmissions')();
  return data;
}

export async function reviewEvent(id: string, decision: 'approve' | 'reject' | 'remove', collabHosted = false) {
  if (UI_PREVIEW) return;
  await httpsCallable(fns(), 'reviewEvent')({ id, decision, collabHosted });
}
