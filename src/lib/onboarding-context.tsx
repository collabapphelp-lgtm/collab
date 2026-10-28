import { createContext, useContext, useState, type ReactNode } from 'react';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { useAuth } from './auth-context';
import type { OnboardingDraft } from './types';
import { UI_PREVIEW } from './preview';

type OnboardingState = {
  draft: OnboardingDraft;
  /** Merge answers into the draft and save them to the user's profile. Throws if the save fails. */
  saveStep: (patch: OnboardingDraft) => Promise<void>;
  /** Save the last answers and mark onboarding done, which moves them into the app. */
  finish: (patch: OnboardingDraft) => Promise<void>;
};

const OnboardingContext = createContext<OnboardingState | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();

  // Start from whatever is already saved, so someone who quit halfway picks up where they left off.
  const [draft, setDraft] = useState<OnboardingDraft>(() => {
    if (!profile) return {};
    const { id, email, firstName, onboardingComplete, ...rest } = profile;
    return rest;
  });

  async function write(patch: OnboardingDraft, extra: Record<string, unknown> = {}) {
    if (!user) throw new Error('Not signed in');
    setDraft((d) => ({ ...d, ...patch }));
    if (UI_PREVIEW) return;
    await setDoc(doc(db, 'users', user.uid), { ...patch, ...extra, updatedAt: serverTimestamp() }, { merge: true });
  }

  const value: OnboardingState = {
    draft,
    saveStep: (patch) => write(patch),
    finish: (patch) => write(patch, { onboardingComplete: true, onboardingCompletedAt: serverTimestamp() }),
  };

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used inside <OnboardingProvider>');
  return ctx;
}

/** The order of the steps; used for the progress bar and "Step 3 of 7". */
export const ONBOARDING_STEPS = ['location', 'type', 'skills', 'looking', 'taste', 'showcase', 'bio'] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];
