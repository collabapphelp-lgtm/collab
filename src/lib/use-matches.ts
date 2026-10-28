import { useEffect, useState } from 'react';
import { useAuth } from './auth-context';
import { listenToMatches, type Match } from './discover';

/** Live list of the signed-in person's matches. `null` while loading. */
export function useMatches() {
  const { user } = useAuth();
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    return listenToMatches(
      user.uid,
      (m) => {
        setMatches(m);
        setError(null);
      },
      () => setError('Couldn’t load your matches. Check your connection.'),
    );
  }, [user]);

  return { matches, error };
}
