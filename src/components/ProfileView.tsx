import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import { HeroPhoto } from '@/components/Avatar';
import { detectPlatform } from '@/lib/onboarding-data';
import { canonicalList, fullName, lookingOptionFor, optionFor, roleLine, shortLocation } from '@/lib/labels';
import type { ShowcaseItem, UserProfile } from '@/lib/types';
import { colors, fonts, radius } from '@/lib/theme';

type Props = {
  profile: UserProfile;
  /** e.g. "6 mi away". Falls back to their city. */
  distanceLabel?: string;
  /** "Why you're seeing this" chips (Discover only). */
  reasons?: string[];
  /** Rendered at the very top-right of the hero (e.g. a close button). */
  heroAccessory?: ReactNode;
  /** Viewing your own profile: section titles say "Your" instead of "Their". */
  isSelf?: boolean;
  /** Photo height. Discover uses a shorter one so more of the profile shows without scrolling. */
  heroHeight?: number;
};

/** One person's full profile: photo, roles, why you match, what they want, their sound, their work, bio. */
export function ProfileView({ profile, distanceLabel, reasons, heroAccessory, isSelf, heroHeight = 420 }: Props) {
  const name = fullName(profile);
  const tastes = profile.creatorType === 'content' ? profile.interests : profile.genres;
  const looking = profile.lookingFor ?? [];
  const showcase = profile.showcase ?? [];
  const instruments = [
    ...canonicalList(profile.instruments).map((i) => optionFor(i).label),
    ...(profile.instrumentsSpecific ?? []),
  ];
  const isGroup = profile.profileKind === 'group';
  const intents = (profile.intents ?? []).map((i) => optionFor(i).label);
  const experience = profile.experience ? optionFor(profile.experience).label : null;

  return (
    <View style={styles.wrap}>
      <View style={[styles.hero, { height: heroHeight }]}>
        <HeroPhoto uri={profile.photoURL} name={name} seed={profile.id} />
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.65)']} style={styles.heroShade} />
        {heroAccessory ? <View style={styles.heroAccessory}>{heroAccessory}</View> : null}
        <View style={styles.heroText}>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.role}>
            {isGroup ? `Band / group${profile.groupSize ? ` · ${profile.groupSize} members` : ''} · ` : ''}
            {roleLine(profile, 3)}
          </Text>
          {distanceLabel || profile.location ? (
            <View style={styles.wherePill}>
              <Text style={styles.where}>📍 {distanceLabel ?? shortLocation(profile.location)}</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.body}>
        {reasons && reasons.length > 0 ? (
          <LinearGradient colors={['rgba(229,197,71,0.22)', 'rgba(163,153,199,0.14)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.reasons}>
            <Text style={styles.reasonsTitle}>Why you two fit</Text>
            {reasons.map((r) => (
              <Text key={r} style={styles.reasonText}>
                ✨ {r}
              </Text>
            ))}
          </LinearGradient>
        ) : null}

        {intents.length > 0 || experience ? (
          <Section title={isSelf ? 'You’re here to' : 'Here to'}>
            <ChipRow tone="purple" items={[...intents, ...(experience ? [experience] : [])]} />
          </Section>
        ) : null}

        {instruments.length > 0 ? <Section title={isSelf ? 'You play' : 'Plays'}>{<ChipRow items={instruments} tone="blue" />}</Section> : null}

        {looking.length > 0 ? (
          <Section title="Looking to collab with">
            <ChipRow
              tone="blue"
              items={looking.flatMap((v) => {
                // Picked specifics? Show just those ("Piano", "Videographers"), not "Instrument Players: Piano".
                const details = canonicalList(profile.lookingForDetails?.[v]);
                if (details.length) return details.map((d) => lookingOptionFor(d).label);
                return [lookingOptionFor(v).label];
              }).concat(profile.lookingForSpecific ?? [])}
            />
          </Section>
        ) : null}

        {tastes?.length || profile.openToAll ? (
          <Section title={`${isSelf ? 'Your' : 'Their'} ${profile.creatorType === 'content' ? 'vibe' : 'sound'}`}>
            <ChipRow
              tone="purple"
              items={[
                ...(tastes ?? []).map((t) => optionFor(t).label),
                ...(profile.openToAll ? ['♾️ Open to all'] : []),
              ]}
            />
          </Section>
        ) : null}

        {showcase.map((item, i) => (
          <ShowcaseCard key={i} item={item} />
        ))}

        {profile.bio ? (
          <Section title={isSelf ? "What you’re looking for in a collab" : "Looking for in a collab"}>
            <Text style={styles.bio}>{profile.bio}</Text>
          </Section>
        ) : null}
      </View>
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function ChipRow({ items, tone }: { items: string[]; tone: 'blue' | 'purple' }) {
  return (
    <View style={styles.chips}>
      {items.map((t) => (
        <View key={t} style={[styles.chip, tone === 'blue' ? styles.chipBlue : styles.chipPurple]}>
          <Text style={styles.chipText}>{t}</Text>
        </View>
      ))}
    </View>
  );
}

function ShowcaseCard({ item }: { item: ShowcaseItem }) {
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

  const platform = item.source === 'link' ? detectPlatform(item.url) : null;
  const icon = platform ? platform.emoji : item.mediaKind === 'audio' ? '🎵' : '🎬';
  const kind = platform ? platform.label : item.mediaKind === 'audio' ? 'Audio' : 'Video';
  return (
    <Pressable
      onPress={() => WebBrowser.openBrowserAsync(item.url).catch(() => {})}
      accessibilityRole="link"
      accessibilityLabel={`${item.title ?? kind}. Opens ${kind}.`}
      style={({ pressed }) => [styles.media, pressed && { opacity: 0.8 }]}
    >
      <View style={styles.mediaIcon}>
        <Text style={styles.mediaIconText}>{icon}</Text>
      </View>
      <View style={styles.mediaText}>
        <Text style={styles.mediaTitle} numberOfLines={1}>
          {item.title ?? `${kind} link`}
        </Text>
        <Text style={styles.mediaKind}>{kind}</Text>
      </View>
      <View style={styles.playBtn}>
        <Text style={styles.play}>▶</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.white },
  hero: { justifyContent: 'flex-end', backgroundColor: colors.purple, overflow: 'hidden' },
  heroShade: { position: 'absolute', left: 0, right: 0, bottom: 0, top: '45%' },
  heroAccessory: { position: 'absolute', top: 12, right: 12 },
  heroText: { padding: 20, gap: 4 },
  name: { fontFamily: fonts.heading, fontSize: 34, lineHeight: 38, color: colors.white },
  role: { fontFamily: fonts.bodySemibold, fontSize: 16, color: 'rgba(255,255,255,0.95)' },
  wherePill: { alignSelf: 'flex-start', marginTop: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  where: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.white },

  body: { padding: 20, gap: 20 },
  reasons: { borderRadius: radius.md, padding: 16, gap: 6 },
  reasonsTitle: { fontFamily: fonts.heading, fontSize: 15, color: colors.text, marginBottom: 2 },
  reasonText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.text },

  section: { gap: 10 },
  sectionTitle: { fontFamily: fonts.heading, fontSize: 16, color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.full, borderWidth: 1 },
  chipBlue: { backgroundColor: 'rgba(75,163,199,0.08)', borderColor: 'rgba(75,163,199,0.25)' },
  chipPurple: { backgroundColor: 'rgba(163,153,199,0.12)', borderColor: 'rgba(163,153,199,0.35)' },
  chipText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.text },

  prompt: { padding: 18, borderRadius: radius.md, backgroundColor: 'rgba(163,153,199,0.12)', gap: 8 },
  promptQ: { fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.textSecondary },
  promptA: { fontFamily: fonts.heading, fontSize: 21, lineHeight: 28, color: colors.text },

  media: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  mediaIcon: { width: 48, height: 48, borderRadius: 12, backgroundColor: 'rgba(75,163,199,0.14)', alignItems: 'center', justifyContent: 'center' },
  mediaIconText: { fontSize: 22 },
  mediaText: { flex: 1 },
  mediaTitle: { fontFamily: fonts.bodySemibold, fontSize: 16, color: colors.text },
  mediaKind: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary },
  playBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center' },
  play: { fontSize: 14, color: colors.white, marginLeft: 2 },
  mediaImageWrap: { gap: 6 },
  mediaImage: { width: '100%', aspectRatio: 4 / 5, borderRadius: radius.md, backgroundColor: colors.bgSecondary },
  mediaCaption: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary },

  bio: { fontFamily: fonts.body, fontSize: 16, lineHeight: 23, color: colors.text },
});
