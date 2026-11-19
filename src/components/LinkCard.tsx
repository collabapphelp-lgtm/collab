import { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { cleanMediaTitle, detectPlatform } from '@/lib/onboarding-data';
import { linkSubtitle, spotifyKind, useLinkPreview } from '@/lib/link-preview';
import type { ShowcaseMedia } from '@/lib/types';
import { EmbedPlayer } from '@/components/EmbedPlayer';
import { embedFor } from '@/lib/embed';
import { fonts, makeStyles, useColors } from '@/lib/theme';

const GOLD = '#F2C14E';

const BRAND: Record<string, { icon: keyof typeof MaterialCommunityIcons.glyphMap; color: string; verb: string }> = {
  spotify: { icon: 'spotify', color: '#1DB954', verb: 'Open in Spotify' },
  youtube: { icon: 'youtube', color: '#FF0033', verb: 'Watch on YouTube' },
  soundcloud: { icon: 'soundcloud', color: '#FF5500', verb: 'Listen on SoundCloud' },
  applemusic: { icon: 'apple', color: '#FA2D48', verb: 'Open in Apple Music' },
  instagram: { icon: 'instagram', color: '#D6249F', verb: 'Open in Instagram' },
  tiktok: { icon: 'music-note', color: '#111111', verb: 'Open in TikTok' },
};

/** Opens the platform's own app when it's installed (Spotify, YouTube…), otherwise an in-app browser. */
export function openLink(url: string) {
  Linking.openURL(url).catch(() => WebBrowser.openBrowserAsync(url).catch(() => {}));
}

/**
 * A pasted link on a profile, with the real artwork and title.
 * `featured` is the big dark card at the top of a profile; otherwise a light row.
 */
export function LinkCard({ item, featured, label = 'FEATURED' }: { item: ShowcaseMedia; featured?: boolean; label?: string }) {
  const styles = useStyles();
  const colors = useColors();
  const platform = detectPlatform(item.url);
  const brand = BRAND[platform.platform] ?? { icon: 'link-variant' as const, color: colors.blue, verb: 'Open link' };
  const p = useLinkPreview(item.url, platform.platform);
  const title = cleanMediaTitle(item.title) ?? p?.title ?? `${platform.label} link`;
  const sub = linkSubtitle(item.url, platform.label, p);
  const wide = platform.platform === 'youtube';
  const round = spotifyKind(item.url) === 'artist';
  const embed = embedFor(item.url);
  const [playing, setPlaying] = useState(false);
  const kind = spotifyKind(item.url);
  const playVerb = kind === 'artist' ? 'Play top songs' : kind && kind !== 'track' && kind !== 'episode' ? 'Play' : platform.platform === 'youtube' ? 'Watch' : 'Play';
  // Playable links play right here; the rest open the platform's app.
  const onPress = embed ? () => setPlaying((v) => !v) : () => openLink(item.url);

  const art = p?.image ? (
    <Image
      source={{ uri: p.image }}
      style={[featured ? styles.artBig : styles.art, wide && (featured ? styles.artBigWide : styles.artWide), round && { borderRadius: 999 }]}
      contentFit="cover"
      transition={200}
    />
  ) : (
    <View style={[featured ? styles.artBig : styles.art, styles.artEmpty, { backgroundColor: `${brand.color}22` }]}>
      <MaterialCommunityIcons name={brand.icon} size={featured ? 34 : 24} color={brand.color} />
    </View>
  );

  const a11y = `${title}, ${sub}. ${embed ? (playing ? 'Hide player' : playVerb) : brand.verb}.`;
  return (
    // The player sits outside the tappable parts so its own controls get the touches.
    <View style={featured ? styles.featured : styles.row}>
      <Pressable onPress={onPress} accessibilityRole={embed ? 'button' : 'link'} accessibilityLabel={a11y} style={({ pressed }) => [styles.head, pressed && { opacity: 0.85 }]}>
        {featured ? <Text style={styles.label}>{label}</Text> : null}
        <View style={styles.line}>
          {art}
          <View style={styles.flex}>
            <Text style={featured ? styles.titleBig : styles.title} numberOfLines={2}>
              {title}
            </Text>
            <View style={styles.subRow}>
              <MaterialCommunityIcons name={brand.icon} size={14} color={brand.color} />
              <Text style={featured ? styles.subBig : styles.sub} numberOfLines={1}>
                {sub}
              </Text>
            </View>
          </View>
          {embed ? (
            <View style={[styles.playDot, { backgroundColor: brand.color }, featured && !playing && { display: 'none' }]}>
              <MaterialCommunityIcons name={playing ? 'chevron-up' : 'play'} size={20} color="rgb(255,255,255)" />
            </View>
          ) : featured ? null : (
            <MaterialCommunityIcons name="open-in-new" size={18} color={colors.textMuted} />
          )}
        </View>
      </Pressable>
      {playing && embed ? (
        <>
          <EmbedPlayer embed={embed} />
          <Pressable onPress={() => openLink(item.url)} hitSlop={8} style={styles.openRow} accessibilityRole="link">
            <MaterialCommunityIcons name={brand.icon} size={14} color={brand.color} />
            <Text style={featured ? styles.openTextDark : styles.openText}>{brand.verb}</Text>
          </Pressable>
        </>
      ) : featured ? (
        <Pressable onPress={onPress} accessibilityElementsHidden importantForAccessibility="no" style={({ pressed }) => [styles.cta, { backgroundColor: brand.color }, pressed && { opacity: 0.85 }]}>
          <MaterialCommunityIcons name={embed && platform.platform === 'youtube' ? 'play' : brand.icon} size={18} color="rgb(255,255,255)" />
          <Text style={styles.ctaText}>{embed ? playVerb : brand.verb}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  flex: { flex: 1, gap: 4 },
  featured: { backgroundColor: '#17151F', borderRadius: 22, padding: 16, gap: 14 },
  row: { padding: 12, borderRadius: 18, backgroundColor: colors.white, gap: 12 },
  playDot: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  openRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: -4 },
  openText: { fontFamily: fonts.bodySemibold, fontSize: 13, color: colors.textSecondary },
  openTextDark: { fontFamily: fonts.bodySemibold, fontSize: 13, color: '#B9B3C9' },
  head: { gap: 14 },
  label: { fontFamily: fonts.bodySemibold, fontSize: 11, letterSpacing: 1.8, color: GOLD },
  line: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  art: { width: 56, height: 56, borderRadius: 12, backgroundColor: colors.bgSecondary },
  artWide: { width: 88, height: 50 },
  artBig: { width: 88, height: 88, borderRadius: 16, backgroundColor: '#2A2735' },
  artBigWide: { width: 128, height: 72 },
  artEmpty: { alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.bodySemibold, fontSize: 16, color: colors.text },
  titleBig: { fontFamily: fonts.heading, fontSize: 20, lineHeight: 24, color: 'rgb(255,255,255)' },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  sub: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary, flexShrink: 1 },
  subBig: { fontFamily: fonts.body, fontSize: 13, color: '#B9B3C9', flexShrink: 1 },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 44, borderRadius: 999 },
  ctaText: { fontFamily: fonts.bodySemibold, fontSize: 15, color: 'rgb(255,255,255)' },
}));
