import type { ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, type Href } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Avatar } from '@/components/Avatar';
import { LinearGradient } from '@/components/ThemedGradient';
import { accentFor } from '@/lib/accent';
import { useAuth } from '@/lib/auth-context';
import { canonicalList, fullName, lookingOptionFor, optionFor, roleLine, shortLocation } from '@/lib/labels';
import { detectPlatform, INSTRUMENT_TYPES } from '@/lib/onboarding-data';
import { profileStrength } from '@/lib/profile-strength';
import type { ShowcaseItem, UserProfile } from '@/lib/types';
import { fonts, makeStyles, useColors } from '@/lib/theme';

// Edit profile: a colorful hub. Each card shows everything you've picked in that area (as chips),
// so you can see your whole profile at a glance and jump straight to the part you want to change.

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

/** Families with exact instruments picked show the exact ones instead ("Strings" + Cello → Cello). */
function instrumentChips(families: string[], types: string[]) {
  return families.flatMap((fam) => {
    const famTypes = (INSTRUMENT_TYPES[fam] ?? []).map((o) => o.value).filter((t) => types.includes(t));
    return famTypes.length ? famTypes : [fam];
  });
}

const label = (v: string) => optionFor(v).label;

function whoChips(p: UserProfile): string[] {
  const out: string[] = [];
  out.push(p.creatorType === 'content' ? 'Content Creator' : 'Musician');
  if (p.profileKind === 'group') out.push(p.groupName ? `Band: ${p.groupName}` : 'Band / group');
  out.push(...canonicalList(p.skills).map(label));
  out.push(...instrumentChips(canonicalList(p.instruments), p.instrumentTypes ?? []).map(label));
  out.push(...(p.instrumentsSpecific ?? []));
  out.push(...(p.daws ?? []).map(label));
  return out;
}

function lookingChips(p: UserProfile): string[] {
  const wanted = p.lookingFor ?? [];
  const out: string[] = [];
  if (wanted.includes('anything')) out.push('Open to anything');
  for (const v of wanted.filter((w) => w !== 'anything')) {
    const details = canonicalList(p.lookingForDetails?.[v]);
    const shown = details.filter((d) => !(INSTRUMENT_TYPES[d] ?? []).some((t) => details.includes(t.value)));
    out.push(...(shown.length ? shown.map((d) => lookingOptionFor(d).label) : [lookingOptionFor(v).label]));
  }
  out.push(...(p.lookingForSpecific ?? []));
  return out;
}

function showcaseLabel(item: ShowcaseItem): { icon: IconName; text: string } {
  if (item.type === 'prompt') return { icon: 'format-quote-open', text: item.question || 'Prompt' };
  if (item.source === 'upload') {
    const icon: IconName = item.mediaKind === 'video' ? 'video-outline' : item.mediaKind === 'image' ? 'image-outline' : 'music-note';
    return { icon, text: item.title || 'Uploaded file' };
  }
  const platform = detectPlatform(item.url);
  return { icon: 'link-variant', text: item.title || platform?.label || 'Link' };
}

export default function EditProfile() {
  const styles = useStyles();
  const colors = useColors();
  const { profile } = useAuth();
  if (!profile) return null;
  const isMusician = profile.creatorType !== 'content';
  const accent = accentFor(profile);
  const strength = profileStrength(profile);
  const nextStep = strength.steps.find((s) => !s.done);

  const sound = [...canonicalList(isMusician ? profile.genres : profile.interests).map(label), ...(profile.soundsCustom ?? [])];
  const hereTo = [...canonicalList(profile.intents).map(label), ...(profile.experience ? [label(profile.experience)] : [])];
  const where = shortLocation(profile.location);
  const showcase = profile.showcase ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Done">
          <Text style={styles.done}>Done</Text>
        </Pressable>
        <Text style={styles.title}>Edit profile</Text>
        <Pressable
          onPress={() => router.push({ pathname: '/user/[id]', params: { id: profile.id } })}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Preview your profile"
        >
          <Text style={styles.preview}>Preview</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {/* Photo, name and how complete the profile is */}
        <LinearGradient colors={[accent, shade(accent)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <Pressable onPress={() => router.push('/edit/basics')} style={styles.heroRow} accessibilityRole="button" accessibilityLabel="Change photo or name">
            <View>
              <Avatar uri={profile.photoURL} name={profile.firstName} seed={profile.id} size={84} radius={24} style={styles.heroPhoto} />
              <View style={styles.camera}>
                <Ionicons name="camera" size={14} color="#17151F" />
              </View>
            </View>
            <View style={styles.flex}>
              <Text style={styles.heroName} numberOfLines={2}>
                {fullName(profile)}
              </Text>
              <Text style={styles.heroRole} numberOfLines={2}>
                {roleLine(profile, 3)}
              </Text>
              {where ? (
                <View style={styles.heroWhere}>
                  <Ionicons name="location-outline" size={13} color="rgba(255,255,255,0.85)" />
                  <Text style={styles.heroWhereText}>{where}</Text>
                </View>
              ) : null}
            </View>
          </Pressable>

          <View style={styles.strength}>
            <View style={styles.strengthTop}>
              <Text style={styles.strengthLabel}>Profile strength</Text>
              <Text style={styles.strengthPct}>{strength.percent}%</Text>
            </View>
            <View style={styles.bar}>
              <View style={[styles.barFill, { width: `${strength.percent}%` }]} />
            </View>
            {nextStep ? (
              <Pressable onPress={() => router.push(nextStep.route as Href)} style={styles.nextStep} accessibilityRole="button">
                <Ionicons name="sparkles" size={14} color="#F2C14E" />
                <Text style={styles.nextStepText}>Next: {nextStep.label}</Text>
                <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.8)" />
              </Pressable>
            ) : (
              <Text style={styles.nextStepText}>Looking great. Your profile is shown first.</Text>
            )}
          </View>
        </LinearGradient>

        <Group title="Your work" />
        <Card icon="music-box-multiple-outline" tint="#E8A23A" title="Show your work" href="/edit/showcase" hint={showcase.length ? `${showcase.length} added` : undefined}>
          {showcase.length ? (
            <View style={styles.tiles}>
              {showcase.slice(0, 4).map((item, i) => {
                const s = showcaseLabel(item);
                return (
                  <View key={i} style={styles.tile}>
                    <MaterialCommunityIcons name={s.icon} size={18} color="#B5761A" />
                    <Text style={styles.tileText} numberOfLines={2}>
                      {s.text}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : (
            <Empty text="Add a track, link or prompt. Profiles with work get shown first." />
          )}
          {profile.bio ? (
            <View style={styles.quote}>
              <Text style={styles.quoteLabel}>What you’re looking for in a partner</Text>
              <Text style={styles.quoteText} numberOfLines={3}>
                {profile.bio}
              </Text>
            </View>
          ) : null}
        </Card>

        <Group title="About you" />
        <Card icon="account-music-outline" tint="#4BA3C7" title={profile.profileKind === 'group' ? 'We are a…' : 'I am a…'} href="/edit/type">
          <Chips items={whoChips(profile)} tone="blue" />
        </Card>
        <Card icon="waveform" tint="#8E7CC3" title={isMusician ? 'Your sound' : 'Your vibe'} href="/edit/taste">
          {sound.length || profile.openToAll ? (
            <Chips items={[...(profile.openToAll ? ['Open to all'] : []), ...sound]} tone="purple" />
          ) : (
            <Empty text={isMusician ? 'Pick the genres you make.' : 'Pick the kind of content you make.'} />
          )}
        </Card>
        <Card icon="map-marker-radius-outline" tint="#4DBFBF" title="Where you are" href="/edit/location">
          <Text style={styles.plain}>
            {where ?? 'Not set yet'}
            {profile.maxDistance ? `  ·  within ${profile.maxDistance} mi` : ''}
            {profile.global ? '  ·  Open to collabs anywhere' : ''}
          </Text>
        </Card>

        <Group title="Who you want to meet" />
        <Card icon="account-search-outline" tint="#D97742" title="Looking to collab with" href="/edit/looking">
          {lookingChips(profile).length ? <Chips items={lookingChips(profile)} tone="orange" /> : <Empty text="Tell people who you want to work with." />}
          {hereTo.length ? (
            <View style={styles.sub}>
              <Text style={styles.subLabel}>Here to</Text>
              <Chips items={hereTo} tone="neutral" />
            </View>
          ) : null}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

/** A darker partner for the accent color, for the header gradient. */
function shade(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.round(c * 0.62).toString(16).padStart(2, '0');
  return `#${f((n >> 16) & 255)}${f((n >> 8) & 255)}${f(n & 255)}`;
}

function Group({ title }: { title: string }) {
  const styles = useStyles();
  return <Text style={styles.group}>{title}</Text>;
}

function Card(props: { icon: IconName; tint: string; title: string; href: Href; hint?: string; children: ReactNode }) {
  const styles = useStyles();
  return (
    <Pressable
      onPress={() => router.push(props.href)}
      style={({ pressed }) => [styles.card, pressed && { transform: [{ scale: 0.985 }], opacity: 0.95 }]}
      accessibilityRole="button"
      accessibilityLabel={`Edit ${props.title}`}
    >
      <View style={styles.cardHead}>
        <View style={[styles.iconTile, { backgroundColor: props.tint + '22' }]}>
          <MaterialCommunityIcons name={props.icon} size={20} color={props.tint} />
        </View>
        <Text style={styles.cardTitle}>{props.title}</Text>
        {props.hint ? <Text style={styles.cardHint}>{props.hint}</Text> : null}
        <View style={styles.editPill}>
          <Text style={styles.editText}>Edit</Text>
        </View>
      </View>
      <View style={styles.cardBody}>{props.children}</View>
    </Pressable>
  );
}

const TONES = {
  blue: { bg: '#E3F0F6', fg: '#1F5F7F' },
  purple: { bg: '#ECE7F7', fg: '#4D3F80' },
  orange: { bg: '#FBEADF', fg: '#8A4318' },
  neutral: { bg: '#F0F0F2', fg: '#3A4150' },
} as const;

function Chips({ items, tone }: { items: string[]; tone: keyof typeof TONES }) {
  const styles = useStyles();
  const max = 10;
  const shown = items.slice(0, max);
  return (
    <View style={styles.chips}>
      {shown.map((t, i) => (
        <View key={`${t}${i}`} style={[styles.chip, styles[`chip_${tone}`]]}>
          <Text style={[styles.chipText, styles[`chipText_${tone}`]]}>{t}</Text>
        </View>
      ))}
      {items.length > max ? (
        <View style={[styles.chip, styles.chip_neutral]}>
          <Text style={[styles.chipText, styles.chipText_neutral]}>+{items.length - max}</Text>
        </View>
      ) : null}
    </View>
  );
}

function Empty({ text }: { text: string }) {
  const styles = useStyles();
  const colors = useColors();
  return (
    <View style={styles.empty}>
      <Ionicons name="add-circle-outline" size={18} color={colors.blue} />
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  safe: { flex: 1, backgroundColor: '#F7F5F0' },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  title: { fontFamily: fonts.bodySemibold, fontSize: 17, color: colors.text },
  done: { fontFamily: fonts.bodySemibold, fontSize: 16, color: colors.blue, width: 64 },
  preview: { fontFamily: fonts.bodySemibold, fontSize: 16, color: colors.blue, width: 64, textAlign: 'right' },
  body: { paddingHorizontal: 16, paddingBottom: 40 },

  hero: { borderRadius: 26, padding: 18, gap: 16 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  heroPhoto: { borderWidth: 2, borderColor: 'rgba(255,255,255,0.7)' },
  camera: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F2C14E',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  heroName: { fontFamily: fonts.heading, fontSize: 26, lineHeight: 29, letterSpacing: -0.5, color: colors.white },
  heroRole: { fontFamily: fonts.bodySemibold, fontSize: 14, color: 'rgba(255,255,255,0.9)', marginTop: 3 },
  heroWhere: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
  heroWhereText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: 'rgba(255,255,255,0.85)' },
  strength: { backgroundColor: 'rgba(0,0,0,0.18)', borderRadius: 16, padding: 12, gap: 8 },
  strengthTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  strengthLabel: { fontFamily: fonts.bodySemibold, fontSize: 13, color: 'rgba(255,255,255,0.9)' },
  strengthPct: { fontFamily: fonts.heading, fontSize: 18, color: colors.white },
  bar: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3, backgroundColor: '#F2C14E' },
  nextStep: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  nextStepText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.white },

  group: {
    fontFamily: fonts.bodySemibold,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginTop: 22,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#1F2328',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconTile: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { flex: 1, fontFamily: fonts.heading, fontSize: 17, color: colors.text },
  cardHint: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },
  editPill: { paddingHorizontal: 12, height: 28, borderRadius: 14, backgroundColor: '#EEF5F9', justifyContent: 'center' },
  editText: { fontFamily: fonts.bodySemibold, fontSize: 13, color: '#2F7FA6' },
  cardBody: { marginTop: 12, gap: 12 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999 },
  chipText: { fontFamily: fonts.bodySemibold, fontSize: 13 },
  chip_blue: { backgroundColor: TONES.blue.bg },
  chipText_blue: { color: TONES.blue.fg },
  chip_purple: { backgroundColor: TONES.purple.bg },
  chipText_purple: { color: TONES.purple.fg },
  chip_orange: { backgroundColor: TONES.orange.bg },
  chipText_orange: { color: TONES.orange.fg },
  chip_neutral: { backgroundColor: TONES.neutral.bg },
  chipText_neutral: { color: TONES.neutral.fg },

  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: {
    width: '48.5%',
    minHeight: 64,
    borderRadius: 14,
    padding: 10,
    gap: 4,
    backgroundColor: '#FFF4DF',
  },
  tileText: { fontFamily: fonts.bodySemibold, fontSize: 13, lineHeight: 17, color: colors.text },
  quote: { borderLeftWidth: 3, borderLeftColor: '#E8A23A', paddingLeft: 12, gap: 3 },
  quoteLabel: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
  quoteText: { fontFamily: fonts.heading, fontSize: 16, lineHeight: 21, color: colors.text },
  sub: { gap: 6 },
  subLabel: { fontFamily: fonts.bodySemibold, fontSize: 12, color: colors.textSecondary },
  plain: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.text },
  empty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#BFD9E6',
  },
  emptyText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 14, color: '#2F7FA6' },
}));

