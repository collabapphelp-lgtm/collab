import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import { HeroPhoto } from '@/components/Avatar';
import { detectPlatform } from '@/lib/onboarding-data';
import { fullName, lookingOptionFor, optionFor, roleLine, shortLocation } from '@/lib/labels';
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
};

/** One person's full profile: photo, roles, why you match, what they want, their sound, their work, bio. */
export function ProfileView({ profile, distanceLabel, reasons, heroAccessory, isSelf }: Props) {
  const name = fullName(profile);
  const tastes = profile.creatorType === 'content' ? profile.interests : profile.genres;
  const looking = profile.lookingFor ?? [];
  const showcase = profile.showcase ?? [];
  const instruments = (profile.instruments ?? []).map((i) => optionFor(i).label);

  return (
    <View style={styles.wrap}>
      <View style={styles.hero}>
        <HeroPhoto uri={profile.photoURL} name={name} seed={profile.id} />
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.65)']} style={styles.heroShade} />
        {heroAccessory ? <View style={styles.heroAccessory}>{heroAccessory}</View> : null}
        <View style={styles.heroText}>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.role}>{roleLine(profile, 3)}</Text>
          {distanceLabel || profile.location ? (
            <Text style={styles.where}>📍 {distanceLabel ?? shortLocation(profile.location)}</Text>
          ) : null}
        </View>
      </View>

      <View style={styles.body}>
        {reasons && reasons.length > 0 ? (
          <View style={styles.reasons}>
            {reasons.map((r) => (
              <View key={r} style={styles.reason}>
                <Text style={styles.reasonText}>✨ {r}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {instruments.length > 0 ? <Section title={isSelf ? 'You play' : 'Plays'}>{<ChipRow items={instruments} />}</Section> : null}

        {looking.length > 0 ? (
          <Section title="Looking to collab with">
            <ChipRow
              items={looking.map((v) => {
                const o = lookingOptionFor(v);
                const details = profile.lookingForDetails?.[v];
                const suffix = details?.length ? `: ${details.map((d) => optionFor(d).label).join(', ')}` : '';
                return `${o.emoji} ${o.label}${suffix}`;
              })}
            />
          </Section>
        ) : null}

        {tastes?.length || profile.openToAll ? (
          <Section title={`${isSelf ? 'Your' : 'Their'} ${profile.creatorType === 'content' ? 'vibe' : 'sound'}`}>
            <ChipRow
              items={[
                ...(tastes ?? []).map((t) => `${optionFor(t).emoji} ${optionFor(t).label}`),
                ...(profile.openToAll ? ['🌈 Open to all'] : []),
              ]}
            />
          </Section>
        ) : null}

        {showcase.map((item, i) => (
          <ShowcaseCard key={i} item={item} />
        ))}

        {profile.bio ? (
          <Section title="About">
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

function ChipRow({ items }: { items: string[] }) {
  return (
    <View style={styles.chips}>
      {items.map((t) => (
        <View key={t} style={styles.chip}>
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
      <Text style={styles.play}>▶</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.white },
  hero: { height: 460, justifyContent: 'flex-end', backgroundColor: colors.purple, overflow: 'hidden' },
  heroShade: { position: 'absolute', left: 0, right: 0, bottom: 0, top: '45%' },
  heroAccessory: { position: 'absolute', top: 12, right: 12 },
  heroText: { padding: 20, gap: 4 },
  name: { fontFamily: fonts.heading, fontSize: 32, color: colors.white },
  role: { fontFamily: fonts.bodySemibold, fontSize: 16, color: colors.white },
  where: { fontFamily: fonts.body, fontSize: 14, color: 'rgba(255,255,255,0.9)' },

  body: { padding: 20, gap: 18 },
  reasons: { gap: 8 },
  reason: { alignSelf: 'flex-start', backgroundColor: 'rgba(229,197,71,0.18)', paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.full },
  reasonText: { fontFamily: fonts.bodySemibold, fontSize: 13, color: colors.text },

  section: { gap: 10 },
  sectionTitle: { fontFamily: fonts.bodySemibold, fontSize: 13, letterSpacing: 0.6, textTransform: 'uppercase', color: colors.textMuted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.full, backgroundColor: colors.bgSecondary },
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
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  mediaIcon: { width: 48, height: 48, borderRadius: 12, backgroundColor: 'rgba(75,163,199,0.14)', alignItems: 'center', justifyContent: 'center' },
  mediaIconText: { fontSize: 22 },
  mediaText: { flex: 1 },
  mediaTitle: { fontFamily: fonts.bodySemibold, fontSize: 16, color: colors.text },
  mediaKind: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary },
  play: { fontSize: 18, color: colors.blue },
  mediaImageWrap: { gap: 6 },
  mediaImage: { width: '100%', aspectRatio: 4 / 5, borderRadius: radius.md, backgroundColor: colors.bgSecondary },
  mediaCaption: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary },

  bio: { fontFamily: fonts.body, fontSize: 16, lineHeight: 23, color: colors.text },
});
