/**
 * Events: open mics, jams and Collab-hosted nights around NYC.
 *
 * Two sources, merged into one list of dated "occurrences":
 *  - CURATED_EVENTS (src/lib/events-data.ts): recurring listings the team maintains in code.
 *  - Firestore `events/{id}`: one-off events people post in the app. They start as
 *    status 'pending' and only show to everyone once the team approves them on /admin.
 *    { title, type, venue, address, neighborhood, lat, lng, startsAt (ms), endsAt?, cost?, signUp?,
 *      description, link?, hostId, hostName, status, collabHosted?, createdAt }
 *
 * "I'm going" lives in `rsvps/{occurrenceKey}__{uid}`: { key, date, uid, at }.
 * An occurrence key is `${eventId}@${YYYY-MM-DD}`, so going to this Thursday's open mic
 * doesn't carry over to next Thursday's.
 */
import { collection, deleteDoc, doc, getDocs, query, serverTimestamp, setDoc, addDoc, updateDoc, where } from 'firebase/firestore';
import { db } from './firebase';
import { UI_PREVIEW } from './preview';
import { CURATED_EVENTS, CURATED_ONE_OFFS, type EventType } from './events-data';

export type { EventType } from './events-data';

export type EventOccurrence = {
  key: string;
  eventId: string;
  source: 'curated' | 'posted';
  title: string;
  type: EventType;
  venue: string;
  address: string;
  neighborhood: string;
  lat: number;
  lng: number;
  /** Local start time in ms. */
  start: number;
  end?: number;
  /** YYYY-MM-DD of the start. */
  date: string;
  cost?: string;
  signUp?: string;
  description: string;
  link?: string;
  /** e.g. "Every Thursday", for curated weekly listings. */
  repeats?: string;
  collabHosted: boolean;
  /** Picked by the Collab team to show under Featured (Collab-hosted events are always featured). */
  featured?: boolean;
  verified: boolean;
  host?: { id: string; name: string };
  /** Only set on your own posted events. */
  status?: 'pending' | 'approved' | 'rejected';
  /** Posted events can cap how many are going; later "I'm going"s join a waitlist (in order). */
  capacity?: number;
  /** Posted events can have a flyer (any photo). Aspect is width / height, so it shows uncropped. */
  flyerURL?: string;
  flyerAspect?: number;
};

export type PostedEvent = {
  title: string;
  type: EventType;
  venue: string;
  address: string;
  neighborhood: string;
  lat: number;
  lng: number;
  startsAt: number;
  endsAt?: number;
  cost?: string;
  signUp?: string;
  description: string;
  link?: string;
  hostId: string;
  hostName: string;
  status: 'pending' | 'approved' | 'rejected';
  collabHosted?: boolean;
  featured?: boolean;
  capacity?: number;
  flyerURL?: string;
  flyerAspect?: number;
};

export const TYPE_META: Record<EventType | 'collab', { label: string; plural: string; color: string; symbol: string }> = {
  'open-mic': { label: 'Open mic', plural: 'Open mics', color: '#4BA3C7', symbol: 'music.mic' },
  jam: { label: 'Jam session', plural: 'Jams', color: '#A399C7', symbol: 'music.note.list' },
  show: { label: 'Show', plural: 'Shows', color: '#4DBFBF', symbol: 'music.note' },
  meetup: { label: 'Meetup', plural: 'Meetups', color: '#D97742', symbol: 'person.2.fill' },
  collab: { label: 'Collab event', plural: 'Collab events', color: '#F5B731', symbol: 'infinity' },
};

/** Which color/label a pin gets: Collab-hosted events stand out from everything else. */
export const metaFor = (e: Pick<EventOccurrence, 'type' | 'collabHosted'>) => TYPE_META[e.collabHosted ? 'collab' : e.type];

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** How far ahead listings are shown (and the date picker reaches). */
export const WINDOW_DAYS = 60;

const pad = (n: number) => String(n).padStart(2, '0');
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function at(date: Date, hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(date);
  d.setHours(h, m, 0, 0);
  return d;
}

function repeatsLabel(days: number[]) {
  if (days.length === 7) return 'Every night';
  return 'Every ' + days.map((d) => DAY_NAMES[d]).join(' & ');
}

/**
 * Collab team edits to built-in listings (`eventOverrides/{eventId}`), applied on top of the code.
 * null clears an optional field (cost, signUp, link, endTime).
 */
export type CuratedOverride = Partial<{
  title: string;
  type: EventType;
  venue: string;
  address: string;
  neighborhood: string;
  lat: number;
  lng: number;
  days: number[];
  date: string;
  time: string;
  endTime: string | null;
  cost: string | null;
  signUp: string | null;
  description: string;
  link: string | null;
  featured: boolean;
  verified: boolean;
}>;

let overrideCache = new Map<string, CuratedOverride>();

export async function loadCuratedOverrides(): Promise<Map<string, CuratedOverride>> {
  if (UI_PREVIEW) return overrideCache;
  const snap = await getDocs(collection(db, 'eventOverrides'));
  overrideCache = new Map(snap.docs.map((d) => [d.id, d.data() as CuratedOverride]));
  return overrideCache;
}

function withOverride<T extends { id: string }>(e: T): T {
  const o = overrideCache.get(e.id);
  if (!o) return e;
  const out: Record<string, unknown> = { ...e };
  for (const [k, v] of Object.entries(o)) {
    if (k === 'editedAt' || k === 'editedBy') continue;
    out[k] = v === null ? undefined : v;
  }
  return out as T;
}

/** A built-in listing as it currently stands (code + any team edits), for the edit screen. */
export function curatedListing(eventId: string):
  | { kind: 'weekly'; e: (typeof CURATED_EVENTS)[number]; edited: boolean }
  | { kind: 'once'; e: (typeof CURATED_ONE_OFFS)[number]; edited: boolean }
  | null {
  const w = CURATED_EVENTS.find((x) => x.id === eventId);
  if (w) return { kind: 'weekly', e: withOverride(w), edited: overrideCache.has(eventId) };
  const o = CURATED_ONE_OFFS.find((x) => x.id === eventId);
  if (o) return { kind: 'once', e: withOverride(o), edited: overrideCache.has(eventId) };
  return null;
}

/** Preview builds have no backend: keep edits in memory so the flow can be clicked through. */
export function setPreviewOverride(eventId: string, o: CuratedOverride | null) {
  if (o) overrideCache.set(eventId, { ...overrideCache.get(eventId), ...o });
  else overrideCache.delete(eventId);
}

/** Turns the curated list into dated listings for today and the next two weeks. */
export function curatedOccurrences(now = new Date()): EventOccurrence[] {
  const out: EventOccurrence[] = [];
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < WINDOW_DAYS; i++) {
    const day = new Date(today);
    day.setDate(today.getDate() + i);
    for (const base of CURATED_EVENTS) {
      const e = withOverride(base);
      if (!e.days.includes(day.getDay())) continue;
      const start = at(day, e.time);
      let end = e.endTime ? at(day, e.endTime) : undefined;
      if (end && end < start) end = new Date(end.getTime() + 86400000);
      out.push({
        key: `${e.id}@${ymd(day)}`,
        eventId: e.id,
        source: 'curated',
        title: e.title,
        type: e.type,
        venue: e.venue,
        address: e.address,
        neighborhood: e.neighborhood,
        lat: e.lat,
        lng: e.lng,
        start: start.getTime(),
        end: end?.getTime(),
        date: ymd(day),
        cost: e.cost,
        signUp: e.signUp,
        description: e.description,
        link: e.link,
        repeats: repeatsLabel(e.days),
        collabHosted: false,
        featured: !!e.featured,
        verified: e.verified,
      });
    }
  }
  const last = new Date(today);
  last.setDate(today.getDate() + WINDOW_DAYS);
  for (const base of CURATED_ONE_OFFS) {
    const e = withOverride(base);
    const [y, mo, d] = e.date.split('-').map(Number);
    const day = new Date(y, mo - 1, d);
    if (day < today || day >= last) continue;
    out.push({
      key: `${e.id}@${e.date}`,
      eventId: e.id,
      source: 'curated',
      title: e.title,
      type: e.type,
      venue: e.venue,
      address: e.address,
      neighborhood: e.neighborhood,
      lat: e.lat,
      lng: e.lng,
      start: at(day, e.time).getTime(),
      end: e.endTime ? at(day, e.endTime).getTime() : undefined,
      date: e.date,
      cost: e.cost,
      signUp: e.signUp,
      description: e.description,
      link: e.link,
      collabHosted: false,
      featured: !!e.featured,
      verified: e.verified,
    });
  }
  return out;
}

function fromPosted(id: string, e: PostedEvent): EventOccurrence {
  const date = ymd(new Date(e.startsAt));
  return {
    key: `${id}@${date}`,
    eventId: id,
    source: 'posted',
    title: e.title,
    type: e.type,
    venue: e.venue,
    address: e.address,
    neighborhood: e.neighborhood,
    lat: e.lat,
    lng: e.lng,
    start: e.startsAt,
    end: e.endsAt,
    date,
    cost: e.cost,
    signUp: e.signUp,
    description: e.description,
    link: e.link,
    collabHosted: !!e.collabHosted,
    featured: !!e.featured,
    verified: true,
    host: { id: e.hostId, name: e.hostName },
    status: e.status,
    capacity: typeof e.capacity === 'number' && e.capacity > 0 ? e.capacity : undefined,
    flyerURL: typeof e.flyerURL === 'string' && e.flyerURL ? e.flyerURL : undefined,
    flyerAspect: typeof e.flyerAspect === 'number' && e.flyerAspect > 0 ? e.flyerAspect : undefined,
  };
}

/**
 * Built-in listings the Collab team took down from the app: a whole series, or single dates.
 * Lives in Firestore (`hiddenEvents/{eventId}`) so it applies to everyone without an update.
 */
export async function loadHiddenCurated(): Promise<(e: EventOccurrence) => boolean> {
  if (UI_PREVIEW) return () => false;
  const snap = await getDocs(collection(db, 'hiddenEvents'));
  const series = new Set<string>();
  const dates = new Set<string>();
  snap.docs.forEach((d) => {
    const h = d.data() as { all?: boolean; dates?: string[] };
    if (h.all) series.add(d.id);
    (h.dates ?? []).forEach((date) => dates.add(`${d.id}@${date}`));
  });
  return (e) => e.source === 'curated' && (series.has(e.eventId) || dates.has(e.key));
}

/** Approved posted events, plus your own pending/rejected ones (so you can see they're in review). */
export async function loadPostedEvents(me: string): Promise<EventOccurrence[]> {
  if (UI_PREVIEW) return PREVIEW_POSTED();
  const [approved, mine] = await Promise.all([
    getDocs(query(collection(db, 'events'), where('status', '==', 'approved'))),
    getDocs(query(collection(db, 'events'), where('hostId', '==', me))),
  ]);
  const byId = new Map<string, EventOccurrence>();
  for (const d of [...approved.docs, ...mine.docs]) byId.set(d.id, fromPosted(d.id, d.data() as PostedEvent));
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  return [...byId.values()].filter((e) => e.start >= startOfToday.getTime() && e.status !== 'rejected');
}

export async function submitEvent(e: Omit<PostedEvent, 'status' | 'collabHosted'>): Promise<string> {
  if (UI_PREVIEW) return 'preview-new';
  const ref = await addDoc(collection(db, 'events'), { ...e, status: 'pending', createdAt: serverTimestamp() });
  return ref.id;
}

/**
 * Add or swap the flyer on an event you posted. A new image is checked like a new event, so the
 * event goes back to "pending" until the Collab team approves it (they get a notification).
 */
export async function setEventFlyer(id: string, flyerURL: string, flyerAspect: number) {
  if (UI_PREVIEW) return;
  await updateDoc(doc(db, 'events', id), { flyerURL, flyerAspect, status: 'pending' });
}

/** Keeps a flyer between "tall poster" and "wide banner" so odd images don't take over the screen. */
export const flyerShape = (aspect?: number) => Math.min(1.6, Math.max(0.62, aspect ?? 0.8));

export async function deleteMyEvent(id: string) {
  if (UI_PREVIEW) return;
  await deleteDoc(doc(db, 'events', id));
}

// ---------- I'm going ----------

export type Rsvp = { key: string; date: string; uid: string; at?: { toMillis?: () => number } };

const previewRsvps: Rsvp[] = [];

/** Every "I'm going" from today on, grouped by occurrence key. */
export async function loadRsvps(): Promise<Map<string, string[]>> {
  const today = ymd(new Date());
  let list: Rsvp[];
  if (UI_PREVIEW) {
    list = [...PREVIEW_RSVPS(), ...previewRsvps];
  } else {
    const snap = await getDocs(query(collection(db, 'rsvps'), where('date', '>=', today)));
    list = snap.docs.map((d) => d.data() as Rsvp);
  }
  // Oldest first: with a capacity, the first N are going and the rest are the waitlist, in order.
  list.sort((a, b) => (a.at?.toMillis?.() ?? Infinity) - (b.at?.toMillis?.() ?? Infinity));
  const map = new Map<string, string[]>();
  for (const r of list) map.set(r.key, [...(map.get(r.key) ?? []), r.uid]);
  return map;
}

export async function setGoing(me: string, occ: Pick<EventOccurrence, 'key' | 'date'>, going: boolean) {
  if (UI_PREVIEW) {
    const i = previewRsvps.findIndex((r) => r.key === occ.key && r.uid === me);
    if (going && i < 0) previewRsvps.push({ key: occ.key, date: occ.date, uid: me });
    if (!going && i >= 0) previewRsvps.splice(i, 1);
    return;
  }
  const ref = doc(db, 'rsvps', `${occ.key}__${me}`);
  if (going) await setDoc(ref, { key: occ.key, date: occ.date, uid: me, at: serverTimestamp() });
  else await deleteDoc(ref);
}

/** Used when deleting an account. */
export async function deleteMyEventData(me: string) {
  const [rsvps, events] = await Promise.all([
    getDocs(query(collection(db, 'rsvps'), where('uid', '==', me))),
    getDocs(query(collection(db, 'events'), where('hostId', '==', me))),
  ]);
  await Promise.all([...rsvps.docs, ...events.docs].map((d) => deleteDoc(d.ref).catch(() => {})));
}

// ---------- Display helpers ----------

export function dayHeading(t: number, now = Date.now()) {
  const d = new Date(t);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((new Date(d).setHours(0, 0, 0, 0) - today.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

export function timeLabel(t: number) {
  return new Date(t).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function whenLabel(e: Pick<EventOccurrence, 'start' | 'end'>) {
  const start = `${dayHeading(e.start)} · ${timeLabel(e.start)}`;
  return e.end ? `${start} – ${timeLabel(e.end)}` : start;
}

/** Rough NYC bounds so a pin can't land in another state by mistake. */
export const NYC_BOUNDS = { minLat: 40.45, maxLat: 40.95, minLng: -74.3, maxLng: -73.65 };
export const inNyc = (lat: number, lng: number) =>
  lat >= NYC_BOUNDS.minLat && lat <= NYC_BOUNDS.maxLat && lng >= NYC_BOUNDS.minLng && lng <= NYC_BOUNDS.maxLng;

// ---------- Preview-only sample data (EXPO_PUBLIC_UI_PREVIEW=1) ----------

function PREVIEW_POSTED(): EventOccurrence[] {
  const d = new Date();
  d.setDate(d.getDate() + 2);
  d.setHours(19, 0, 0, 0);
  const sample: PostedEvent = {
    title: 'Producer × Vocalist Mixer',
    type: 'meetup',
    venue: 'The Loft LES',
    address: 'Lower East Side, New York, NY',
    neighborhood: 'Lower East Side',
    lat: 40.7187,
    lng: -73.9877,
    startsAt: d.getTime(),
    endsAt: d.getTime() + 3 * 3600000,
    cost: 'Free with RSVP',
    description: 'Sample Collab event for previews only. Bring a beat or a hook: we pair people up for 20-minute sessions.',
    hostId: 'collab',
    hostName: 'Collab',
    status: 'approved',
    collabHosted: true,
    capacity: 8,
    ...(process.env.EXPO_PUBLIC_SHOT_PHOTOS === '1' ? { flyerURL: '/shots/flyer.jpg', flyerAspect: 0.8 } : {}),
  };
  const d2 = new Date();
  d2.setDate(d2.getDate() + 1);
  d2.setHours(20, 0, 0, 0);
  const full: PostedEvent = {
    title: 'Bushwick Beat Night',
    type: 'jam',
    venue: 'The Loft',
    address: '123 Wyckoff Ave, Brooklyn, NY',
    neighborhood: 'Bushwick',
    lat: 40.7046,
    lng: -73.9218,
    startsAt: d2.getTime(),
    endsAt: d2.getTime() + 3 * 3600000,
    cost: 'Free',
    description: 'Sample for previews only. Producers bring 3 beats, vocalists hop on. Small room, so spots are limited.',
    hostId: 'p2',
    hostName: 'Blaze',
    status: 'approved',
    capacity: 4,
  };
  return [fromPosted('preview-collab', sample), fromPosted('preview-full', full)];
}

function PREVIEW_RSVPS(): Rsvp[] {
  const occ = curatedOccurrences();
  const pick = (id: string) => occ.find((o) => o.eventId === id);
  const out: Rsvp[] = [];
  const add = (o: EventOccurrence | undefined, uids: string[]) => o && uids.forEach((uid) => out.push({ key: o.key, date: o.date, uid }));
  add(pick('sugar-bar-open-mic'), ['p1', 'p2', 'p3']);
  add(pick('smalls-late-jam'), ['p2']);
  add(pick('ottos-open-mic-jam'), ['p3', 'p4']);
  const collab = PREVIEW_POSTED()[0];
  out.push(...['p1', 'p2', 'p4', 'p5', 'p6'].map((uid) => ({ key: collab.key, date: collab.date, uid })));
  const fullOcc = PREVIEW_POSTED()[1];
  out.push(...['p1', 'p3', 'p4', 'p5', 'p6', 'p2'].map((uid) => ({ key: fullOcc.key, date: fullOcc.date, uid })));
  return out;
}
