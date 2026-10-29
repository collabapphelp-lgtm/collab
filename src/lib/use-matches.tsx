import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from './auth-context';
import { isUnread, listenToMatches, type Match } from './connections';

type State = { matches: Match[] | null; error: string | null; unreadCount: number };

const MatchesContext = createContext<State | null>(null);

/** One live listener for the signed-in person's connections, shared by every screen in the app. */
export function MatchesProvider({ children }: { children: ReactNode }) {
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
      () => setError('Couldn’t load your connections. Check your internet.'),
    );
  }, [user]);

  const unreadCount = user && matches ? matches.filter((m) => isUnread(m, user.uid)).length : 0;
  return <MatchesContext.Provider value={{ matches, error, unreadCount }}>{children}</MatchesContext.Provider>;
}

export function useMatches() {
  const ctx = useContext(MatchesContext);
  if (!ctx) throw new Error('useMatches must be used inside <MatchesProvider>');
  return ctx;
}
