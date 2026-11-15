/**
 * Known recurring NYC open mics and jam sessions, shown on the Events tab every week.
 *
 * Gathered in Nov 2026 from public listings (venue pages, DoNYC, Eventbrite, openmikes.org, Outgoing,
 * NYC Jazz Record). Schedules change: confirm each one with the venue, then set `verified: true`.
 * Coordinates are approximate (street-level) and only place the pin; the address is what people navigate to.
 *
 * To add or fix one: edit this list and ship with `npm run update` (no App Store review needed).
 * Events people post in the app live in Firestore instead (see src/lib/events.ts).
 */
export type EventType = 'open-mic' | 'jam' | 'show' | 'meetup';

export type CuratedEvent = {
  id: string;
  title: string;
  type: EventType;
  venue: string;
  address: string;
  neighborhood: string;
  lat: number;
  lng: number;
  /** Days of the week it happens, 0 = Sunday. */
  days: number[];
  /** Start time, 24h "HH:MM" New York time. */
  time: string;
  endTime?: string;
  cost?: string;
  signUp?: string;
  description: string;
  link?: string;
  /** True once someone on the team has confirmed the schedule with the venue. */
  verified: boolean;
};

export const CURATED_EVENTS: CuratedEvent[] = [
  {
    id: 'sugar-bar-open-mic',
    title: 'Open Mic Thursdays',
    type: 'open-mic',
    venue: 'Ashford & Simpson’s Sugar Bar',
    address: '254 W 72nd St, New York, NY',
    neighborhood: 'Upper West Side',
    lat: 40.7795,
    lng: -73.9838,
    days: [4],
    time: '20:00',
    endTime: '23:30',
    cost: 'Cover, about $20',
    signUp: 'Arrive early, it fills up',
    description: 'Singers perform with a live house band at Ashford & Simpson’s legendary spot. R&B, soul and jazz, with a packed, serious room.',
    verified: false,
  },
  {
    id: 'petes-candy-store',
    title: 'Sunday Open Mic at Pete’s',
    type: 'open-mic',
    venue: 'Pete’s Candy Store',
    address: '709 Lorimer St, Brooklyn, NY',
    neighborhood: 'Williamsburg',
    lat: 40.7184,
    lng: -73.9503,
    days: [0],
    time: '17:00',
    endTime: '20:00',
    cost: 'Free',
    signUp: 'Sign-up opens at 3 PM',
    description: 'A Brooklyn singer-songwriter staple for over two decades, in the small back room.',
    verified: false,
  },
  {
    id: 'ottos-open-mic-jam',
    title: 'Open Mic into Jam Session',
    type: 'jam',
    venue: 'Otto’s Shrunken Head',
    address: '538 E 14th St, New York, NY',
    neighborhood: 'East Village',
    lat: 40.7302,
    lng: -73.9785,
    days: [3],
    time: '19:30',
    cost: 'Free',
    description: 'Singer-songwriters from 7:30, then around 10 PM it turns into a full jam. Tiki bar, loose vibe.',
    verified: false,
  },
  {
    id: 'bmk-inspiredword',
    title: 'InspiredWordNYC Open Mic & Showcase',
    type: 'open-mic',
    venue: 'Brooklyn Music Kitchen',
    address: '177 Vanderbilt Ave, Brooklyn, NY',
    neighborhood: 'Clinton Hill',
    lat: 40.6927,
    lng: -73.9693,
    days: [1],
    time: '19:00',
    endTime: '23:00',
    signUp: 'About 25 slots, first come',
    description: 'All-arts open mic for singers, musicians and poets, with a stage-ready piano and a good sound system.',
    verified: false,
  },
  {
    id: 'bmk-legendary-locals',
    title: 'Legendary Locals House Band Night',
    type: 'open-mic',
    venue: 'Brooklyn Music Kitchen',
    address: '177 Vanderbilt Ave, Brooklyn, NY',
    neighborhood: 'Clinton Hill',
    lat: 40.6929,
    lng: -73.9690,
    days: [3],
    time: '20:00',
    cost: 'Two-item minimum',
    signUp: 'Request songs in advance, originals welcome',
    description: 'Sing with the BMK funk house band. A good night to meet players.',
    verified: false,
  },
  {
    id: 'barrows-sunday',
    title: 'Sunday Musicians Open Mic',
    type: 'open-mic',
    venue: 'Barrow’s Intense Tasting Room',
    address: 'Industry City, Brooklyn, NY',
    neighborhood: 'Sunset Park',
    lat: 40.6559,
    lng: -74.0078,
    days: [0],
    time: '17:00',
    endTime: '20:00',
    description: 'All musicians welcome, hosted by Braden Palmer inside Industry City.',
    verified: false,
  },
  {
    id: 'daily-press-tuesday',
    title: 'Free Open Mic',
    type: 'open-mic',
    venue: 'Daily Press Coffee and Bar',
    address: '38 Somers St, Brooklyn, NY',
    neighborhood: 'Ocean Hill',
    lat: 40.6787,
    lng: -73.9113,
    days: [2],
    time: '19:30',
    cost: 'Free',
    description: 'Music, comedy and poetry. A featured artist at 7:30, open mic from 8.',
    verified: false,
  },
  {
    id: 'local-bar-astoria',
    title: 'Saturday Open Mic',
    type: 'open-mic',
    venue: 'The Local Bar',
    address: '41-04 31st Ave, Astoria, NY',
    neighborhood: 'Astoria',
    lat: 40.7593,
    lng: -73.9174,
    days: [6],
    time: '16:00',
    signUp: 'Sign-up from 3 PM',
    description: 'A chill Astoria live music bar with an afternoon open mic.',
    verified: false,
  },
  {
    id: 'cuckoos-soho-playhouse',
    title: 'Cuckoo’s Open Mic',
    type: 'open-mic',
    venue: 'SoHo Playhouse',
    address: '15 Vandam St, New York, NY',
    neighborhood: 'SoHo',
    lat: 40.7265,
    lng: -74.0048,
    days: [3],
    time: '21:30',
    description: 'Variety mic: music, comedy, spoken word and anything you can fit in about 7 minutes.',
    verified: false,
  },
  {
    id: 'smalls-late-jam',
    title: 'Late-Night Jam Session',
    type: 'jam',
    venue: 'Smalls Jazz Club',
    address: '183 W 10th St, New York, NY',
    neighborhood: 'West Village',
    lat: 40.7344,
    lng: -74.0027,
    days: [0, 1, 2, 3, 4, 5, 6],
    time: '23:45',
    cost: 'Cover; often free for players',
    description: 'After the last set, Smalls opens the bandstand to working jazz musicians. Hosts rotate nightly; check the Smalls schedule.',
    verified: false,
  },
  {
    id: 'smalls-afternoon-jam',
    title: 'Afternoon Jam Session',
    type: 'jam',
    venue: 'Smalls Jazz Club',
    address: '183 W 10th St, New York, NY',
    neighborhood: 'West Village',
    lat: 40.7346,
    lng: -74.0029,
    days: [0, 6],
    time: '14:00',
    cost: 'Free, one-drink minimum',
    description: 'A free afternoon session with a house trio. Newcomers and seasoned players sit in.',
    verified: false,
  },
  {
    id: 'uots-singers-jam',
    title: 'Singers’ Open Mic & Jam',
    type: 'jam',
    venue: 'University of the Streets',
    address: '130 E 7th St, 2nd Fl, New York, NY',
    neighborhood: 'East Village',
    lat: 40.7259,
    lng: -73.9832,
    days: [5],
    time: '20:30',
    endTime: '23:00',
    description: 'Showcase-style jazz open mic and jam for singers, with a house band.',
    verified: false,
  },
  {
    id: 'starr-bar-monday',
    title: 'Art VS Life Monday Open Mic',
    type: 'open-mic',
    venue: 'Starr Bar',
    address: '214 Starr St, Brooklyn, NY',
    neighborhood: 'Bushwick',
    lat: 40.7049,
    lng: -73.9222,
    days: [1],
    time: '18:00',
    description: 'A weekly Bushwick open mic. Follow the venue for updates.',
    verified: false,
  },
];

/** One-off dated events from public listings (not repeating weekly). `date` is YYYY-MM-DD. */
export const CURATED_ONE_OFFS: (Omit<CuratedEvent, 'days'> & { date: string })[] = [
  {
    id: 'nyjw-jam-2026-11-30',
    date: '2026-11-30',
    title: 'Monthly Jam Session',
    type: 'jam',
    venue: 'New York Jazz Workshop',
    address: '265 W 37th St, 10th Fl, New York, NY',
    neighborhood: 'Garment District',
    lat: 40.7537,
    lng: -73.9913,
    time: '21:00',
    description: 'Monthly open jam at the New York Jazz Workshop studio.',
    verified: false,
  },
  {
    id: 'nyjw-jam-2026-12-28',
    date: '2026-12-28',
    title: 'Monthly Jam Session',
    type: 'jam',
    venue: 'New York Jazz Workshop',
    address: '265 W 37th St, 10th Fl, New York, NY',
    neighborhood: 'Garment District',
    lat: 40.7537,
    lng: -73.9913,
    time: '21:00',
    description: 'Monthly open jam at the New York Jazz Workshop studio.',
    verified: false,
  },
];
