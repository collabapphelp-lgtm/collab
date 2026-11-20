// Real titles and artwork for pasted links (Spotify, YouTube, SoundCloud…), so a profile shows
// "Velvet · Song on Spotify" with its cover instead of "Spotify link". Uses each site's public
// oEmbed endpoint (no keys), falling back to the page's og: tags. Cached on the phone for a week.
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type LinkPreview = { title?: string; author?: string; image?: string };

const OEMBED: Record<string, (u: string) => string> = {
  spotify: (u) => `https://open.spotify.com/oembed?url=${encodeURIComponent(u)}`,
  youtube: (u) => `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(u)}`,
  soundcloud: (u) => `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(u)}`,
  tiktok: (u) => `https://www.tiktok.com/oembed?url=${encodeURIComponent(u)}`,
};

/** What a Spotify link points at: an artist page, a song, an album… */
export function spotifyKind(url: string): 'artist' | 'track' | 'album' | 'playlist' | 'episode' | 'show' | null {
  const m = /open\.spotify\.com\/(?:intl-[a-z-]+\/)?(artist|track|album|playlist|episode|show)\//i.exec(url);
  return m ? (m[1].toLowerCase() as ReturnType<typeof spotifyKind>) : null;
}

const SPOTIFY_KIND_LABEL = { artist: 'Artist', track: 'Song', album: 'Album', playlist: 'Playlist', episode: 'Episode', show: 'Podcast' };

/** "Song on Spotify", "Artist on Spotify", "Sam Rivers on YouTube". */
export function linkSubtitle(url: string, platformLabel: string, p?: LinkPreview | null) {
  const k = spotifyKind(url);
  if (k) return `${SPOTIFY_KIND_LABEL[k]} on Spotify`;
  return p?.author ? `${p.author} on ${platformLabel}` : platformLabel;
}

const mem = new Map<string, LinkPreview | null>();
const KEY = (u: string) => `collab.linkpreview.v1:${u}`;
const WEEK = 7 * 24 * 3600 * 1000;

function meta(html: string, prop: string) {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']+)["']`, 'i');
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${prop}["']`, 'i');
  const v = re.exec(html)?.[1] ?? re2.exec(html)?.[1];
  return v?.replace(/&amp;/g, '&').replace(/&#39;|&#x27;/g, '’').replace(/&quot;/g, '"');
}

async function fetchPreview(url: string, platform: string): Promise<LinkPreview | null> {
  // Design previews run offline: show sample artwork.
  if (process.env.EXPO_PUBLIC_SHOT_PHOTOS === '1')
    return platform === 'youtube'
      ? { image: '/shots/andre.jpg', author: 'Tasha Reed' }
      : platform === 'instagram'
        ? { image: '/shots/jordan.jpg', author: 'Tasha Reed' }
        : { image: '/shots/cover.jpg', author: 'Maya Brooks' };
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 8000);
  try {
    const endpoint = OEMBED[platform];
    if (endpoint) {
      const r = await fetch(endpoint(url), { signal: ctl.signal });
      if (r.ok) {
        const j = (await r.json()) as { title?: string; author_name?: string; thumbnail_url?: string };
        // SoundCloud titles read "Song by Artist"; the artist is shown separately.
        const title = platform === 'soundcloud' && j.author_name ? j.title?.replace(new RegExp(` by ${j.author_name}$`), '') : j.title;
        return { title: title || undefined, author: j.author_name || undefined, image: j.thumbnail_url || undefined };
      }
    }
    const r = await fetch(url, { signal: ctl.signal });
    if (!r.ok) return null;
    const html = (await r.text()).slice(0, 200_000);
    const title = meta(html, 'og:title');
    const image = meta(html, 'og:image');
    return title || image ? { title, image } : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export async function getLinkPreview(url: string, platform: string): Promise<LinkPreview | null> {
  if (mem.has(url)) return mem.get(url) ?? null;
  try {
    const raw = await AsyncStorage.getItem(KEY(url));
    if (raw) {
      const c = JSON.parse(raw) as { at: number; p: LinkPreview | null };
      if (Date.now() - c.at < WEEK) {
        mem.set(url, c.p);
        return c.p;
      }
    }
  } catch {
    // ignore a bad cache entry
  }
  const p = await fetchPreview(url, platform);
  mem.set(url, p);
  // Only keep real results; a failed lookup is retried next time the app opens.
  if (p) AsyncStorage.setItem(KEY(url), JSON.stringify({ at: Date.now(), p })).catch(() => {});
  return p;
}

/** The preview for a link, or null while loading / when there isn't one. */
export function useLinkPreview(url: string | null, platform: string): LinkPreview | null {
  const [state, setState] = useState<{ url: string | null; p: LinkPreview | null }>(() => ({ url, p: url ? mem.get(url) ?? null : null }));
  useEffect(() => {
    if (!url || mem.has(url)) return;
    let live = true;
    getLinkPreview(url, platform).then((p) => live && setState({ url, p }));
    return () => {
      live = false;
    };
  }, [url, platform]);
  if (!url) return null;
  return state.url === url ? state.p : mem.get(url) ?? null;
}
