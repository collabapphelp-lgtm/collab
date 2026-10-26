// Shape of a document in the Firestore `users` collection.
// Matches what the web prototype writes, so both can share the same database during testing.
export type UserProfile = {
  id: string;
  firstName: string;
  lastName?: string;
  email: string;
  photoURL?: string | null;
  onboardingComplete: boolean;

  // Filled in during onboarding
  location?: string;
  geo?: { lat: number; lng: number } | null;
  maxDistance?: number;
  global?: boolean;
  creatorType?: 'musician' | 'content';
  skills?: string[];
  lookingFor?: string[];
  genres?: string[];
  interests?: string[];
  bio?: string;
};
