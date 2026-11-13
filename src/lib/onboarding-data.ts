// Every option shown during onboarding, in one place.
// Rule: anything someone can be "looking for" must be something someone else can BE,
// using the same `value`, so Phase 3 matching can compare them directly.

export type CreatorType = 'musician' | 'content';

export type Option = { value: string; label: string; emoji: string };

// ---------- What you are ----------

export const MUSICIAN_SKILLS: Option[] = [
  { value: 'instrumentalist', label: 'Instrument Player', emoji: '🎹' },
  { value: 'vocalist', label: 'Vocalist', emoji: '🎤' },
  { value: 'producer', label: 'Producer', emoji: '💻' },
  { value: 'dj', label: 'DJ', emoji: '🎧' },
  { value: 'songwriter', label: 'Songwriter / Lyricist', emoji: '✍️' },
  { value: 'engineer', label: 'Audio Engineer', emoji: '🎚️' },
];

export const CONTENT_SKILLS: Option[] = [
  { value: 'streamer', label: 'Streamer', emoji: '📺' },
  { value: 'longform', label: 'Long Form / YouTube', emoji: '🎬' },
  { value: 'shortform', label: 'Short Form', emoji: '📱' },
  { value: 'podcast', label: 'Podcaster', emoji: '🎙️' },
  { value: 'photographer', label: 'Photographer', emoji: '📸' },
  { value: 'videographer', label: 'Videographer', emoji: '🎥' },
  { value: 'editor', label: 'Video Editor', emoji: '✂️' },
];

/** Shared by "what do you play?" and "which instruments are you looking for?" so they match. */
export const INSTRUMENTS: Option[] = [
  { value: 'guitar', label: 'Guitar', emoji: '🎸' },
  { value: 'piano', label: 'Piano', emoji: '🎹' },
  { value: 'bass', label: 'Bass', emoji: '🎸' },
  { value: 'strings', label: 'Strings', emoji: '🎻' },
  { value: 'percussion', label: 'Percussion', emoji: '🪘' },
  { value: 'woodwinds', label: 'Woodwinds', emoji: '🎷' },
  { value: 'brass', label: 'Brass', emoji: '🎺' },
];

// ---------- Who you're looking for ----------

/** A row on the "Looking to collab with" screen. If `subOptions` is set, the row expands. */
export type LookingOption = Option & { subOptions?: Option[]; subPrompt?: string };

const MUSICIAN_GROUP: LookingOption = {
  value: 'musician',
  label: 'Musicians',
  emoji: '🎵',
  subPrompt: 'Any specific kind? Leave blank for any musician.',
  subOptions: MUSICIAN_SKILLS,
};

const CONTENT_GROUP: LookingOption = {
  value: 'content',
  label: 'Content Creators',
  emoji: '🎬',
  subPrompt: 'Any specific kind? Leave blank for any creator.',
  subOptions: CONTENT_SKILLS,
};

const OPEN_TO_ANYTHING: LookingOption = { value: 'anything', label: 'Open to anything!', emoji: '🤝' };

export const MUSICIAN_LOOKING: LookingOption[] = [
  {
    value: 'instrumentalist',
    label: 'Instrument Players',
    emoji: '🎹',
    subPrompt: 'Which instruments? Leave blank for any.',
    subOptions: INSTRUMENTS,
  },
  { value: 'vocalist', label: 'Vocalists', emoji: '🎤' },
  { value: 'producer', label: 'Producers', emoji: '💻' },
  { value: 'dj', label: 'DJs', emoji: '🎧' },
  { value: 'songwriter', label: 'Songwriters / Lyricists', emoji: '✍️' },
  { value: 'engineer', label: 'Audio Engineers', emoji: '🎚️' },
  CONTENT_GROUP, // cross-type: musicians can look for content creators
  OPEN_TO_ANYTHING, // shown at the top of the screen (see looking.tsx)
];

export const CONTENT_LOOKING: LookingOption[] = [
  { value: 'streamer', label: 'Streamers', emoji: '📺' },
  { value: 'longform', label: 'Long Form / YouTubers', emoji: '🎬' },
  { value: 'shortform', label: 'Short Form Creators', emoji: '📱' },
  { value: 'podcast', label: 'Podcasters', emoji: '🎙️' },
  { value: 'photographer', label: 'Photographers', emoji: '📸' },
  { value: 'videographer', label: 'Videographers', emoji: '🎥' },
  { value: 'editor', label: 'Video Editors', emoji: '✂️' },
  MUSICIAN_GROUP, // cross-type: creators can look for musicians
  OPEN_TO_ANYTHING, // shown at the top of the screen (see looking.tsx)
];

// ---------- Your sound / your vibe ----------

export const GENRES: Option[] = [
  { value: 'hiphop', label: 'Hip Hop', emoji: '🎧' },
  { value: 'pop', label: 'Pop', emoji: '🎵' },
  { value: 'rnb', label: 'R&B / Soul', emoji: '🎤' },
  { value: 'electronic', label: 'Electronic / EDM', emoji: '🎛️' },
  { value: 'rock', label: 'Rock', emoji: '🎸' },
  { value: 'indie', label: 'Indie', emoji: '🌙' },
  { value: 'latin', label: 'Latin', emoji: '💃' },
  { value: 'afrobeats', label: 'Afrobeats', emoji: '🌍' },
  { value: 'country', label: 'Country', emoji: '🤠' },
  { value: 'jazz', label: 'Jazz', emoji: '🎷' },
  { value: 'classical', label: 'Classical', emoji: '🎻' },
];

export const INTERESTS: Option[] = [
  { value: 'music', label: 'Music', emoji: '🎵' },
  { value: 'comedy', label: 'Comedy', emoji: '😂' },
  { value: 'gaming', label: 'Gaming', emoji: '🎮' },
  { value: 'vlog', label: 'Vlog / Lifestyle', emoji: '📹' },
  { value: 'fashion', label: 'Fashion', emoji: '👗' },
  { value: 'fitness', label: 'Fitness', emoji: '💪' },
  { value: 'culinary', label: 'Food', emoji: '🍳' },
  { value: 'travel', label: 'Travel', emoji: '✈️' },
  { value: 'tech', label: 'Tech', emoji: '💻' },
  { value: 'educational', label: 'Educational', emoji: '📚' },
  { value: 'sports', label: 'Sports', emoji: '🏀' },
  { value: 'art', label: 'Art / Design', emoji: '🎨' },
];

// ---------- Showcase prompts ----------

/** Prompt picker tabs: "About my work" helps people decide if they'd work well together; "Just for fun" keeps personality. */
export type PromptGroups = { work: string[]; fun: string[] };

export const MUSICIAN_PROMPTS: PromptGroups = {
  work: [
    'What I’m working on right now...',
    'My goal for the next few months...',
    'A project I want to make happen...',
    'My ideal session looks like...',
    'What I bring to a collab...',
    'My creative process looks like...',
    'My setup / where I create...',
    'My sound in 3 artists...',
    'A project I’m proud of...',
    'Credits or wins so far...',
  ],
  fun: [
    'My biggest musical influence is...',
    'The vibe I’m going for in my music',
    'If I could collab with anyone, living or dead...',
    'A song I wish I’d made...',
    'A song or lyric that resonates with me',
    'Top 3 albums of all time',
    'My favorite era of music',
    'New styles I want to explore',
  ],
};

export const CONTENT_PROMPTS: PromptGroups = {
  work: [
    'What I’m working on right now...',
    'My goal for the next few months...',
    'A project I’d love to work on',
    'My ideal shoot or session looks like...',
    'What I bring to a collab...',
    'My creative process looks like...',
    'My setup / gear...',
    'My style in 3 creators...',
    'The content I’m most proud of',
    'Wins so far (views, brands, features)...',
  ],
  fun: [
    'What inspires me to create',
    'If I could collab with any creator...',
    'The vibe I’m going for',
    'What makes my content unique',
    'My creative vision is...',
    'New styles or formats I want to explore',
    'A trend I’d bring back...',
  ],
};

export const SHOWCASE = {
  /** Kam's rule: at least one item to continue, up to six. */
  minItems: 1,
  slots: ['media', 'prompt', 'media', 'prompt', 'media', 'prompt'] as const,
  maxUploadMB: 30,
  promptMaxChars: 250,
};

export const BIO_MAX_CHARS = 500;
export const DEFAULT_RADIUS_MILES = 50;

export const LINK_PLATFORMS: { match: RegExp; platform: string; label: string; emoji: string }[] = [
  { match: /spotify\.com/i, platform: 'spotify', label: 'Spotify', emoji: '🟢' },
  { match: /soundcloud\.com/i, platform: 'soundcloud', label: 'SoundCloud', emoji: '🟠' },
  { match: /(youtube\.com|youtu\.be)/i, platform: 'youtube', label: 'YouTube', emoji: '▶️' },
  { match: /tiktok\.com/i, platform: 'tiktok', label: 'TikTok', emoji: '🎵' },
  { match: /instagram\.com/i, platform: 'instagram', label: 'Instagram', emoji: '📸' },
  { match: /music\.apple\.com/i, platform: 'applemusic', label: 'Apple Music', emoji: '🍎' },
];

/** Accepts "open.spotify.com/…" without https:// and returns a full URL, or null if it isn't one. */
export function normalizeUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  const withScheme = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  try {
    const u = new URL(withScheme);
    return u.hostname.includes('.') ? u.toString() : null;
  } catch {
    return null;
  }
}

export function detectPlatform(url: string) {
  return LINK_PLATFORMS.find((p) => p.match.test(url)) ?? { platform: 'link', label: 'Link', emoji: '🔗' };
}
