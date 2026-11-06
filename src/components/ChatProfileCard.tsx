import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { lookingOptionFor, optionFor } from '@/lib/labels';
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
  const media = them.showcase?.find((s): s is ShowcaseMedia => s.type === 'media');
  const prompt = them.showcase?.find((s): s is ShowcasePrompt => s.type === 'prompt');

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

          {media ? <MediaRow item={media} /> : null}

          {prompt ? (
            <View style={styles.prompt}>
              <Text style={styles.promptQ} numberOfLines={1}>
                {prompt.question}
              </Text>
              <Text style={styles.promptA} numberOfLines={2}>
                “{prompt.answer}”
              </Text>
            </View>
          ) : null}

          <Pressable
            onPress={() => router.push({ pathname: '/user/[id]', params: { id: them.id } })}
            style={({ pressed }) => [styles.more, pressed && { opacity: 0.7 }]}
            accessibilityRole="button"
          >
            <Text style={styles.moreText}>View {them.firstName}’s full profile</Text>
            <Ionicons name="chevron-forward" size={15} color={colors.blue} />
          </Pressable>
        </View>
      ) : null}
    </LinearGradient>
  );
}

function MediaRow({ item }: { item: ShowcaseMedia }) {
  const platform = item.source === 'link' ? detectPlatform(item.url) : null;
  const icon = platform ? platform.emoji : item.mediaKind === 'audio' ? '🎵' : item.mediaKind === 'image' ? '🖼️' : '🎬';
  const kind = platform ? platform.label : item.mediaKind === 'audio' ? 'Audio' : item.mediaKind === 'image' ? 'Photo' : 'Video';
  return (
    <Pressable
      onPress={() => WebBrowser.openBrowserAsync(item.url).catch(() => {})}
      style={({ pressed }) => [styles.media, pressed && { opacity: 0.8 }]}
      accessibilityRole="button"
      accessibilityLabel={`Open ${item.title ?? kind}`}
    >
      <Text style={styles.mediaIcon}>{icon}</Text>
      <View style={styles.flex}>
        <Text style={styles.mediaTitle} numberOfLines={1}>
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
  media: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.white, borderRadius: 14, padding: 10 },
  mediaIcon: { fontSize: 20 },
  mediaTitle: { fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.text },
  mediaKind: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
  play: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center' },
  prompt: { backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 14, padding: 10, gap: 2 },
  promptQ: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.textSecondary },
  promptA: { fontFamily: fonts.heading, fontSize: 14, lineHeight: 19, color: colors.text },
  more: { flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start' },
  moreText: { fontFamily: fonts.bodySemibold, fontSize: 13, color: colors.blue },
});
