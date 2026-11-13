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
  /** Legacy: older test profiles stored this publicly; it's now removed on next launch. Login email lives in Firebase Auth only. */
  email?: string;
  photoURL?: string | null;
  onboardingComplete: boolean;

  // Location step
  location?: string; // "Atlanta, Georgia, USA"
  geo?: { lat: number; lng: number } | null;
  maxDistance?: number; // miles; default radius until filters exist
  global?: boolean; // open to collabs anywhere

  // Who you are
  /** A person, or a band/group sharing one profile. Missing = individual. */
  profileKind?: 'individual' | 'group';
  groupName?: string;
  groupSize?: string; // '2' | '3-5' | '6+'
  creatorType?: CreatorType;
  skills?: string[];
  instruments?: string[];
  /** Exact types within the chosen families ('type:saxophone'). Display only. */
  instrumentTypes?: string[];
  /** Producers: DAWs ('daw:ableton'). */
  daws?: string[];
  /** Free-text specifics typed by the user (Cello, Talkbox, 808s). Display only; matching uses `instruments`. */
  instrumentsSpecific?: string[];

  // Why they're here
  intents?: string[]; // jam | write | record | perform | content | notsure
  experience?: string; // starting | experienced | pro

  // Who you're looking for. `lookingFor` holds top-level values (e.g. 'instrumentalist', 'content');
  // `lookingForDetails` narrows a row (e.g. { instrumentalist: ['guitar'] }). Empty/missing = any.
  lookingFor?: string[];
  lookingForDetails?: Record<string, string[]>;
  /** Specific instruments they want, typed in (display only). */
  lookingForSpecific?: string[];

  // Musicians pick genres, content creators pick interests.
  genres?: string[];
  interests?: string[];
  openToAll?: boolean;

  showcase?: ShowcaseItem[];
  bio?: string;

  /** Discover quick filters (see lib/discover-filters.ts). */
  discoverFilters?: { roles: string[]; instruments: string[]; sounds: string[]; intents: string[]; experience: string[] };
};

/** Everything onboarding collects, before it's saved. */
export type OnboardingDraft = Omit<Partial<UserProfile>, 'id' | 'email' | 'firstName' | 'onboardingComplete'>;
