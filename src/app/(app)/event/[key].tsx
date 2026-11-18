import { useEffect, useMemo, useState } from 'react';
import { ActionSheetIOS, Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from '@/components/ThemedGradient';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar } from '@/components/Avatar';
import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/Button';
import { useAuth } from '@/lib/auth-context';
import { deleteMyEvent, flyerShape, metaFor, setEventFlyer, whenLabel } from '@/lib/events';
import { Image } from 'expo-image';
import { FlyerLightbox } from '@/components/FlyerLightbox';
import { pickFlyer } from '@/lib/flyer';
import { uploadEventFlyer } from '@/lib/upload';
import { chooseCalendar } from '@/lib/calendar';
import { displayName, roleLine } from '@/lib/labels';
import { getProfile } from '@/lib/profiles';
import { loadBlockedIds, reportUser } from '@/lib/safety';
import type { UserProfile } from '@/lib/types';
import { useEvents } from '@/lib/use-events';
import { useMatches } from '@/lib/use-matches';
import { adminDeleteEvent, refreshTeam, useTeam } from '@/lib/team';
import { fonts, shadow, makeStyles, useColors } from '@/lib/theme';

export default function EventScreen() {
  const styles = useStyles();
  const colors = useColors();
  const { key } = useLocalSearchParams<{ key: string }>();
  const { user, profile } = useAuth();
  const me = user?.uid ?? '';
  const { events, going, isGoing, toggleGoing, refresh } = useEvents();
  const { matches } = useMatches();
  const e = events?.find((x) => x.key === key);
  const [people, setPeople] = useState<UserProfile[]>([]);
  const [saving, setSaving] = useState(false);
  const [flyerOpen, setFlyerOpen] = useState(false);
  const team = useTeam();
  const [flyerBusy, setFlyerBusy] = useState<number | null>(null);

  // Everyone who tapped I'm going, oldest first. With a capacity, the first N have spots, the rest wait.
  const allIds = useMemo(() => (e ? (going.get(e.key) ?? []) : []), [going, e]);
  const cap = e?.capacity;
  const goingIds = useMemo(() => (cap ? allIds.slice(0, cap) : allIds), [allIds, cap]);
  const waitCount = cap ? Math.max(0, allIds.length - cap) : 0;
  const connected = useMemo(() => new Set((matches ?? []).map((m) => m.other.id)), [matches]);

  // Load who's going (minus anyone you've blocked), connections first.
  const idsKey = goingIds.join(',');
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ids = idsKey ? idsKey.split(',').filter((id) => id !== me).slice(0, 40) : [];
      const blocked = new Set(me ? await loadBlockedIds(me).catch(() => []) : []);
      const loaded = (await Promise.all(ids.filter((id) => !blocked.has(id)).map((id) => getProfile(id).catch(() => null)))).filter(
        (p): p is UserProfile => !!p,
      );
      if (!cancelled) setPeople(loaded.sort((a, b) => Number(connected.has(b.id)) - Number(connected.has(a.id))));
    })();
    return () => {
      cancelled = true;
    };
  }, [idsKey, me, connected]);

  if (!e) {
    return (
      <SafeAreaView style={styles.missing}>
        <Text style={styles.missingText}>{events === null ? 'Loading…' : 'This event isn’t available anymore.'}</Text>
        {events === null ? null : <Button title="Go back" variant="secondary" onPress={() => router.back()} style={{ width: 200 }} />}
      </SafeAreaView>
    );
  }

  const meta = metaFor(e);
  const mine = e.host?.id === me;
  const myIndex = me ? allIds.indexOf(me) : -1;
  const onWaitlist = !!cap && myIndex >= cap;
  const imGoing = isGoing(e) && !onWaitlist;
  const full = !!cap && !isGoing(e) && allIds.length >= cap;
  const spotsLeft = cap ? Math.max(0, cap - allIds.length) : null;
  const friendsGoing = people.filter((p) => connected.has(p.id)).length;

  async function onGoing() {
    if (!e) return;
    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const wasGoing = isGoing(e);
    const joiningWaitlist = full;
    try {
      await toggleGoing(e);
      if (!wasGoing && joiningWaitlist) {
        Alert.alert('You’re on the waitlist', 'It’s full right now. If a spot opens up, you’ll get a notification.');
      } else if (!wasGoing) {
        const ev = e;
        Alert.alert('You’re going!', 'Add it to your calendar so you don’t miss it?', [
          { text: 'Not now', style: 'cancel' },
          { text: 'Add to calendar', onPress: () => chooseCalendar(ev) },
        ]);
      }
    } catch {
      Alert.alert('That didn’t save', 'Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  async function addFlyer() {
    if (!e || !me) return;
    const ev = e;
    const go = async () => {
      const f = await pickFlyer();
      if (!f) return;
      setFlyerBusy(0);
      try {
        const url = await uploadEventFlyer(me, f.uri, setFlyerBusy);
        await setEventFlyer(ev.eventId, url, Math.round(f.aspect * 1000) / 1000);
        await refresh();
        Alert.alert('Flyer added', 'The Collab team will give it a quick look, usually within a day. Your event shows again once it’s approved.');
      } catch (err) {
        console.warn('Flyer upload failed', err);
        Alert.alert('That didn’t upload', 'Check your connection and try again.');
      } finally {
        setFlyerBusy(null);
      }
    };
    if (ev.status === 'approved') {
      Alert.alert(
        ev.flyerURL ? 'Change the flyer?' : 'Add a flyer?',
        'New images are reviewed first, so your event will be hidden from others until the Collab team approves it (usually within a day).',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Choose image', onPress: go },
        ],
      );
    } else go();
  }

  function directions() {
    if (!e) return;
    const q = encodeURIComponent(`${e.venue}, ${e.address}`);
    const url = Platform.OS === 'ios' ? `http://maps.apple.com/?q=${q}&ll=${e.lat},${e.lng}` : `https://www.google.com/maps/search/?api=1&query=${q}`;
    Linking.openURL(url).catch(() => {});
  }

  function more() {
    if (!e) return;
    const ev = e;
    const report = () =>
      Alert.alert('Report this listing?', 'We’ll take a look. Tell us if it’s fake, unsafe or has the wrong details.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Report',
          style: 'destructive',
          onPress: () =>
            reportUser(me, `event:${ev.eventId}`, 'Event listing', `${ev.title} · ${ev.venue} · ${ev.date}`)
              .then(() => Alert.alert('Thanks for telling us'))
              .catch(() => Alert.alert('Couldn’t send', 'Check your connection and try again.')),
        },
      ]);
    const remove = () =>
      Alert.alert('Delete this event?', 'It’ll be removed for everyone.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteMyEvent(ev.eventId).catch(() => Alert.alert('Couldn’t delete', 'Check your connection and try again.'));
            await refresh();
            router.back();
          },
        },
      ]);
    // Collab team: delete anyone's event (built-in listings are hidden instead).
    const teamDelete = () => {
      const run = async (date?: string) => {
        try {
          await adminDeleteEvent(ev.eventId, ev.source, date);
          await refresh();
          refreshTeam();
          router.back();
        } catch (err) {
          console.warn('Admin delete failed', err);
          Alert.alert('Couldn’t delete', 'Check your connection and try again.');
        }
      };
      if (ev.source === 'curated' && ev.repeats) {
        Alert.alert('Delete this listing?', `“${ev.title}” repeats (${ev.repeats}). Remove just this date, or every date?`, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Just this date', style: 'destructive', onPress: () => run(ev.date) },
          { text: 'Every date', style: 'destructive', onPress: () => run() },
        ]);
      } else {
        Alert.alert('Delete this event?', 'It’s removed for everyone, along with everyone’s “I’m going”.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: () => run(ev.source === 'curated' ? ev.date : undefined) },
        ]);
      }
    };
    if (team.admin && !mine) {
      const options = ['Delete event (Collab team)', 'Cancel'];
      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions({ options, destructiveButtonIndex: 0, cancelButtonIndex: 1 }, (i) => i === 0 && teamDelete());
      } else teamDelete();
      return;
    }
    if (mine && ev.source === 'posted') {
      const options = ['Delete event', ev.flyerURL ? 'Change flyer' : 'Add a flyer', 'Cancel'];
      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions({ options, destructiveButtonIndex: 0, cancelButtonIndex: 2 }, (i) =>
          i === 0 ? remove() : i === 1 ? addFlyer() : null,
        );
      } else remove();
      return;
    }
    const options = mine ? ['Delete event', 'Cancel'] : ['Report listing', 'Cancel'];
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions({ options, destructiveButtonIndex: 0, cancelButtonIndex: 1 }, (i) => i === 0 && (mine ? remove() : report()));
    } else if (mine) remove();
    else report();
  }

  return (
    <View style={styles.fill}>
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        <LinearGradient colors={[meta.color, shade(meta.color)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <SafeAreaView edges={['top']}>
            <View style={styles.topRow}>
              <View style={styles.backWrap}>
                <BackButton />
              </View>
              <Pressable onPress={more} hitSlop={10} style={styles.moreBtn} accessibilityRole="button" accessibilityLabel="More options">
                <Ionicons name="ellipsis-horizontal" size={20} color={colors.text} />
              </Pressable>
            </View>
            <View style={styles.heroBody}>
              <Text style={styles.heroType}>{(e.collabHosted ? 'Hosted by Collab' : meta.label).toUpperCase()}</Text>
              <Text style={styles.heroTitle}>{e.title}</Text>
              <Text style={styles.heroWhen}>{whenLabel(e)}</Text>
              {e.repeats ? <Text style={styles.heroRepeats}>↻ {e.repeats}</Text> : null}
            </View>
            {e.flyerURL ? (
              <Pressable onPress={() => setFlyerOpen(true)} style={styles.flyerWrap} accessibilityRole="imagebutton" accessibilityLabel="View the flyer">
                <Image source={{ uri: e.flyerURL }} style={[styles.flyer, { aspectRatio: flyerShape(e.flyerAspect) }]} contentFit="cover" transition={200} />
                <View style={styles.flyerHint}>
                  <Ionicons name="expand" size={13} color="rgb(255,255,255)" />
                  <Text style={styles.flyerHintText}>Tap to view</Text>
                </View>
              </Pressable>
            ) : null}
          </SafeAreaView>
        </LinearGradient>

        {e.flyerURL ? <FlyerLightbox uri={e.flyerURL} open={flyerOpen} onClose={() => setFlyerOpen(false)} /> : null}
        <View style={styles.body}>
          {mine && e.source === 'posted' && !e.flyerURL ? (
            <Pressable onPress={addFlyer} disabled={flyerBusy !== null} style={styles.addFlyer} accessibilityRole="button">
              <Ionicons name="image-outline" size={22} color={colors.blue} />
              <View style={styles.flex}>
                <Text style={styles.addFlyerTitle}>{flyerBusy !== null ? `Uploading… ${Math.round(flyerBusy * 100)}%` : 'Add a flyer'}</Text>
                <Text style={styles.addFlyerSub}>Events with a flyer or photo stand out on the Events tab.</Text>
              </View>
              <Ionicons name="add-circle" size={24} color={colors.blue} />
            </Pressable>
          ) : null}
          {e.status === 'pending' ? (
            <View style={styles.notice}>
              <Ionicons name="time-outline" size={18} color={colors.textSecondary} />
              <Text style={styles.noticeText}>Pending review. Only you can see this until the Collab team approves it, usually within a day.</Text>
            </View>
          ) : null}

          <View style={styles.card}>
            <Pressable onPress={directions} style={styles.venueRow} accessibilityRole="button" accessibilityLabel="Get directions">
              <View style={styles.venueIcon}>
                <Ionicons name="location" size={18} color={colors.blue} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.venue}>{e.venue}</Text>
                <Text style={styles.address}>
                  {e.address} · {e.neighborhood}
                </Text>
              </View>
              <Text style={styles.link}>Directions</Text>
            </Pressable>
            {e.cost ? <Detail icon="cash-outline" text={e.cost} /> : null}
            {e.signUp ? <Detail icon="clipboard-outline" text={e.signUp} /> : null}
            {e.host && !e.collabHosted ? (
              <Pressable onPress={() => e.host && !mine && router.push({ pathname: '/user/[id]', params: { id: e.host.id } })} disabled={mine}>
                <Detail icon="person-outline" text={mine ? 'Posted by you' : `Posted by ${e.host.name}`} />
              </Pressable>
            ) : null}
          </View>

          <Text style={styles.description}>{e.description}</Text>
          {e.link ? (
            <Pressable onPress={() => Linking.openURL(e.link!).catch(() => {})} style={styles.extLink} accessibilityRole="link">
              <Ionicons name="link-outline" size={16} color={colors.blue} />
              <Text style={styles.link} numberOfLines={1}>
                {e.link.replace(/^https?:\/\//, '')}
              </Text>
            </Pressable>
          ) : null}

          {cap ? (
            <View style={styles.spotsCard}>
              <View style={styles.spotsTop}>
                <Text style={styles.spotsTitle}>
                  {goingIds.length >= cap ? 'Full' : `${goingIds.length} of ${cap} spots filled`}
                </Text>
                <Text style={[styles.spotsRight, goingIds.length >= cap && styles.spotsRightFull]}>
                  {goingIds.length >= cap
                    ? waitCount
                      ? `${waitCount} on the waitlist`
                      : 'Waitlist open'
                    : `${cap - goingIds.length} left`}
                </Text>
              </View>
              <View style={styles.spotsTrack}>
                <View
                  style={[
                    styles.spotsFill,
                    { width: `${Math.min(100, (goingIds.length / cap) * 100)}%` },
                    goingIds.length >= cap && styles.spotsFillFull,
                  ]}
                />
              </View>
              {goingIds.length >= cap ? (
                <Text style={styles.spotsNote}>Join the waitlist and you’ll get a notification if a spot opens up.</Text>
              ) : null}
            </View>
          ) : null}

          <View style={styles.goingHead}>
            <Text style={styles.sectionTitle}>Who’s going</Text>
            <Text style={styles.goingCount}>
              {cap
                ? `${goingIds.length}/${cap} going${waitCount ? ` · ${waitCount} waiting` : ''}`
                : goingIds.length
                  ? `${goingIds.length}${friendsGoing ? ` · ${friendsGoing} you’re connected with` : ''}`
                  : ''}
            </Text>
          </View>
          {people.length === 0 && !imGoing ? (
            <Text style={styles.goingEmpty}>
              No one from Collab yet. Be the first, and others will see you’re going.
            </Text>
          ) : (
            <View style={styles.people}>
              {imGoing && profile ? (
                <View style={styles.person}>
                  <Avatar uri={profile.photoURL} name={displayName(profile)} seed={profile.id} size={58} />
                  <Text style={styles.personName}>You</Text>
                  <Text style={styles.personRole}>Going</Text>
                </View>
              ) : null}
              {people.map((p) => (
                <Pressable key={p.id} onPress={() => router.push({ pathname: '/user/[id]', params: { id: p.id } })} style={styles.person} accessibilityRole="button">
                  <Avatar uri={p.photoURL} name={displayName(p)} seed={p.id} size={58} />
                  <Text style={styles.personName} numberOfLines={1}>
                    {displayName(p)}
                  </Text>
                  <Text style={styles.personRole} numberOfLines={1}>
                    {connected.has(p.id) ? 'Connected' : roleLine(p, 1)}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          {e.source === 'curated' ? (
            <Text style={styles.disclaimer}>From public listings{e.verified ? '' : ', not yet confirmed with the venue'}. Times can change, so check before you go.</Text>
          ) : null}
        </View>
      </ScrollView>

      {e.status === 'pending' ? null : (
        <SafeAreaView edges={['bottom']} style={styles.footer}>
          <View style={styles.footerRow}>
            <Button
              title={
                imGoing
                  ? '✓ You’re going'
                  : onWaitlist
                    ? `✓ Waitlist · #${myIndex - (cap ?? 0) + 1}`
                    : full
                      ? 'Join the waitlist'
                      : 'I’m going'
              }
              variant={imGoing || onWaitlist ? 'secondary' : 'primary'}
              onPress={onGoing}
              loading={saving}
              style={styles.flex}
            />
            <Pressable
              onPress={() => chooseCalendar(e)}
              style={({ pressed }) => [styles.calBtn, pressed && { opacity: 0.8 }]}
              accessibilityRole="button"
              accessibilityLabel="Add to calendar"
            >
              <Ionicons name="calendar-outline" size={22} color={colors.blue} />
              <Text style={styles.calText}>Add</Text>
            </Pressable>
          </View>
          <Text style={styles.footerHint}>
            {imGoing || onWaitlist
              ? 'Tap again if your plans change.'
              : full
                ? 'It’s full. Join the waitlist and we’ll let you know if a spot opens.'
                : spotsLeft !== null
                  ? `${spotsLeft} ${spotsLeft === 1 ? 'spot' : 'spots'} left.`
                  : 'Other creatives on Collab will see you’re going.'}
          </Text>
        </SafeAreaView>
      )}
    </View>
  );
}

function Detail({ icon, text }: { icon: React.ComponentProps<typeof Ionicons>['name']; text: string }) {
  const styles = useStyles();
  const colors = useColors();
  return (
    <View style={styles.detail}>
      <Ionicons name={icon} size={17} color={colors.textSecondary} />
      <Text style={styles.detailText}>{text}</Text>
    </View>
  );
}

/** A slightly darker version of a hex color, for the hero gradient. */
function shade(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.round(v * 0.78));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => f(v).toString(16).padStart(2, '0')).join('')}`;
}

const useStyles = makeStyles((colors) => ({
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  calBtn: {
    width: 64,
    height: 56,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calText: { fontFamily: fonts.bodySemibold, fontSize: 11, color: colors.blue, marginTop: 1 },
  fill: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, backgroundColor: colors.bg },
  missingText: { fontFamily: fonts.body, fontSize: 16, color: colors.textSecondary },
  hero: { paddingBottom: 26 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 4 },
  backWrap: { backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 20 },
  moreBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.85)', alignItems: 'center', justifyContent: 'center' },
  flyerWrap: { marginHorizontal: 22, marginTop: 20 },
  flyer: { width: '100%', borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.15)' },
  flyerHint: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  flyerHintText: { fontFamily: fonts.bodySemibold, fontSize: 12, color: 'rgb(255,255,255)' },
  addFlyer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#9CCBE0',
    backgroundColor: '#F4F9FC',
  },
  addFlyerTitle: { fontFamily: fonts.bodySemibold, fontSize: 15, color: colors.text },
  addFlyerSub: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  heroBody: { paddingHorizontal: 22, paddingTop: 18 },
  heroType: { fontFamily: fonts.bodySemibold, fontSize: 12, letterSpacing: 1.2, color: 'rgba(255,255,255,0.9)' },
  heroTitle: { fontFamily: fonts.heading, fontSize: 30, lineHeight: 34, color: colors.white, marginTop: 6 },
  heroWhen: { fontFamily: fonts.bodySemibold, fontSize: 16, color: colors.white, marginTop: 10 },
  heroRepeats: { fontFamily: fonts.body, fontSize: 14, color: 'rgba(255,255,255,0.9)', marginTop: 3 },
  body: { padding: 16, gap: 14, marginTop: -14 },
  notice: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: colors.white, borderRadius: 14, padding: 12 },
  noticeText: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.textSecondary, lineHeight: 19 },
  card: { backgroundColor: colors.white, borderRadius: 18, padding: 14, gap: 12, ...shadow },
  venueRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  venueIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#EAF4F9', alignItems: 'center', justifyContent: 'center' },
  venue: { fontFamily: fonts.bodySemibold, fontSize: 16, color: colors.text },
  address: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary, marginTop: 1 },
  link: { fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.blue },
  detail: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingLeft: 10 },
  detailText: { flex: 1, fontFamily: fonts.body, fontSize: 15, color: colors.text },
  description: { fontFamily: fonts.body, fontSize: 16, lineHeight: 23, color: colors.text, paddingHorizontal: 4 },
  extLink: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4 },
  spotsCard: { backgroundColor: colors.white, borderRadius: 16, padding: 14, gap: 8, marginTop: 4 },
  spotsTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  spotsTitle: { fontFamily: fonts.bodySemibold, fontSize: 15, color: colors.text },
  spotsRight: { fontFamily: fonts.bodySemibold, fontSize: 13, color: '#2F7FA6' },
  spotsRightFull: { color: '#B3412F' },
  spotsTrack: { height: 8, borderRadius: 4, backgroundColor: '#E8E4DC', overflow: 'hidden' },
  spotsFill: { height: 8, borderRadius: 4, backgroundColor: colors.blue },
  spotsFillFull: { backgroundColor: '#D9604C' },
  spotsNote: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  goingHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 8, paddingHorizontal: 4 },
  sectionTitle: { fontFamily: fonts.heading, fontSize: 19, color: colors.text },
  goingCount: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.blue },
  goingEmpty: { fontFamily: fonts.body, fontSize: 14, color: colors.textSecondary, paddingHorizontal: 4, lineHeight: 20 },
  people: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, paddingHorizontal: 4 },
  person: { width: 72, alignItems: 'center' },
  personName: { fontFamily: fonts.bodySemibold, fontSize: 13, color: colors.text, marginTop: 6 },
  personRole: { fontFamily: fonts.body, fontSize: 11, color: colors.textSecondary },
  disclaimer: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, paddingHorizontal: 4, marginTop: 6, lineHeight: 17 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: 'rgba(244,242,236,0.97)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: 6,
  },
  footerHint: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary, textAlign: 'center', paddingBottom: 6 },
}));
