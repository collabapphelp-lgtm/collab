import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from './auth-context';
import { isGroupUnread, isUnread, listenToGroups, listenToMatches, type Group, type Match } from './connections';

type State = {
  matches: Match[] | null;
  /** Group chats I'm in, and ones I've been invited to (check `invited`). */
  groups: Group[] | null;
  error: string | null;
  /** Unread chats + open group invites (the Messages tab badge). */
  unreadCount: number;
};

const MatchesContext = createContext<State | null>(null);

/** One live listener for the signed-in person's connections, shared by every screen in the app. */
export function MatchesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [groups, setGroups] = useState<Group[] | null>(null);
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

  useEffect(() => {
    if (!user) return;
    // Groups are an extra: if they fail to load, 1:1 chats still work.
    return listenToGroups(user.uid, setGroups, (e) => {
      console.warn('Groups failed to load', e);
      setGroups([]);
    });
  }, [user]);

  const me = user?.uid ?? '';
  const unreadCount =
    (matches ?? []).filter((m) => isUnread(m, me)).length +
    (groups ?? []).filter((g) => (g.members.includes(me) ? isGroupUnread(g, me) : g.invited.includes(me))).length;
  return <MatchesContext.Provider value={{ matches, groups, error, unreadCount }}>{children}</MatchesContext.Provider>;
}

export function useMatches() {
  const ctx = useContext(MatchesContext);
  if (!ctx) throw new Error('useMatches must be used inside <MatchesProvider>');
  return ctx;
}
