// Collab brand tokens — kept in sync with the web prototype's CSS variables.
//
// Dark mode: the app follows the phone's Light/Dark setting. Styles are written once, for light,
// with `makeStyles((colors) => ({ ... }))`; the dark version is derived automatically:
//   - light backgrounds and borders (white, cream, pale tints) become dark surfaces, keeping their hue
//   - dark text becomes light text, keeping its hue
//   - everything else (brand colors, photo overlays, white text on color) stays as it is
// To opt a color out of the automatic swap, write it as `rgb(r,g,b)` instead of hex (see `colors.ink`).
import { useSyncExternalStore } from 'react';
import { AppState, Appearance, StyleSheet, type ImageStyle, type TextStyle, type ViewStyle } from 'react-native';

export type Scheme = 'light' | 'dark';

const light = {
  yellow: '#E5C547',
  gold: '#F5B731',
  blue: '#4BA3C7',
  purple: '#A399C7',
  red: '#E54B4B',
  orange: '#D97742',
  teal: '#4DBFBF',

  bg: '#FFFFFF',
  bgSecondary: '#F8F9FA',
  text: '#1A1A1A',
  textSecondary: '#666666',
  textMuted: '#999999',
  border: '#E8E8E8',
  white: '#FFFFFF',
  /** Dark text that stays dark in dark mode: for text on yellow/gold buttons and other bright fills. */
  ink: 'rgb(26,26,26)',
  /** Selected-chip fill and its text: dark slate in light mode, near-white in dark mode. */
  inverse: 'rgb(42,59,77)',
  onInverse: 'rgb(255,255,255)',
};

export type Palette = typeof light;

const dark: Palette = {
  ...light,
  blue: '#5DB3D6',
  purple: '#B3A9D9',
  bg: '#101216',
  bgSecondary: '#171A1F',
  text: '#ECEDEF',
  textSecondary: '#A9ADB4',
  textMuted: '#7C818A',
  border: '#2A2E35',
  white: '#FFFFFF', // white text stays white; white *backgrounds* are swapped by the adapter below
  inverse: 'rgb(236,237,239)',
  onInverse: 'rgb(23,26,31)',
};

export const palettes: Record<Scheme, Palette> = { light, dark };

/** Light palette. Only for code that runs outside components; inside components use `useColors()`. */
export const colors = light;

export const gradients = {
  welcome: ['#C5DAE8', '#E8E5DC'] as const,
  primaryButton: [light.yellow, light.gold] as const,
};

export const radius = { sm: 8, md: 16, full: 999 };

export const fonts = {
  // Loaded in src/app/_layout.tsx
  body: 'Outfit_400Regular',
  bodyMedium: 'Outfit_500Medium',
  bodySemibold: 'Outfit_600SemiBold',
  heading: 'SpaceGrotesk_700Bold',
};

export const shadow = {
  shadowColor: '#000',
  shadowOpacity: 0.08,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 2 },
  elevation: 3,
};

// ---------- Which scheme is on ----------
// iOS briefly reports the other scheme while the app is in the background (to snapshot it for
// the app switcher), so changes only apply while the app is active.

let current: Scheme = Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
const listeners = new Set<() => void>();

function refresh() {
  if (AppState.currentState !== 'active' && AppState.currentState != null) return;
  const next: Scheme = Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
  if (next === current) return;
  current = next;
  listeners.forEach((l) => l());
}
Appearance.addChangeListener(refresh);
AppState.addEventListener('change', (s) => s === 'active' && refresh());

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useScheme(): Scheme {
  return useSyncExternalStore(subscribe, () => current, () => current);
}

export function useColors(): Palette {
  return palettes[useScheme()];
}

// ---------- Light → dark color adapter ----------

type RGBA = { r: number; g: number; b: number; a: number };

function parse(c: string): RGBA | null {
  const s = c.trim();
  if (s[0] === '#') {
    let h = s.slice(1);
    if (h.length === 3 || h.length === 4) h = h.split('').map((x) => x + x).join('');
    if (h.length !== 6 && h.length !== 8) return null;
    const n = parseInt(h, 16);
    if (Number.isNaN(n)) return null;
    return h.length === 6
      ? { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 }
      : { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: parseInt(h.slice(6, 8), 16) / 255 };
  }
  // Only rgba() takes part; plain rgb() is the opt-out notation.
  const m = /^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/i.exec(s);
  return m ? { r: +m[1], g: +m[2], b: +m[3], a: +m[4] } : null;
}

function toHsl({ r, g, b }: RGBA) {
  const R = r / 255, G = g / 255, B = b / 255;
  const max = Math.max(R, G, B), min = Math.min(R, G, B);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === R ? (G - B) / d + (G < B ? 6 : 0) : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  return { h: h * 60, s, l };
}

function fromHsl(h: number, s: number, l: number, a: number) {
  const k = (n: number) => (n + h / 30) % 12;
  const f = (n: number) => l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  const hex = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0');
  const out = `#${hex(f(0))}${hex(f(8))}${hex(f(4))}`;
  return a < 1 ? `${out}${hex(a)}` : out;
}

/** A light-mode background/border color, as it should look in dark mode. */
export function darkBg(c: string): string {
  const p = parse(c);
  if (!p) return c;
  // Faint dark washes (hairlines, inactive dots) flip to faint light washes.
  if (p.r + p.g + p.b < 200 && p.a <= 0.3) return `rgba(255,255,255,${Math.min(0.9, p.a * 1.2).toFixed(2)})`;
  return darkSurface(c);
}

/** Like darkBg, but leaves dark washes alone (gradients over photos). */
export function darkSurface(c: string): string {
  const p = parse(c);
  if (!p) return c;
  const { h, s, l } = toHsl(p);
  if (l < 0.8) return c;
  const nl = Math.min(0.3, 0.075 + (1 - l) * 1.5);
  // Neutrals get a hint of cool blue so they don't look flat grey.
  return s < 0.08 ? fromHsl(222, 0.12, nl, p.a) : fromHsl(h, Math.min(s, 0.45), nl + 0.01, p.a);
}

/** A light-mode text/icon color, as it should look in dark mode. */
export function darkFg(c: string): string {
  const p = parse(c);
  if (!p) return c;
  const { h, s, l } = toHsl(p);
  if (l > 0.5) return c;
  return fromHsl(h, Math.min(s, 0.55), 1 - l * 0.85, p.a);
}

const BG_KEYS = new Set([
  'backgroundColor',
  'borderColor',
  'borderTopColor',
  'borderBottomColor',
  'borderLeftColor',
  'borderRightColor',
  'borderStartColor',
  'borderEndColor',
  'overlayColor',
]);
const FG_KEYS = new Set(['color', 'tintColor', 'textDecorationColor', 'placeholderTextColor']);

function adaptStyle(style: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(style)) {
    if (typeof v === 'string' && BG_KEYS.has(k)) out[k] = darkBg(v);
    else if (typeof v === 'string' && FG_KEYS.has(k)) out[k] = darkFg(v);
    else out[k] = v;
  }
  return out;
}

type NamedStyles<T> = { [P in keyof T]: ViewStyle | TextStyle | ImageStyle };

/**
 * `const useStyles = makeStyles((colors) => ({ ... }))`, then `const styles = useStyles()` inside the component.
 * Both versions are built once, up front.
 */
export function makeStyles<T extends NamedStyles<T> | NamedStyles<any>>(factory: (colors: Palette) => T & NamedStyles<any>): () => T {
  const lightStyles = StyleSheet.create(factory(light));
  const raw = factory(dark) as Record<string, Record<string, unknown>>;
  const darkStyles = StyleSheet.create(
    Object.fromEntries(Object.entries(raw).map(([name, s]) => [name, adaptStyle(s)])) as unknown as T,
  );
  return function useStyles() {
    return useScheme() === 'dark' ? darkStyles : lightStyles;
  };
}

/** For colors used outside a stylesheet (icon colors, gradients, inline styles). */
export function useTheme() {
  const scheme = useScheme();
  const dark = scheme === 'dark';
  return {
    scheme,
    dark,
    colors: palettes[scheme],
    /** Background/border color: adapts in dark mode. */
    bg: (c: string) => (dark ? darkBg(c) : c),
    /** Text/icon color: adapts in dark mode. */
    fg: (c: string) => (dark ? darkFg(c) : c),
  };
}
