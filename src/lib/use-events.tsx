import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from './auth-context';
import { curatedOccurrences, loadCuratedOverrides, loadHiddenCurated, loadPostedEvents, loadRsvps, setGoing, type EventOccurrence } from './events';

type State = {
  /** Every listing from today through the next two weeks, soonest first. null while loading. */
  events: EventOccurrence[] | null;
  /** occurrence key → uids going */
  going: Map<string, string[]>;
  error: string | null;
  refresh: () => Promise<void>;
  toggleGoing: (e: EventOccurrence) => Promise<void>;
  isGoing: (e: EventOccurrence) => boolean;
};

const EventsContext = createContext<State | null>(null);

/** Shares the event list and "I'm going" state between the Events tab and event pages. */
export function EventsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const me = user?.uid;
  const [events, setEvents] = useState<EventOccurrence[] | null>(null);
  const [going, setGoingMap] = useState<Map<string, string[]>>(new Map());
  const [error, setError] = useState<string | null>(null);

  type Loaded = { events: EventOccurrence[]; rsvps: Map<string, string[]>; error: string | null };
  const load = useCallback(async (): Promise<Loaded | null> => {
    if (!me) return null;
    let error: string | null = null;
    // Curated listings are built in, so show them even if the network is down.
    const [posted, rsvps, hidden] = await Promise.all([
      // Team edits to built-in listings are applied inside curatedOccurrences() below.
      loadPostedEvents(me).catch((e) => {
        console.warn('Loading posted events failed', e);
        error = 'Couldn’t load the latest events. Showing the regular listings.';
        return [] as EventOccurrence[];
      }),
      loadRsvps().catch(() => new Map<string, string[]>()),
      loadHiddenCurated().catch(() => () => false),
      loadCuratedOverrides().catch(() => null),
    ]);
    const now = Date.now();
    // Keep tonight's listings visible until they've had a few hours to wrap up.
    const live = [...curatedOccurrences().filter((e) => !hidden(e)), ...posted].filter((e) => (e.end ?? e.start + 3 * 3600000) > now);
    return { events: live.sort((a, b) => a.start - b.start), rsvps, error };
  }, [me]);

  const apply = useCallback((r: Loaded | null) => {
    if (!r) return;
    setEvents(r.events);
    setGoingMap(r.rsvps);
    setError(r.error);
  }, []);

  const refresh = useCallback(async () => apply(await load()), [load, apply]);

  useEffect(() => {
    let cancelled = false;
    load().then((r) => {
      if (!cancelled) apply(r);
    });
    return () => {
      cancelled = true;
    };
  }, [load, apply]);

  const isGoing = useCallback((e: EventOccurrence) => !!me && (going.get(e.key) ?? []).includes(me), [going, me]);

  const toggleGoing = useCallback(
    async (e: EventOccurrence) => {
      if (!me) return;
      const next = !isGoing(e);
      // Update right away; undo if the save fails.
      const apply = (on: boolean) =>
        setGoingMap((m) => {
          const copy = new Map(m);
          const list = (copy.get(e.key) ?? []).filter((u) => u !== me);
          copy.set(e.key, on ? [...list, me] : list);
          return copy;
        });
      apply(next);
      try {
        await setGoing(me, e, next);
      } catch (err) {
        apply(!next);
        throw err;
      }
    },
    [me, isGoing],
  );

  const value = useMemo(() => ({ events, going, error, refresh, toggleGoing, isGoing }), [events, going, error, refresh, toggleGoing, isGoing]);
  return <EventsContext.Provider value={value}>{children}</EventsContext.Provider>;
}

export function useEvents() {
  const ctx = useContext(EventsContext);
  if (!ctx) throw new Error('useEvents must be used inside <EventsProvider>');
  return ctx;
}
