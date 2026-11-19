import { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import { Button } from '@/components/Button';
import { CalendarPicker } from '@/components/CalendarPicker';
import { ErrorText } from '@/components/ErrorText';
import { Chip, ChipGrid } from '@/components/onboarding/Chip';
import { curatedListing, inNyc, setPreviewOverride, TYPE_META, ymd, type EventType } from '@/lib/events';
import { UI_PREVIEW } from '@/lib/preview';
import { adminUpdateEvent, useTeam } from '@/lib/team';
import { useEvents } from '@/lib/use-events';
import { fonts, makeStyles, radius, useColors } from '@/lib/theme';

/**
 * Collab team only: edit any listing. Posted events are updated directly; built-in listings
 * (the open mics, jams and featured shows in the app's code) get an override that applies to
 * everyone right away, and can be reset to the original.
 */
const TYPES: EventType[] = ['open-mic', 'jam', 'show', 'meetup'];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
// Every 15 minutes from 9:00 AM to 3:45 AM (minutes after midnight; 1440+ is after midnight).
const TIMES = Array.from({ length: 76 }, (_, i) => 540 + i * 15);
const CHIP_W = 92;

const timeText = (mins: number) => {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};
const toHHMM = (mins: number) => {
  const h = Math.floor(mins / 60) % 24;
  return `${String(h).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
};
/** A clock time as minutes, nudged into the 9 AM–4 AM picker range (early-morning times count as after midnight). */
const toMins = (d: Date) => {
  const m = d.getHours() * 60 + d.getMinutes();
  return m < 540 ? m + 1440 : m;
};
const snap = (m: number) => TIMES.reduce((best, t) => (Math.abs(t - m) < Math.abs(best - m) ? t : best), TIMES[0]);

export default function EditEvent() {
  const styles = useStyles();
  const colors = useColors();
  const { key } = useLocalSearchParams<{ key: string }>();
  const { events, refresh } = useEvents();
  const team = useTeam();
  const occ = events?.find((x) => x.key === key);
  const curated = occ?.source === 'curated' ? curatedListing(occ.eventId) : null;
  const weekly = curated?.kind === 'weekly';

  const [type, setType] = useState<EventType>(occ?.type ?? 'show');
  const [title, setTitle] = useState(occ?.title ?? '');
  const [featured, setFeatured] = useState(!!occ?.featured);
  const [collabHosted, setCollabHosted] = useState(!!occ?.collabHosted);
  const [verified, setVerified] = useState(curated?.e.verified ?? true);
  const [days, setDays] = useState<number[]>(curated?.kind === 'weekly' ? curated.e.days : []);
  // Something starting at 1 AM belongs to the night before (the picker counts it as after midnight).
  const [day, setDay] = useState<Date | null>(() => {
    if (!occ) return null;
    const d = new Date(occ.start);
    if (d.getHours() < 9) d.setDate(d.getDate() - 1);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [start, setStart] = useState<number>(occ ? snap(toMins(new Date(occ.start))) : 1200);
  const [end, setEnd] = useState<number | null>(occ?.end ? snap(toMins(new Date(occ.end))) : null);
  const [venue, setVenue] = useState(occ?.venue ?? '');
  const [address, setAddress] = useState(occ?.address ?? '');
  const [description, setDescription] = useState(occ?.description ?? '');
  const [cost, setCost] = useState(occ?.cost ?? '');
  const [signUp, setSignUp] = useState(occ?.signUp ?? '');
  const [link, setLink] = useState(occ?.link ?? '');
  const [capacity, setCapacity] = useState(occ?.capacity ? String(occ.capacity) : '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [minDay, maxDay] = useMemo(() => {
    const a = new Date();
    a.setHours(0, 0, 0, 0);
    const b = new Date(a);
    b.setDate(a.getDate() + 365);
    return [a, b];
  }, []);

  if (team.checked && !team.admin) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.note}>Editing listings is for the Collab team.</Text>
      </SafeAreaView>
    );
  }
  if (!occ) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.note}>{events === null ? 'Loading…' : 'This event isn’t available anymore.'}</Text>
      </SafeAreaView>
    );
  }
  const e = occ;

  async function locate(): Promise<{ lat: number; lng: number; neighborhood: string } | null> {
    if (UI_PREVIEW || Platform.OS === 'web') return { lat: e.lat, lng: e.lng, neighborhood: e.neighborhood };
    const spot = address.trim() || venue.trim();
    const q = /new york|brooklyn|queens|bronx|staten island|\bny\b/i.test(spot) ? spot : `${spot}, New York, NY`;
    const [hit] = await Location.geocodeAsync(q);
    if (!hit || !inNyc(hit.latitude, hit.longitude)) return null;
    const [place] = await Location.reverseGeocodeAsync({ latitude: hit.latitude, longitude: hit.longitude }).catch(() => []);
    return { lat: hit.latitude, lng: hit.longitude, neighborhood: place?.district || place?.subregion || place?.city || e.neighborhood };
  }

  async function save() {
    setError(null);
    if (!title.trim()) return setError('Add a title');
    if (!venue.trim()) return setError('Add the venue');
    if (weekly && days.length === 0) return setError('Pick at least one day of the week');
    if (!weekly && !day) return setError('Pick a date');
    const cap = capacity.trim() ? Number(capacity.trim()) : null;
    if (cap !== null && (!Number.isInteger(cap) || cap < 1 || cap > 5000)) return setError('Spots should be a whole number, like 25');
    const url = link.trim() ? (/^https?:\/\//i.test(link.trim()) ? link.trim() : `https://${link.trim()}`) : null;

    setSaving(true);
    try {
      const fields: Record<string, unknown> = {
        title: title.trim(),
        type,
        venue: venue.trim(),
        address: address.trim(),
        description: description.trim(),
        cost: cost.trim() || null,
        signUp: signUp.trim() || null,
        link: url,
        featured,
      };
      if (address.trim() !== e.address || venue.trim() !== e.venue) {
        const where = await locate().catch(() => null);
        if (!where) {
          setSaving(false);
          return setError('We couldn’t find that address in NYC. Try the street address, like “177 Vanderbilt Ave, Brooklyn”.');
        }
        Object.assign(fields, where);
      }
      if (e.source === 'posted') {
        const s = new Date(day!);
        s.setMinutes(start);
        let en: Date | null = null;
        if (end !== null) {
          en = new Date(day!);
          en.setMinutes(end);
          if (en <= s) en = new Date(en.getTime() + 86400000);
        }
        Object.assign(fields, { startsAt: s.getTime(), endsAt: en ? en.getTime() : null, capacity: cap, collabHosted });
      } else {
        Object.assign(fields, { time: toHHMM(start), endTime: end !== null ? toHHMM(end) : null, verified });
        if (weekly) fields.days = [...days].sort();
        else fields.date = ymd(day!);
      }
      await adminUpdateEvent(e.eventId, e.source, fields);
      if (UI_PREVIEW && e.source === 'curated') setPreviewOverride(e.eventId, fields as never);
      await refresh();
      router.back();
    } catch (err) {
      console.warn('Admin edit failed', err);
      setError('Couldn’t save. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  function resetOriginal() {
    Alert.alert('Reset to the original listing?', 'Your edits to this listing are removed for everyone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: async () => {
          try {
            await adminUpdateEvent(e.eventId, 'curated', null, true);
            if (UI_PREVIEW) setPreviewOverride(e.eventId, null);
            await refresh();
            router.back();
          } catch {
            Alert.alert('Couldn’t reset', 'Check your connection and try again.');
          }
        },
      },
    ]);
  }

  const startIdx = TIMES.indexOf(start);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button">
          <Text style={styles.cancel}>Cancel</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Edit event</Text>
        <View style={{ width: 52 }} />
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
          <View style={styles.banner}>
            <Text style={styles.bannerTitle}>Collab team edit</Text>
            <Text style={styles.bannerText}>
              {e.source === 'curated'
                ? weekly
                  ? `Built-in listing that repeats (${e.repeats}). Changes apply to every date and show for everyone right away.`
                  : 'Built-in listing. Changes show for everyone right away.'
                : `Posted by ${e.host?.name ?? 'a member'}. Changes show for everyone right away.`}
            </Text>
          </View>

          <View style={styles.card}>
            <Toggle label="Featured" note="Shows under Featured with a gold star" value={featured} onChange={setFeatured} />
            {e.source === 'posted' ? (
              <Toggle label="Collab event" note="Gold Hosted by Collab styling" value={collabHosted} onChange={setCollabHosted} />
            ) : (
              <Toggle label="Confirmed with the venue" note="Hides the not-yet-confirmed note" value={verified} onChange={setVerified} />
            )}
          </View>

          <Section title="Kind of event">
            <ChipGrid>
              {TYPES.map((t) => (
                <Chip key={t} label={TYPE_META[t].label} selected={type === t} onPress={() => setType(t)} />
              ))}
            </ChipGrid>
          </Section>

          <Section title="Name">
            <Field value={title} onChangeText={setTitle} maxLength={80} />
          </Section>

          {weekly ? (
            <Section title="Repeats every">
              <View style={styles.dayRow}>
                {DAY_SHORT.map((d, i) => {
                  const on = days.includes(i);
                  return (
                    <Pressable
                      key={d}
                      onPress={() => setDays((xs) => (on ? xs.filter((x) => x !== i) : [...xs, i]))}
                      style={[styles.dayChip, on && styles.chipOn]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                    >
                      <Text style={[styles.dayText, on && styles.textOn]}>{d}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </Section>
          ) : (
            <Section title={day ? `Date · ${day.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}` : 'Date'}>
              <CalendarPicker mode="single" min={minDay} max={maxDay} start={day} onChange={(d) => setDay(d)} />
            </Section>
          )}

          <Section title={`Starts at · ${timeText(start)}`}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.hScroll}
              contentContainerStyle={styles.hRow}
              contentOffset={{ x: Math.max(0, startIdx - 1) * (CHIP_W + 8), y: 0 }}
            >
              {TIMES.map((t) => (
                <Pressable key={t} onPress={() => setStart(t)} style={[styles.timeChip, start === t && styles.chipOn]} accessibilityRole="button">
                  <Text style={[styles.timeText, start === t && styles.textOn]}>{timeText(t)}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </Section>

          <Section title={`Ends at · ${end !== null ? timeText(end) : 'not set'}`}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.hScroll}
              contentContainerStyle={styles.hRow}
              contentOffset={{ x: Math.max(0, startIdx) * (CHIP_W + 8), y: 0 }}
            >
              <Pressable onPress={() => setEnd(null)} style={[styles.timeChip, end === null && styles.chipOn]} accessibilityRole="button">
                <Text style={[styles.timeText, end === null && styles.textOn]}>No end</Text>
              </Pressable>
              {TIMES.map((t) => (
                <Pressable key={t} onPress={() => setEnd(t)} style={[styles.timeChip, end === t && styles.chipOn]} accessibilityRole="button">
                  <Text style={[styles.timeText, end === t && styles.textOn]}>{timeText(t)}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </Section>

          <Section title="Where">
            <Field value={venue} onChangeText={setVenue} placeholder="Venue" maxLength={80} />
            <Field value={address} onChangeText={setAddress} placeholder="Street address" maxLength={140} autoCorrect={false} />
            <Text style={styles.note}>Change the address and the map pin moves to match.</Text>
          </Section>

          <Section title="Details">
            <Field value={description} onChangeText={setDescription} maxLength={1000} multiline />
          </Section>

          <Section title="Extras">
            <Labeled label="Cost">
              <Field value={cost} onChangeText={setCost} placeholder="e.g. Free, $10 at the door" maxLength={60} />
            </Labeled>
            <Labeled label="How to join">
              <Field value={signUp} onChangeText={setSignUp} placeholder="e.g. Sign-up list at 7 PM" maxLength={120} />
            </Labeled>
            <Labeled label="Link">
              <Field value={link} onChangeText={setLink} placeholder="Tickets, Instagram, venue page" maxLength={300} autoCapitalize="none" autoCorrect={false} keyboardType="url" />
            </Labeled>
            {e.source === 'posted' ? (
              <Labeled label="Spots (blank = no limit)">
                <Field value={capacity} onChangeText={(t) => setCapacity(t.replace(/[^0-9]/g, ''))} placeholder="No limit" maxLength={4} keyboardType="number-pad" />
              </Labeled>
            ) : null}
          </Section>

          {curated?.edited ? (
            <Pressable onPress={resetOriginal} style={styles.reset} accessibilityRole="button">
              <Text style={[styles.resetText, { color: colors.red }]}>Reset to the original listing</Text>
            </Pressable>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          <ErrorText message={error} />
          <Button title="Save changes" onPress={save} loading={saving} disabled={saving} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Toggle({ label, note, value, onChange }: { label: string; note: string; value: boolean; onChange: (v: boolean) => void }) {
  const styles = useStyles();
  return (
    <View style={styles.toggle}>
      <View style={styles.flex}>
        <Text style={styles.toggleLabel}>{label}</Text>
        <Text style={styles.note}>{note}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} />
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  const styles = useStyles();
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

function Field(props: React.ComponentProps<typeof TextInput>) {
  const styles = useStyles();
  const colors = useColors();
  return <TextInput placeholderTextColor={colors.textMuted} {...props} style={[styles.input, props.multiline && styles.inputMulti]} />;
}

const useStyles = makeStyles((colors) => ({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, padding: 24 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  cancel: { fontFamily: fonts.bodyMedium, fontSize: 16, color: colors.blue, width: 52 },
  headerTitle: { fontFamily: fonts.heading, fontSize: 18, color: colors.text },
  content: { paddingHorizontal: 20, paddingBottom: 24, gap: 18 },
  banner: { backgroundColor: '#FFF3D6', borderRadius: 14, padding: 12, gap: 2 },
  bannerTitle: { fontFamily: fonts.bodySemibold, fontSize: 14, color: '#7A5500' },
  bannerText: { fontFamily: fonts.body, fontSize: 13, color: '#7A5500', lineHeight: 18 },
  card: { backgroundColor: colors.white, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 4 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  toggleLabel: { fontFamily: fonts.bodySemibold, fontSize: 15, color: colors.text },
  section: { gap: 8 },
  sectionTitle: { fontFamily: fonts.bodySemibold, fontSize: 15, color: colors.text },
  label: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.textSecondary },
  note: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
  input: {
    backgroundColor: colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.text,
  },
  inputMulti: { minHeight: 96, textAlignVertical: 'top' },
  hScroll: { flexGrow: 0 },
  hRow: { gap: 8, paddingRight: 8 },
  timeChip: {
    width: CHIP_W,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: radius.full,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  timeText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.text },
  dayRow: { flexDirection: 'row', gap: 6 },
  dayChip: { flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  dayText: { fontFamily: fonts.bodySemibold, fontSize: 13, color: colors.text },
  chipOn: { backgroundColor: colors.blue, borderColor: colors.blue },
  textOn: { color: colors.white },
  reset: { alignItems: 'center', paddingVertical: 8 },
  resetText: { fontFamily: fonts.bodySemibold, fontSize: 15 },
  footer: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 6, gap: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
}));
