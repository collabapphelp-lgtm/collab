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
import { collection, deleteDoc, doc, getDocs, query, serverTimestamp, setDoc, addDoc, where } from 'firebase/firestore';
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
  verified: boolean;
  host?: { id: string; name: string };
  /** Only set on your own posted events. */
  status?: 'pending' | 'approved' | 'rejected';
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

export const WINDOW_DAYS = 14;

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

/** Turns the curated list into dated listings for today and the next two weeks. */
export function curatedOccurrences(now = new Date()): EventOccurrence[] {
  const out: EventOccurrence[] = [];
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < WINDOW_DAYS; i++) {
    const day = new Date(today);
    day.setDate(today.getDate() + i);
    for (const e of CURATED_EVENTS) {
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
        verified: e.verified,
      });
    }
  }
  const last = new Date(today);
  last.setDate(today.getDate() + WINDOW_DAYS);
  for (const e of CURATED_ONE_OFFS) {
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
    verified: true,
    host: { id: e.hostId, name: e.hostName },
    status: e.status,
  };
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

export async function deleteMyEvent(id: string) {
  if (UI_PREVIEW) return;
  await deleteDoc(doc(db, 'events', id));
}

// ---------- I'm going ----------

export type Rsvp = { key: string; date: string; uid: string };

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
    venue: 'Sample venue',
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
  };
  return [fromPosted('preview-collab', sample)];
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
  out.push(...['p1', 'p2', 'p4'].map((uid) => ({ key: collab.key, date: collab.date, uid })));
  return out;
}
