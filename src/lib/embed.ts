// Which pasted links can play inside the app, and the player URL + height for each.
import { spotifyKind } from './link-preview';

export type Embed = { src: string; height?: number; aspect?: number };

export function embedFor(url: string): Embed | null {
  const k = spotifyKind(url);
  if (k) {
    const id = /\/(?:artist|track|album|playlist|episode|show)\/([A-Za-z0-9]+)/.exec(url)?.[1];
    if (!id) return null;
    // Songs and episodes get the compact player; artists/albums/playlists show their track list.
    return { src: `https://open.spotify.com/embed/${k}/${id}?utm_source=generator&theme=0`, height: k === 'track' || k === 'episode' ? 152 : 380 };
  }
  const yt =
    /youtu\.be\/([\w-]{11})/.exec(url)?.[1] ??
    /youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)([\w-]{11})/.exec(url)?.[1];
  if (yt) return { src: `https://www.youtube-nocookie.com/embed/${yt}?playsinline=1&rel=0`, aspect: /shorts\//.test(url) ? 9 / 16 : 16 / 9 };
  if (/soundcloud\.com\/[^/]+\/[^/?]+/.test(url) && !/on\.soundcloud\.com/.test(url)) {
    return { src: `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&color=%23F2C14E&auto_play=true&visual=false&show_comments=false`, height: 166 };
  }
  return null;
}

/** The page the player loads in: the platform's official iframe, full width. */
export function embedHtml(src: string) {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;padding:0;height:100%;background:transparent;overflow:hidden}iframe{border:0;width:100%;height:100%;border-radius:12px}</style></head><body><iframe src="${src}" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" allowfullscreen></iframe></body></html>`;
}

/** Players need a real https origin (YouTube refuses to play without one). */
export const EMBED_ORIGIN = 'https://collab-609ac.web.app';
