import { arrayUnion, doc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { UI_PREVIEW } from './preview';

/**
 * Light usage signals for the tester dashboard, kept in activity/{uid} (private to the owner;
 * only the server reads it). No third-party analytics.
 *   days         — dates the app was opened ("2026-11-06"), for return visits
 *   stepsReached — onboarding steps the person got to, for drop-off
 *   skipped      — onboarding steps they skipped
 */
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function record(uid: string | undefined, field: 'days' | 'stepsReached' | 'skipped', value: string) {
  if (!uid || UI_PREVIEW) return;
  setDoc(doc(db, 'activity', uid), { [field]: arrayUnion(value) }, { merge: true }).catch(() => {
    // Best effort: never get in the way of using the app.
  });
}

// Remembered per person and day. (It used to remember the day even before sign-in finished loading,
// so the real write that followed was skipped and no days were ever counted.)
let lastLogged: string | null = null;
export function trackActiveDay(uid: string | undefined) {
  if (!uid) return;
  const key = `${uid}:${today()}`;
  if (key === lastLogged) return; // once per day per launch is enough
  lastLogged = key;
  record(uid, 'days', today());
}

export const trackStepReached = (uid: string | undefined, step: string) => record(uid, 'stepsReached', step);
export const trackSkip = (uid: string | undefined, step: string) => record(uid, 'skipped', step);
