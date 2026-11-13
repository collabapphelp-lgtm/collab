import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { lookingOptionFor, optionFor, displayName } from '@/lib/labels';
import { distanceMiles, formatDistance, scoreCandidate } from '@/lib/matching';
import { detectPlatform } from '@/lib/onboarding-data';
import type { ShowcaseMedia, ShowcasePrompt, UserProfile } from '@/lib/types';
import { colors, fonts, radius } from '@/lib/theme';

/**
 * Who you're talking to, pinned under the chat header: where they are, why you fit,
 * their sound, what they're after and a taste of their work. Collapses to keep room for the chat.
 */
export function ChatProfileCard(props: { me: UserProfile | null; them: UserProfile; expanded: boolean; onToggle: () => void }) {
  const { me, them, expanded } = props;
  const isMusician = them.creatorType !== 'content';

  const where = formatDistance(distanceMiles(me?.geo, them.geo), them.location);
  const reasons = me ? (scoreCandidate(me, them, 'explore')?.reasons ?? []) : [];
  const tastes = [
    ...((isMusician ? them.genres : them.interests) ?? []).slice(0, 4).map((v) => {
      const o = optionFor(v);
      return `${o.emoji} ${o.label}`;
    }),
    ...(them.openToAll ? ['♾️ Open to all'] : []),
  ];
  const looking = (them.lookingFor ?? []).map((v) => lookingOptionFor(v).label).join(', ');
  // Everything they showcase, snippets first, so you can swipe through their work without leaving the chat.
  const work = [
    ...(them.showcase ?? []).filter((s): s is ShowcaseMedia => s.type === 'media'),
    ...(them.showcase ?? []).filter((s): s is ShowcasePrompt => s.type === 'prompt'),
  ];
  const snippets = work.filter((w) => w.type === 'media').length;
  const prompts = work.length - snippets;
  const workLabel = [snippets ? `🎵 ${snippets}` : '', prompts ? `💬 ${prompts}` : ''].filter(Boolean).join('  ');

  return (
    <LinearGradient colors={['#EAF3F8', '#F3EFF8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.wrap}>
      <Pressable onPress={props.onToggle} style={styles.top} accessibilityRole="button" accessibilityState={{ expanded }} hitSlop={6}>
        <View style={styles.pill}>
          <Text style={styles.pillText}>📍 {where}</Text>
        </View>
        {reasons[0] ? (
          <Text style={styles.reason} numberOfLines={1}>
            ✨ {reasons[0]}
          </Text>
        ) : (
          <View style={styles.flex} />
        )}
        {!expanded && workLabel ? <Text style={styles.workCount}>{workLabel}</Text> : null}
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textSecondary} />
      </Pressable>

      {expanded ? (
        <View style={styles.body}>
          {tastes.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {tastes.map((t) => (
                <View key={t} style={styles.chip}>
                  <Text style={styles.chipText}>{t}</Text>
                </View>
              ))}
            </ScrollView>
          ) : null}

          {looking ? (
            <Text style={styles.line} numberOfLines={1}>
              <Text style={styles.lineLabel}>Looking for </Text>
              {looking}
            </Text>
          ) : null}

          {work.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.work}
              style={styles.workScroll}
              decelerationRate="fast"
              snapToInterval={CARD_W + 8}
            >
              {work.map((w, i) =>
                w.type === 'media' ? <MediaCard key={`m${i}`} item={w} /> : <PromptCard key={`p${i}`} item={w} />,
              )}
            </ScrollView>
          ) : null}

          <Pressable
            onPress={() => router.push({ pathname: '/user/[id]', params: { id: them.id } })}
            style={({ pressed }) => [styles.more, pressed && { opacity: 0.7 }]}
            accessibilityRole="button"
          >
            <Text style={styles.moreText}>View {displayName(them)}’s full profile</Text>
            <Ionicons name="chevron-forward" size={15} color={colors.blue} />
          </Pressable>
        </View>
      ) : null}
    </LinearGradient>
  );
}

const CARD_W = 236;
const CARD_H = 84;

function MediaCard({ item }: { item: ShowcaseMedia }) {
  const platform = item.source === 'link' ? detectPlatform(item.url) : null;
  const icon = platform ? platform.emoji : item.mediaKind === 'audio' ? '🎵' : item.mediaKind === 'image' ? '🖼️' : '🎬';
  const kind = platform ? platform.label : item.mediaKind === 'audio' ? 'Audio' : item.mediaKind === 'image' ? 'Photo' : 'Video';
  return (
    <Pressable
      onPress={() => WebBrowser.openBrowserAsync(item.url).catch(() => {})}
      style={({ pressed }) => [styles.card, styles.media, pressed && { opacity: 0.8 }]}
      accessibilityRole="button"
      accessibilityLabel={`Open ${item.title ?? kind}`}
    >
      <Text style={styles.mediaIcon}>{icon}</Text>
      <View style={styles.flex}>
        <Text style={styles.mediaTitle} numberOfLines={2}>
          {item.title ?? `${kind} snippet`}
        </Text>
        <Text style={styles.mediaKind}>{kind}</Text>
      </View>
      <View style={styles.play}>
        <Ionicons name="play" size={13} color={colors.white} style={{ marginLeft: 2 }} />
      </View>
    </Pressable>
  );
}

/** A prompt answer; tap to read the whole thing. */
function PromptCard({ item }: { item: ShowcasePrompt }) {
  const [open, setOpen] = useState(false);
  return (
    <Pressable
      onPress={() => setOpen((v) => !v)}
      style={({ pressed }) => [styles.card, styles.prompt, open && styles.cardOpen, pressed && { opacity: 0.85 }]}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
    >
      <Text style={styles.promptQ} numberOfLines={1}>
        {item.question}
      </Text>
      <Text style={styles.promptA} numberOfLines={open ? undefined : 2}>
        “{item.answer}”
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { marginHorizontal: 12, marginTop: 10, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pill: { backgroundColor: colors.white, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.text },
  reason: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.textSecondary },
  body: { gap: 10, marginTop: 10 },
  chips: { gap: 6 },
  chip: { backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 5 },
  chipText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.text },
  line: { fontFamily: fonts.body, fontSize: 13, color: colors.text },
  lineLabel: { fontFamily: fonts.bodySemibold, color: colors.textSecondary },
  workCount: { fontFamily: fonts.bodySemibold, fontSize: 12, color: colors.textSecondary },
  workScroll: { marginHorizontal: -12 },
  work: { gap: 8, paddingHorizontal: 12 },
  card: { width: CARD_W, minHeight: CARD_H, borderRadius: 14, padding: 10 },
  cardOpen: { minHeight: undefined },
  media: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.white },
  mediaIcon: { fontSize: 20 },
  mediaTitle: { fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.text },
  mediaKind: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
  play: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center' },
  prompt: { backgroundColor: 'rgba(255,255,255,0.75)', gap: 3 },
  promptQ: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.textSecondary },
  promptA: { fontFamily: fonts.heading, fontSize: 14, lineHeight: 19, color: colors.text },
  more: { flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start' },
  moreText: { fontFamily: fonts.bodySemibold, fontSize: 13, color: colors.blue },
});
