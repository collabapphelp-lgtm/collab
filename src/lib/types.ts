import type { CreatorType } from './onboarding-data';

export type ShowcaseMedia = {
  type: 'media';
  /** 'link' = pasted URL (Spotify, YouTube…); 'upload' = file from the phone in Firebase Storage. */
  source: 'link' | 'upload';
  url: string;
  platform?: string; // for links: spotify, youtube, …
  mediaKind?: 'audio' | 'video' | 'image'; // for uploads
  title?: string;
  storagePath?: string;
};

export type ShowcasePrompt = { type: 'prompt'; question: string; answer: string };

export type ShowcaseItem = ShowcaseMedia | ShowcasePrompt;

// Shape of a document in the Firestore `users` collection.
export type UserProfile = {
  id: string;
  firstName: string;
  lastName?: string;
  email: string;
  photoURL?: string | null;
  onboardingComplete: boolean;

  // Location step
  location?: string; // "Atlanta, Georgia, USA"
  geo?: { lat: number; lng: number } | null;
  maxDistance?: number; // miles; default radius until filters exist
  global?: boolean; // open to collabs anywhere

  // Who you are
  creatorType?: CreatorType;
  skills?: string[];
  instruments?: string[];

  // Who you're looking for. `lookingFor` holds top-level values (e.g. 'instrumentalist', 'content');
  // `lookingForDetails` narrows a row (e.g. { instrumentalist: ['guitar'] }). Empty/missing = any.
  lookingFor?: string[];
  lookingForDetails?: Record<string, string[]>;

  // Musicians pick genres, content creators pick interests.
  genres?: string[];
  interests?: string[];
  openToAll?: boolean;

  showcase?: ShowcaseItem[];
  bio?: string;
};

/** Everything onboarding collects, before it's saved. */
export type OnboardingDraft = Omit<Partial<UserProfile>, 'id' | 'email' | 'firstName' | 'onboardingComplete'>;
