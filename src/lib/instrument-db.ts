/**
 * Instruments people can pick from while typing in "Play something not listed?" / "Something else?".
 * Anything not here can still be added as typed. Keep names in their most common spelling.
 */
export const INSTRUMENT_DB: string[] = [
  // Most asked-for first, so they top the suggestions ("har" → Harmonica before Harmonium).
  'Harmonica', 'Harp', 'Saxophone', 'Trumpet', 'Violin', 'Cello', 'Flute', 'Synthesizer', 'Turntables', 'Talkbox',
  'Steelpan', 'Ukulele', 'Banjo', 'Mandolin', 'Accordion', 'Organ', 'Congas', 'Bongos', 'Djembe', 'Tabla', 'Sitar',
  'Kalimba', 'Handpan', 'Cajón', 'MPC', 'Drum machine', 'Trombone', 'Clarinet', 'Upright bass', 'Electric guitar',
  // Keys & synths
  'Accordion', 'Celesta', 'Clavinet', 'Electric piano', 'Fender Rhodes', 'Hammond organ', 'Harmonium', 'Harpsichord',
  'Keytar', 'Melodica', 'Mellotron', 'Moog synthesizer', 'Organ', 'Pipe organ', 'Rhodes', 'Synthesizer', 'Modular synth',
  'Wurlitzer', 'Toy piano', 'Concertina', 'Bandoneon',
  // Electronic & production
  'Drum machine', 'MPC', 'Sampler', 'Turntables', 'Launchpad', 'Ableton Push', 'Maschine', 'MIDI controller',
  'Talkbox', 'Vocoder', 'Theremin', 'Looper', 'Beatbox', 'Loop station', 'Eurorack', 'Roland TR-808', 'Roland TR-909',
  'Groovebox', 'Theremin', 'Omnichord', 'Stylophone', 'EWI (electronic wind instrument)', 'Octapad', 'Drum pad',
  // Guitars & plucked strings
  'Acoustic guitar', 'Electric guitar', 'Classical guitar', 'Twelve-string guitar', 'Steel guitar', 'Pedal steel guitar',
  'Lap steel guitar', 'Slide guitar', 'Resonator guitar', 'Dobro', 'Baritone guitar', 'Bass guitar', 'Fretless bass',
  'Ukulele', 'Banjo', 'Mandolin', 'Bouzouki', 'Balalaika', 'Charango', 'Cuatro', 'Tres', 'Oud', 'Saz', 'Sitar', 'Sarod',
  'Veena', 'Koto', 'Shamisen', 'Pipa', 'Guzheng', 'Kora', 'Lute', 'Zither', 'Autoharp', 'Dulcimer', 'Hammered dulcimer',
  'Harp', 'Lyre', 'Bajo sexto', 'Requinto', 'Guitarrón', 'Vihuela', 'Cavaquinho', 'Ngoni', 'Kantele',
  // Bowed strings
  'Violin', 'Fiddle', 'Viola', 'Cello', 'Double bass', 'Upright bass', 'Electric violin', 'Erhu', 'Nyckelharpa',
  'Hardanger fiddle', 'Sarangi', 'Kamancheh', 'Rebab', 'Viola da gamba',
  // Woodwinds
  'Flute', 'Piccolo', 'Alto flute', 'Bass flute', 'Recorder', 'Pan flute', 'Pan pipes', 'Tin whistle', 'Penny whistle',
  'Fife', 'Ocarina', 'Bansuri', 'Shakuhachi', 'Duduk', 'Clarinet', 'Bass clarinet', 'Oboe', 'English horn', 'Bassoon',
  'Contrabassoon', 'Soprano saxophone', 'Alto saxophone', 'Tenor saxophone', 'Baritone saxophone', 'Saxophone',
  'Harmonica', 'Chromatic harmonica', 'Bagpipes', 'Uilleann pipes', 'Didgeridoo', 'Native American flute', 'Kazoo',
  'Shehnai', 'Zurna', 'Ney', 'Quena', 'Sheng',
  // Brass
  'Trumpet', 'Cornet', 'Flugelhorn', 'Piccolo trumpet', 'Trombone', 'Bass trombone', 'Valve trombone', 'French horn',
  'Mellophone', 'Baritone horn', 'Euphonium', 'Tuba', 'Sousaphone', 'Alto horn', 'Bugle', 'Conch shell',
  // Drums & percussion
  'Drum kit', 'Electronic drums', 'Snare drum', 'Bass drum', 'Cajón', 'Congas', 'Bongos', 'Timbales', 'Djembe',
  'Dunun', 'Talking drum', 'Tabla', 'Dhol', 'Dholak', 'Mridangam', 'Darbuka', 'Doumbek', 'Riq', 'Bodhrán', 'Taiko',
  'Steelpan', 'Steel drum', 'Handpan', 'Hang drum', 'Tongue drum', 'Udu', 'Frame drum', 'Tambourine', 'Shaker',
  'Maracas', 'Güiro', 'Claves', 'Cowbell', 'Agogô', 'Cabasa', 'Shekere', 'Washboard', 'Spoons', 'Triangle',
  'Wind chimes', 'Woodblock', 'Castanets', 'Cymbals', 'Gong', 'Timpani', 'Marimba', 'Xylophone', 'Vibraphone',
  'Glockenspiel', 'Tubular bells', 'Kalimba', 'Mbira', 'Balafon', 'Gamelan', 'Berimbau', 'Pandeiro', 'Surdo',
  'Repinique', 'Cuíca', 'Zabumba', 'Bata drums', 'Quinto', 'Body percussion', 'Beatboxing',
  // Voice & other
  'Vocals', 'Background vocals', 'Rap', 'Throat singing', 'Beatbox', 'Whistling', 'Spoken word', 'Choir',
  'Musical saw', 'Glass harp', 'Jaw harp', 'Hurdy-gurdy', 'Accordion', 'Steel tongue drum', 'Singing bowl',
].filter((v, i, a) => a.indexOf(v) === i);

/** Up to `n` matches: names starting with the text first, then words starting with it, then anywhere. */
export function suggest(list: string[], text: string, exclude: string[] = [], n = 6): string[] {
  const q = text.trim().toLowerCase();
  if (q.length < 2) return [];
  const skip = new Set(exclude.map((x) => x.toLowerCase()));
  const pool = list.filter((x) => !skip.has(x.toLowerCase()));
  const starts = pool.filter((x) => x.toLowerCase().startsWith(q));
  const word = pool.filter((x) => !starts.includes(x) && x.toLowerCase().split(/[\s-]/).some((w) => w.startsWith(q)));
  const any = pool.filter((x) => !starts.includes(x) && !word.includes(x) && x.toLowerCase().includes(q));
  return [...starts, ...word, ...any].slice(0, n);
}
