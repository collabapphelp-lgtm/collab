import { UI_PREVIEW } from './preview';

/**
 * Venue search for "Create an event": type a name, get matching places in NYC with their address.
 * Uses Photon (photon.komoot.io), a free OpenStreetMap search with no API key. It's fine for our
 * volume; if we ever outgrow it, swap this one function for Apple/Google place search.
 */
export type Place = { name: string; address: string; neighborhood: string; lat: number; lng: number };

// Bounding box around the five boroughs (lon,lat,lon,lat).
const NYC_BBOX = '-74.26,40.49,-73.69,40.92';

type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: {
    name?: string;
    housenumber?: string;
    street?: string;
    city?: string;
    district?: string;
    locality?: string;
    county?: string;
    state?: string;
    postcode?: string;
  };
};

const BOROUGH: Record<string, string> = {
  'Kings County': 'Brooklyn',
  'New York County': 'New York',
  'Queens County': 'Queens',
  'Bronx County': 'Bronx',
  'Richmond County': 'Staten Island',
};

export async function searchPlaces(q: string): Promise<Place[]> {
  if (UI_PREVIEW) {
    return [
      { name: 'Brooklyn Music Kitchen', address: '177 Vanderbilt Ave, Brooklyn, NY 11205', neighborhood: 'Clinton Hill', lat: 40.6936, lng: -73.9689 },
      { name: 'Brooklyn Bowl', address: '61 Wythe Ave, Brooklyn, NY 11249', neighborhood: 'Williamsburg', lat: 40.7219, lng: -73.9574 },
    ].filter((p) => p.name.toLowerCase().includes(q.toLowerCase().slice(0, 3)));
  }
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&bbox=${NYC_BBOX}&lat=40.72&lon=-73.95&limit=8&lang=en`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const json = (await res.json()) as { features?: PhotonFeature[] };
  const seen = new Set<string>();
  const out: Place[] = [];
  for (const f of json.features ?? []) {
    const p = f.properties;
    if (!p.name || !p.street) continue; // need a named place with a street to be useful
    const borough = BOROUGH[p.county ?? ''] ?? p.city ?? 'New York';
    const street = [p.housenumber, p.street].filter(Boolean).join(' ');
    const address = `${street}, ${borough}, NY${p.postcode ? ` ${p.postcode}` : ''}`;
    const key = `${p.name}|${address}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const [lng, lat] = f.geometry.coordinates;
    out.push({ name: p.name, address, neighborhood: p.district || p.locality || borough, lat, lng });
    if (out.length >= 5) break;
  }
  return out;
}
