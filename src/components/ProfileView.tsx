import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from '@/components/ThemedGradient';
import * as WebBrowser from 'expo-web-browser';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Avatar, HeroPhoto } from '@/components/Avatar';
import { detectPlatform, INSTRUMENT_TYPES } from '@/lib/onboarding-data';
import { canonicalList, fullName, lookingOptionFor, optionFor, roleLine, shortLocation } from '@/lib/labels';
import { accentFor } from '@/lib/accent';
import type { ShowcaseItem, ShowcaseMedia, UserProfile } from '@/lib/types';
import { fonts, radius, makeStyles, useColors } from '@/lib/theme';

type Props = {
  profile: UserProfile;
  /** e.g. "6 mi away". Falls back to their city. */
  distanceLabel?: string;
  /** "Why you're seeing this" chips (Discover only). */
  reasons?: string[];
  /** Rendered at the very top-right of the hero (e.g. a close button). */
  heroAccessory?: ReactNode;
  /** Rendered right under the hero (e.g. Profile strength on your own profile). */
  belowHero?: ReactNode;
  /** Viewing your own profile: section titles say "Your" instead of "Their". */
  isSelf?: boolean;
  /** Photo height. Discover uses a shorter one so more of the profile shows without scrolling. */
  heroHeight?: number;
  /**
   * 'work' (Discover): a small photo and name up top so the work, prompts and bio lead.
   * 'hero' (default): the big Spotlight photo.
   */
  layout?: 'hero' | 'work';
  /** Shown after everything else (e.g. events they're going to). */
  footer?: ReactNode;
};

const GOLD = '#F2C14E';
const PAGE = '#F7F5F0';

/**
 * One person's full profile, "Spotlight" style: the photo fades into a color taken from their sound,
 * their first track is featured, prompts read big, everything else as clean chips.
 */
export function ProfileView({ profile, distanceLabel, reasons, heroAccessory, belowHero, isSelf, heroHeight = 460, layout = 'hero', footer }: Props) {
  const styles = useStyles();
  const colors = useColors();
  const workFirst = layout === 'work';
  const name = fullName(profile);
  const isContent = profile.creatorType === 'content';
  const tastes = isContent ? profile.interests : profile.genres;
  const accent = accentFor(profile);
  const looking = profile.lookingFor ?? [];
  const showcase = profile.showcase ?? [];
  const media = showcase.filter((s): s is ShowcaseMedia => s.type === 'media');
  const featured = media.find((m) => !(m.source === 'upload' && m.mediaKind === 'image')) ?? null;
  const rest = showcase.filter((s) => s !== featured);

  // Exact types replace their family ("Woodwinds" + Saxophone → "Saxophone"); DAWs ride along.
  const types = profile.instrumentTypes ?? [];
  const instruments = [
    ...canonicalList(profile.instruments).flatMap((fam) => {
      const picked = (INSTRUMENT_TYPES[fam] ?? []).filter((o) => types.includes(o.value));
      return picked.length ? picked.map((o) => o.label) : [optionFor(fam).label];
    }),
    ...(profile.instrumentsSpecific ?? []),
    ...(profile.daws ?? []).filter((d) => d !== 'daw:other').map((d) => optionFor(d).label),
  ];
  const isGroup = profile.profileKind === 'group';
  const intents = (profile.intents ?? []).map((i) => optionFor(i).label);
  const experience = profile.experience ? optionFor(profile.experience).label : null;
  const soundLine = [...(tastes ?? []).map((t) => optionFor(t).label), ...(profile.soundsCustom ?? [])]
    .slice(0, 3)
    .join(' · ')
    .toUpperCase();
  const where = distanceLabel ?? shortLocation(profile.location);
  const lookingItems = looking
    .flatMap((v) => {
      // Picked specifics? Show just those ("Piano", "Videographers"), not "Instrument Players: Piano".
      const details = canonicalList(profile.lookingForDetails?.[v]);
      // Exact instruments replace their family ("Strings" + Cello → "Cello").
      const shown = details.filter((d) => {
        const famTypes = (INSTRUMENT_TYPES[d] ?? []).map((o) => o.value);
        return !famTypes.some((t) => details.includes(t));
      });
      return shown.length ? shown.map((d) => lookingOptionFor(d).label) : [lookingOptionFor(v).label];
    })
    .concat(profile.lookingForSpecific ?? []);

  return (
    <View style={styles.wrap}>
      {workFirst ? (
        <View style={[styles.compactHead, { backgroundColor: accent }]}>
          <View style={styles.compactRow}>
            <Avatar uri={profile.photoURL} name={name} seed={profile.id} size={84} radius={22} style={styles.compactPhoto} />
            <View style={styles.flex}>
              {soundLine ? (
                <Text style={styles.soundLineSmall} numberOfLines={1}>
                  {soundLine}
                </Text>
              ) : null}
              <Text style={styles.compactName} numberOfLines={2}>
                {name}
              </Text>
              <Text style={styles.compactRole} numberOfLines={2}>
                {isGroup ? `Band / group${profile.groupSize ? ` · ${profile.groupSize}` : ''} · ` : ''}
                {roleLine(profile, 3)}
              </Text>
              {where ? (
                <View style={styles.compactWhere}>
                  <MaterialCommunityIcons name="map-marker-outline" size={13} color={colors.white} />
                  <Text style={styles.compactWhereText}>{where}</Text>
                </View>
              ) : null}
            </View>
          </View>
          {heroAccessory ? <View style={styles.compactAccessory}>{heroAccessory}</View> : null}
        </View>
      ) : (
        <View style={[styles.hero, { height: heroHeight, backgroundColor: accent }]}>
          <HeroPhoto uri={profile.photoURL} name={name} seed={profile.id} />
          <LinearGradient colors={['rgba(0,0,0,0.25)', 'transparent']} style={styles.heroTop} />
          <LinearGradient colors={['transparent', accent + 'E6', accent]} locations={[0, 0.7, 1]} style={styles.heroShade} />
          {heroAccessory ? <View style={styles.heroAccessory}>{heroAccessory}</View> : null}
          <View style={styles.heroText}>
            {soundLine ? <Text style={styles.soundLine}>{soundLine}</Text> : null}
            <Text style={styles.name} numberOfLines={2}>
              {name}
            </Text>
            <Text style={styles.role}>
              {isGroup ? `Band / group${profile.groupSize ? ` · ${profile.groupSize} members` : ''} · ` : ''}
              {roleLine(profile, 3)}
            </Text>
            {where ? (
              <View style={styles.wherePill}>
                <MaterialCommunityIcons name="map-marker-outline" size={14} color={colors.white} />
                <Text style={styles.whereText}>{where}</Text>
              </View>
            ) : null}
          </View>
        </View>
      )}

      <View style={styles.body}>
        {belowHero}

        {workFirst && featured ? <FeaturedTrack item={featured} /> : null}

        {workFirst && profile.bio ? (
          <View style={styles.prompt}>
            <Text style={styles.promptQ}>What I’m looking for in a collab partner</Text>
            <Text style={styles.bioBig}>{profile.bio}</Text>
          </View>
        ) : null}

        {workFirst ? rest.map((item, i) => <ShowcaseCard key={i} item={item} />) : null}

        {reasons && reasons.length > 0 ? (
          <View style={styles.reasons}>
            <Text style={styles.reasonsTitle}>Why you two fit</Text>
            {reasons.map((r) => (
              <View key={r} style={styles.reasonRow}>
                <MaterialCommunityIcons name="star-four-points" size={13} color="#B7791F" />
                <Text style={styles.reasonText}>{r}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {intents.length > 0 || experience ? (
          <Section title={isSelf ? 'You’re here to' : 'Here to'}>
            <View style={styles.chips}>
              {intents.map((t) => (
                <View key={t} style={[styles.chip, { backgroundColor: accent, borderColor: accent }]}>
                  <Text style={[styles.chipText, { color: colors.white }]}>{t}</Text>
                </View>
              ))}
              {experience ? (
                <View style={[styles.chip, styles.chipLight]}>
                  <Text style={styles.chipText}>{experience}</Text>
                </View>
              ) : null}
            </View>
          </Section>
        ) : null}

        {!workFirst && featured ? <FeaturedTrack item={featured} /> : null}

        {!workFirst
          ? rest.map((item, i) => (
              <ShowcaseCard key={i} item={item} />
            ))
          : null}

        {instruments.length > 0 ? (
          <Section title={profile.instruments?.length ? (isSelf ? 'You play' : 'Plays') : 'Works in'}>
            <ChipRow items={instruments} />
          </Section>
        ) : null}

        {lookingItems.length > 0 || (profile.bio && !workFirst) ? (
          <Section title="Looking to collab with">
            {lookingItems.length > 0 ? <ChipRow items={lookingItems} tone="blue" /> : null}
            {profile.bio && !workFirst ? <Text style={styles.bio}>{profile.bio}</Text> : null}
          </Section>
        ) : null}

        {tastes?.length || profile.soundsCustom?.length || profile.openToAll ? (
          <Section title={`${isSelf ? 'Your' : 'Their'} ${isContent ? 'vibe' : 'sound'}`}>
            <ChipRow
              items={[
                ...(tastes ?? []).map((t) => optionFor(t).label),
                ...(profile.soundsCustom ?? []),
                ...(profile.openToAll ? ['Open to all'] : []),
              ]}
            />
          </Section>
        ) : null}
        {footer}
      </View>
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title.toUpperCase()}</Text>
      {children}
    </View>
  );
}

function ChipRow({ items, tone }: { items: string[]; tone?: 'blue' }) {
  const styles = useStyles();
  return (
    <View style={styles.chips}>
      {items.map((t) => (
        <View key={t} style={[styles.chip, tone === 'blue' ? styles.chipBlue : styles.chipLight]}>
          <Text style={[styles.chipText, tone === 'blue' && styles.chipBlueText]}>{t}</Text>
        </View>
      ))}
    </View>
  );
}

// A fixed-looking waveform per track (decorative; not real levels).
function bars(seed: string, n = 30) {
  let h = 7;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return Array.from({ length: n }, (_, i) => {
    h = (h * 1103515245 + 12345) >>> 0;
    return 0.3 + 0.7 * Math.abs(Math.sin(i / 2.7 + ((h >>> 16) % 7)));
  });
}

function mediaMeta(item: ShowcaseMedia) {
  const platform = item.source === 'link' ? detectPlatform(item.url) : null;
  const kind = platform ? platform.label : item.mediaKind === 'audio' ? 'Audio' : item.mediaKind === 'image' ? 'Photo' : 'Video';
  return { kind, title: item.title ?? (platform ? `${kind} link` : `${kind} snippet`) };
}

/** Uploaded audio files (and direct links to audio files) play right here instead of opening a browser. */
function isPlayable(item: ShowcaseMedia) {
  return item.mediaKind === 'audio' || /\.(mp3|m4a|wav|aac)(\?|$)/i.test(item.url);
}

// Only one track plays at a time across the screen.
let pauseCurrent: (() => void) | null = null;

function useInlineAudio(url: string) {
  const [started, setStarted] = useState(false);
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    if (status.didJustFinish) {
      player.pause();
      player.seekTo(0).catch(() => {});
    }
  }, [status.didJustFinish, player]);

  async function toggle() {
    if (status.playing) return player.pause();
    pauseCurrent?.();
    pauseCurrent = () => player.pause();
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(() => {});
    if (!started) {
      player.replace({ uri: url });
      setStarted(true);
    }
    player.play();
  }

  return {
    toggle,
    playing: status.playing,
    loading: started && status.isBuffering && !status.playing,
    progress: started && status.duration > 0 ? Math.min(1, status.currentTime / status.duration) : 0,
    time: started && status.duration > 0 ? `${clock(status.currentTime)} / ${clock(status.duration)}` : null,
  };
}

function clock(sec: number) {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** The first track/video, big and dark, like a "now playing" card. */
function FeaturedTrack({ item }: { item: ShowcaseMedia }) {
  return isPlayable(item) ? <FeaturedAudio item={item} /> : <FeaturedLink item={item} />;
}

function FeaturedLink({ item }: { item: ShowcaseMedia }) {
  const styles = useStyles();
  const { kind, title } = mediaMeta(item);
  return (
    <Pressable
      onPress={() => WebBrowser.openBrowserAsync(item.url).catch(() => {})}
      accessibilityRole="link"
      accessibilityLabel={`Featured: ${title}. Opens ${kind}.`}
      style={({ pressed }) => [styles.featured, pressed && { opacity: 0.9 }]}
    >
      <FeaturedBody item={item} icon="play" progress={9 / 30} sub={kind} />
    </Pressable>
  );
}

function FeaturedAudio({ item }: { item: ShowcaseMedia }) {
  const styles = useStyles();
  const { title } = mediaMeta(item);
  const a = useInlineAudio(item.url);
  return (
    <Pressable
      onPress={a.toggle}
      accessibilityRole="button"
      accessibilityLabel={`${a.playing ? 'Pause' : 'Play'} ${title}`}
      style={({ pressed }) => [styles.featured, pressed && { opacity: 0.95 }]}
    >
      <FeaturedBody item={item} icon={a.playing ? 'pause' : a.loading ? 'dots-horizontal' : 'play'} progress={a.progress} sub={a.time ?? 'Tap to play'} />
    </Pressable>
  );
}

function FeaturedBody(props: { item: ShowcaseMedia; icon: 'play' | 'pause' | 'dots-horizontal'; progress: number; sub: string }) {
  const styles = useStyles();
  const { title } = mediaMeta(props.item);
  const wave = bars(props.item.url);
  return (
    <>
      <Text style={styles.featuredLabel}>FEATURED</Text>
      <View style={styles.featuredRow}>
        <View style={styles.featuredPlay}>
          <MaterialCommunityIcons name={props.icon} size={26} color="#17151F" />
        </View>
        <View style={styles.flex}>
          <Text style={styles.featuredTitle} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.featuredKind}>{props.sub}</Text>
        </View>
      </View>
      <View style={styles.wave}>
        {wave.map((v, i) => (
          <View key={i} style={[styles.waveBar, { height: 6 + v * 26, backgroundColor: i / wave.length < props.progress ? GOLD : '#5B5570' }]} />
        ))}
      </View>
    </>
  );
}

function AudioRow({ item }: { item: ShowcaseMedia }) {
  const styles = useStyles();
  const colors = useColors();
  const { kind, title } = mediaMeta(item);
  const a = useInlineAudio(item.url);
  return (
    <Pressable
      onPress={a.toggle}
      accessibilityRole="button"
      accessibilityLabel={`${a.playing ? 'Pause' : 'Play'} ${title}`}
      style={({ pressed }) => [styles.media, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.mediaIcon}>
        <MaterialCommunityIcons name={a.playing ? 'pause' : a.loading ? 'dots-horizontal' : 'play'} size={22} color={colors.blue} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.mediaTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.mediaKind}>{a.time ?? kind}</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${a.progress * 100}%` }]} />
        </View>
      </View>
    </Pressable>
  );
}

function ShowcaseCard({ item }: { item: ShowcaseItem }) {
  const styles = useStyles();
  const colors = useColors();
  if (item.type === 'prompt') {
    return (
      <View style={styles.prompt}>
        <Text style={styles.promptQ}>{item.question}</Text>
        <Text style={styles.promptA}>{item.answer}</Text>
      </View>
    );
  }

  if (item.source === 'upload' && item.mediaKind === 'image') {
    return (
      <View style={styles.mediaImageWrap}>
        <Image source={{ uri: item.url }} style={styles.mediaImage} contentFit="cover" transition={200} />
        {item.title ? <Text style={styles.mediaCaption}>{item.title}</Text> : null}
      </View>
    );
  }

  if (isPlayable(item)) return <AudioRow item={item} />;

  const { kind, title } = mediaMeta(item);
  return (
    <Pressable
      onPress={() => WebBrowser.openBrowserAsync(item.url).catch(() => {})}
      accessibilityRole="link"
      accessibilityLabel={`${title}. Opens ${kind}.`}
      style={({ pressed }) => [styles.media, pressed && { opacity: 0.8 }]}
    >
      <View style={styles.mediaIcon}>
        <MaterialCommunityIcons name={item.mediaKind === 'video' ? 'play-circle-outline' : 'music-note'} size={22} color={colors.blue} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.mediaTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.mediaKind}>{kind}</Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textMuted} />
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  flex: { flex: 1 },
  wrap: { backgroundColor: PAGE },
  hero: { justifyContent: 'flex-end', overflow: 'hidden' },
  heroTop: { position: 'absolute', left: 0, right: 0, top: 0, height: 120 },
  heroShade: { position: 'absolute', left: 0, right: 0, bottom: 0, top: '40%' },
  heroAccessory: { position: 'absolute', top: 12, right: 12 },
  compactHead: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16 },
  compactRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingRight: 36 },
  compactPhoto: { borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)' },
  compactAccessory: { position: 'absolute', top: 10, right: 10 },
  soundLineSmall: { fontFamily: fonts.bodySemibold, fontSize: 11, letterSpacing: 1.6, color: GOLD, marginBottom: 2 },
  compactName: { fontFamily: fonts.heading, fontSize: 24, lineHeight: 27, letterSpacing: -0.5, color: colors.white },
  compactRole: { fontFamily: fonts.bodySemibold, fontSize: 14, color: 'rgba(255,255,255,0.92)', marginTop: 2 },
  compactWhere: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
  compactWhereText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: 'rgba(255,255,255,0.9)' },
  bioBig: { fontFamily: fonts.heading, fontSize: 19, lineHeight: 25, letterSpacing: -0.2, color: colors.text },
  heroText: { paddingHorizontal: 20, paddingBottom: 22, gap: 6 },
  soundLine: { fontFamily: fonts.bodySemibold, fontSize: 12, letterSpacing: 2, color: GOLD },
  name: { fontFamily: fonts.heading, fontSize: 40, lineHeight: 42, letterSpacing: -1, color: colors.white },
  role: { fontFamily: fonts.bodySemibold, fontSize: 16, color: 'rgba(255,255,255,0.92)' },
  wherePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginTop: 4,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  whereText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.white },

  body: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 8, gap: 18 },
  reasons: { borderRadius: 18, padding: 16, gap: 6, backgroundColor: '#FBF1D6' },
  reasonsTitle: { fontFamily: fonts.heading, fontSize: 15, color: colors.text, marginBottom: 2 },
  reasonRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reasonText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.text },

  section: { gap: 10 },
  sectionTitle: { fontFamily: fonts.bodySemibold, fontSize: 12, letterSpacing: 1.5, color: colors.textSecondary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 13, paddingVertical: 7, borderRadius: radius.full, borderWidth: 1.5 },
  chipLight: { backgroundColor: colors.white, borderColor: '#E6E1D8' },
  chipBlue: { backgroundColor: '#E3F0F6', borderColor: '#E3F0F6' },
  chipBlueText: { color: '#1F5F7F' },
  chipText: { fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.text },

  featured: { backgroundColor: '#17151F', borderRadius: 22, padding: 16, gap: 12 },
  featuredLabel: { fontFamily: fonts.bodySemibold, fontSize: 11, letterSpacing: 1.8, color: GOLD },
  featuredRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featuredPlay: { width: 50, height: 50, borderRadius: 25, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center' },
  featuredTitle: { fontFamily: fonts.heading, fontSize: 19, color: colors.white },
  featuredKind: { fontFamily: fonts.body, fontSize: 13, color: '#B9B3C9' },
  wave: { flexDirection: 'row', alignItems: 'center', gap: 3, height: 34 },
  waveBar: { flex: 1, borderRadius: 2 },

  prompt: { padding: 18, borderRadius: 22, backgroundColor: colors.white, gap: 8 },
  promptQ: { fontFamily: fonts.body, fontSize: 14, color: colors.textSecondary },
  promptA: { fontFamily: fonts.heading, fontSize: 21, lineHeight: 27, letterSpacing: -0.2, color: colors.text },

  media: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, backgroundColor: colors.white },
  progressTrack: { height: 3, borderRadius: 2, backgroundColor: '#E3EEF4', marginTop: 6, overflow: 'hidden' },
  progressFill: { height: 3, backgroundColor: colors.blue },
  mediaIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#E3F0F6', alignItems: 'center', justifyContent: 'center' },
  mediaTitle: { fontFamily: fonts.bodySemibold, fontSize: 16, color: colors.text },
  mediaKind: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary },
  mediaImageWrap: { gap: 6 },
  mediaImage: { width: '100%', aspectRatio: 4 / 5, borderRadius: 22, backgroundColor: colors.bgSecondary },
  mediaCaption: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary },

  bio: { fontFamily: fonts.body, fontSize: 16, lineHeight: 23, color: colors.text },
}));
