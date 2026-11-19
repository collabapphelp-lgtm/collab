/**
 * NYC neighborhoods, so people in the city show as "Bushwick, Brooklyn" instead of "New York, New York".
 * Coordinates are rough centers; we store these (not the person's GPS) as their position.
 */
export type Borough = 'Manhattan' | 'Brooklyn' | 'Queens' | 'Bronx' | 'Staten Island';
export type Neighborhood = { name: string; borough: Borough; lat: number; lng: number };

const M = 'Manhattan', B = 'Brooklyn', Q = 'Queens', X = 'Bronx', S = 'Staten Island';
const raw: [string, Borough, number, number][] = [
  // Manhattan
  ['Financial District', M, 40.7075, -74.0113], ['Battery Park City', M, 40.7115, -74.0156], ['Tribeca', M, 40.7163, -74.0086],
  ['Chinatown', M, 40.7158, -73.997], ['Lower East Side', M, 40.715, -73.9843], ['SoHo', M, 40.7233, -74.003],
  ['Nolita', M, 40.7223, -73.9955], ['Little Italy', M, 40.7191, -73.9973], ['East Village', M, 40.7265, -73.9815],
  ['Greenwich Village', M, 40.7336, -73.9991], ['West Village', M, 40.7358, -74.0036], ['NoHo', M, 40.7262, -73.9925],
  ['Chelsea', M, 40.7465, -74.0014], ['Flatiron', M, 40.7411, -73.9897], ['Gramercy', M, 40.7368, -73.9845],
  ['Union Square', M, 40.7359, -73.9911], ['Kips Bay', M, 40.7423, -73.9801], ['Murray Hill', M, 40.7479, -73.9757],
  ['Midtown', M, 40.7549, -73.984], ['Hell’s Kitchen', M, 40.7638, -73.9918], ['Hudson Yards', M, 40.7536, -74.0019],
  ['Upper West Side', M, 40.787, -73.9754], ['Upper East Side', M, 40.7736, -73.9566], ['Morningside Heights', M, 40.81, -73.9626],
  ['Harlem', M, 40.8116, -73.9465], ['East Harlem', M, 40.7957, -73.9389], ['Hamilton Heights', M, 40.8247, -73.9497],
  ['Washington Heights', M, 40.8417, -73.9394], ['Inwood', M, 40.8677, -73.9212], ['Roosevelt Island', M, 40.7618, -73.9505],
  // Brooklyn
  ['Williamsburg', B, 40.7081, -73.9571], ['Greenpoint', B, 40.7304, -73.9515], ['Bushwick', B, 40.6944, -73.9213],
  ['Bedford-Stuyvesant', B, 40.6872, -73.9418], ['Clinton Hill', B, 40.6896, -73.9661], ['Fort Greene', B, 40.6892, -73.9742],
  ['Downtown Brooklyn', B, 40.6928, -73.9874], ['Brooklyn Heights', B, 40.696, -73.9936], ['DUMBO', B, 40.7033, -73.9881],
  ['Boerum Hill', B, 40.6855, -73.9845], ['Cobble Hill', B, 40.686, -73.996], ['Carroll Gardens', B, 40.6795, -73.9991],
  ['Red Hook', B, 40.6734, -74.0083], ['Gowanus', B, 40.6733, -73.99], ['Park Slope', B, 40.671, -73.9814],
  ['Prospect Heights', B, 40.6775, -73.9692], ['Crown Heights', B, 40.6694, -73.9422], ['Prospect Lefferts Gardens', B, 40.6589, -73.9502],
  ['Flatbush', B, 40.6415, -73.9594], ['Ditmas Park', B, 40.6363, -73.9625], ['Windsor Terrace', B, 40.6539, -73.9759],
  ['Kensington', B, 40.6427, -73.9783], ['Sunset Park', B, 40.6455, -74.0124], ['Bay Ridge', B, 40.6264, -74.0299],
  ['Borough Park', B, 40.6331, -73.9967], ['Bensonhurst', B, 40.6049, -73.9953], ['Sheepshead Bay', B, 40.5864, -73.9542],
  ['Brighton Beach', B, 40.5775, -73.961], ['Coney Island', B, 40.5755, -73.9707], ['East Flatbush', B, 40.6502, -73.9304],
  ['Brownsville', B, 40.6631, -73.9089], ['East New York', B, 40.6663, -73.8826], ['Canarsie', B, 40.6402, -73.9061],
  ['Ridgewood', Q, 40.7044, -73.9056],
  // Queens
  ['Long Island City', Q, 40.7447, -73.9485], ['Astoria', Q, 40.7644, -73.9235], ['Sunnyside', Q, 40.7433, -73.9196],
  ['Woodside', Q, 40.7454, -73.9034], ['Jackson Heights', Q, 40.7557, -73.8831], ['Elmhurst', Q, 40.7366, -73.8783],
  ['Corona', Q, 40.7471, -73.8601], ['Flushing', Q, 40.7675, -73.833], ['Forest Hills', Q, 40.7196, -73.8448],
  ['Rego Park', Q, 40.7256, -73.8624], ['Maspeth', Q, 40.7294, -73.9066], ['Middle Village', Q, 40.7174, -73.8803],
  ['Glendale', Q, 40.7016, -73.8822], ['Kew Gardens', Q, 40.7091, -73.8303], ['Richmond Hill', Q, 40.6958, -73.8272],
  ['Ozone Park', Q, 40.6794, -73.8507], ['Jamaica', Q, 40.7027, -73.7889], ['Bayside', Q, 40.7686, -73.7771],
  ['Fresh Meadows', Q, 40.7335, -73.7801], ['St. Albans', Q, 40.6904, -73.7655], ['Far Rockaway', Q, 40.6054, -73.7558],
  ['Rockaway Beach', Q, 40.5857, -73.8166],
  // Bronx
  ['Mott Haven', X, 40.8091, -73.9229], ['Hunts Point', X, 40.8094, -73.8803], ['Concourse', X, 40.8343, -73.9182],
  ['Highbridge', X, 40.8369, -73.9262], ['Morrisania', X, 40.8292, -73.9064], ['Fordham', X, 40.8615, -73.8904],
  ['Belmont', X, 40.8555, -73.8862], ['Kingsbridge', X, 40.8787, -73.9055], ['Riverdale', X, 40.8946, -73.9118],
  ['Norwood', X, 40.8771, -73.8792], ['Parkchester', X, 40.8382, -73.8608], ['Soundview', X, 40.8251, -73.8682],
  ['Throgs Neck', X, 40.8197, -73.8197], ['Pelham Bay', X, 40.8508, -73.8326], ['Co-op City', X, 40.8739, -73.8294],
  ['Wakefield', X, 40.8947, -73.8556],
  // Staten Island
  ['St. George', S, 40.6437, -74.0763], ['Stapleton', S, 40.6267, -74.0776], ['New Brighton', S, 40.6404, -74.0919],
  ['Port Richmond', S, 40.6355, -74.1254], ['New Dorp', S, 40.5739, -74.1176], ['Great Kills', S, 40.5543, -74.1563],
  ['Tottenville', S, 40.5083, -74.2355],
];

export const NEIGHBORHOODS: Neighborhood[] = raw
  .map(([name, borough, lat, lng]) => ({ name, borough, lat, lng }))
  .sort((a, b) => a.name.localeCompare(b.name));

/** Rough box around the five boroughs. */
export const isNyc = (lat: number, lng: number) => lat > 40.49 && lat < 40.92 && lng > -74.27 && lng < -73.69;

/** What we save as their location: "Bushwick, Brooklyn, NY" (cards show "Bushwick, Brooklyn"). */
export const neighborhoodLabel = (n: Neighborhood) => `${n.name}, ${n.borough}, NY`;

export function neighborhoodFromLabel(label?: string): Neighborhood | undefined {
  if (!label) return undefined;
  const [name, borough] = label.split(',').map((s) => s.trim());
  return NEIGHBORHOODS.find((n) => n.name === name && n.borough === borough);
}

export function nearestNeighborhood(lat: number, lng: number): Neighborhood | undefined {
  if (!isNyc(lat, lng)) return undefined;
  const k = Math.cos((lat * Math.PI) / 180);
  let best: Neighborhood | undefined;
  let bestD = Infinity;
  for (const n of NEIGHBORHOODS) {
    const d = (n.lat - lat) ** 2 + ((n.lng - lng) * k) ** 2;
    if (d < bestD) [best, bestD] = [n, d];
  }
  return best;
}

export function searchNeighborhoods(q: string): Neighborhood[] {
  const s = q.trim().toLowerCase().replace(/[’']/g, '');
  if (!s) return [];
  const norm = (t: string) => t.toLowerCase().replace(/[’']/g, '');
  const starts = NEIGHBORHOODS.filter((n) => norm(n.name).startsWith(s));
  const rest = NEIGHBORHOODS.filter((n) => !starts.includes(n) && (norm(n.name).includes(s) || norm(n.borough).startsWith(s)));
  return [...starts, ...rest].slice(0, 6);
}
