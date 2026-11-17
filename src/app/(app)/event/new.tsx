import { useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from '@/components/ThemedGradient';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Button } from '@/components/Button';
import { CalendarPicker } from '@/components/CalendarPicker';
import { searchPlaces, type Place } from '@/lib/places';
import { Image } from 'expo-image';
import { pickFlyer, type PickedFlyer } from '@/lib/flyer';
import { uploadEventFlyer } from '@/lib/upload';
import { ErrorText } from '@/components/ErrorText';
import { Chip, ChipGrid } from '@/components/onboarding/Chip';
import { useAuth } from '@/lib/auth-context';
import { flyerShape, inNyc, submitEvent, TYPE_META, type EventType } from '@/lib/events';
import { displayName } from '@/lib/labels';
import { BLOCKED_LANGUAGE_MESSAGE, hasBlockedLanguage } from '@/lib/moderation';
import { UI_PREVIEW } from '@/lib/preview';
import { useEvents } from '@/lib/use-events';
import { fonts, radius, makeStyles, useColors } from '@/lib/theme';

const TYPES: EventType[] = ['open-mic', 'jam', 'show', 'meetup'];
const DAYS_AHEAD = 90;

/** Start times from 10 AM to 1:30 AM, every 30 minutes, as minutes after midnight. */
const TIMES = Array.from({ length: 32 }, (_, i) => 600 + i * 30);
const timeText = (mins: number) => {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};

export default function NewEvent() {
  const styles = useStyles();
  const colors = useColors();
  const { user, profile } = useAuth();
  const { refresh } = useEvents();
  const [type, setType] = useState<EventType | null>(null);
  const [title, setTitle] = useState('');
  const [day, setDay] = useState<Date | null>(null);
  const [time, setTime] = useState<number | null>(null);
  const [venue, setVenue] = useState('');
  const [address, setAddress] = useState('');
  const [cost, setCost] = useState('');
  const [signUp, setSignUp] = useState('');
  const [description, setDescription] = useState('');
  const [link, setLink] = useState('');
  const [capacity, setCapacity] = useState('');
  const [flyer, setFlyer] = useState<PickedFlyer | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  // Venue search: suggestions while typing; picking one fills the address and the map pin.
  const [found, setFound] = useState<{ q: string; places: Place[] }>({ q: '', places: [] });
  const [picked, setPicked] = useState<Place | null>(null);
  const query = venue.trim();
  const searching = query.length >= 3 && picked?.name !== query;
  const suggestions = searching && found.q === query ? found.places : [];
  const setSuggestions = (places: Place[]) => setFound({ q: query, places });
  useEffect(() => {
    if (!searching) return;
    let cancelled = false;
    const t = setTimeout(() => {
      searchPlaces(query)
        .then((places) => !cancelled && setFound({ q: query, places }))
        .catch(() => !cancelled && setFound({ q: query, places: [] }));
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, searching]);

  function pickPlace(p: Place) {
    setPicked(p);
    setVenue(p.name);
    setAddress(p.address);
    setSuggestions([]);
  }
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [minDay, maxDay] = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const last = new Date(today);
    last.setDate(today.getDate() + DAYS_AHEAD);
    return [today, last];
  }, []);

  const cap = capacity.trim() ? Number(capacity.trim()) : null;
  const missing = !type
    ? 'Pick what kind of event it is'
    : !title.trim()
      ? 'Give it a name'
      : !day
        ? 'Pick a date'
        : time === null
          ? 'Pick a start time'
          : !venue.trim() && !address.trim()
            ? 'Add the venue or the address'
            : description.trim().length < 10
              ? 'Add a short description'
              : cap !== null && (!Number.isInteger(cap) || cap < 1 || cap > 5000)
                ? 'Capacity should be a whole number, like 25'
                : null;

  async function locate(): Promise<{ lat: number; lng: number; neighborhood: string } | null> {
    if (picked && picked.address === address) return { lat: picked.lat, lng: picked.lng, neighborhood: picked.neighborhood };
    if (UI_PREVIEW || Platform.OS === 'web') return { lat: 40.72 + Math.random() * 0.03, lng: -73.99 + Math.random() * 0.03, neighborhood: 'NYC' };
    const spot = address.trim() || venue.trim();
    const query = /new york|brooklyn|queens|bronx|staten island|\bny\b/i.test(spot) ? spot : `${spot}, New York, NY`;
    const [hit] = await Location.geocodeAsync(query);
    if (!hit || !inNyc(hit.latitude, hit.longitude)) return null;
    const [place] = await Location.reverseGeocodeAsync({ latitude: hit.latitude, longitude: hit.longitude }).catch(() => []);
    return { lat: hit.latitude, lng: hit.longitude, neighborhood: place?.district || place?.subregion || place?.city || 'NYC' };
  }

  async function submit() {
    setError(null);
    if (missing || !type || !day || time === null || !user || !profile) return setError(missing);
    if (hasBlockedLanguage(title, venue, description, signUp, cost)) return setError(BLOCKED_LANGUAGE_MESSAGE);
    const url = link.trim() ? (/^https?:\/\//i.test(link.trim()) ? link.trim() : `https://${link.trim()}`) : undefined;

    setSaving(true);
    try {
      const where = await locate().catch(() => null);
      if (!where) {
        setSaving(false);
        return setError('We couldn’t find that place in NYC. Pick it from the suggestions, or add the street address, like “177 Vanderbilt Ave, Brooklyn”.');
      }
      const start = new Date(day);
      start.setMinutes(time);
      let flyerURL: string | undefined;
      if (flyer && !UI_PREVIEW) {
        setProgress(0);
        flyerURL = await uploadEventFlyer(user.uid, flyer.uri, setProgress);
      }
      await submitEvent({
        title: title.trim(),
        type,
        // Either one is enough; the other falls back to it.
        venue: venue.trim() || address.trim(),
        address: address.trim(),
        neighborhood: where.neighborhood,
        lat: where.lat,
        lng: where.lng,
        startsAt: start.getTime(),
        cost: cost.trim() || undefined,
        signUp: signUp.trim() || undefined,
        description: description.trim(),
        link: url,
        hostId: user.uid,
        hostName: displayName(profile),
        ...(cap ? { capacity: cap } : {}),
        ...(flyerURL && flyer ? { flyerURL, flyerAspect: Math.round(flyer.aspect * 1000) / 1000 } : {}),
      });
      await refresh();
      Alert.alert('Sent for review', 'The Collab team will check it, usually within a day. Until then only you can see it on the Events tab.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e) {
      console.warn('Posting event failed', e);
      setError('Couldn’t post it. Check your connection and try again.');
    } finally {
      setSaving(false);
      setProgress(null);
    }
  }

  async function chooseFlyer() {
    const f = await pickFlyer();
    if (f) setFlyer(f);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <LinearGradient colors={['#E6F1F7', '#F3E9D8']} style={StyleSheet.absoluteFill} />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button">
          <Text style={styles.cancel}>Cancel</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Create an event</Text>
        <View style={{ width: 52 }} />
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
          <Text style={styles.intro}>Hosting a jam, open mic, showcase or meetup? Post it and creatives nearby can say they’re going. Every event is reviewed before it goes live.</Text>

          <Section title="What kind of event?">
            <ChipGrid>
              {TYPES.map((t) => (
                <Chip key={t} label={TYPE_META[t].label} selected={type === t} onPress={() => setType(t)} />
              ))}
            </ChipGrid>
          </Section>

          <Section title="Name">
            <Field value={title} onChangeText={setTitle} placeholder="e.g. Sunday Beat Cypher" maxLength={80} />
          </Section>

          <Section title={day ? `Date · ${day.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}` : 'Date'}>
            <CalendarPicker mode="single" min={minDay} max={maxDay} start={day} onChange={(d) => setDay(d)} />
          </Section>

          <Section title="Starts at">
            {/* Opens scrolled to the evening, when most of these happen. */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hScroll} contentContainerStyle={styles.hRow} contentOffset={{ x: 1240, y: 0 }}>
              {TIMES.map((t) => (
                <Pressable key={t} onPress={() => setTime(t)} style={[styles.timeChip, time === t && styles.chipOn]} accessibilityRole="button">
                  <Text style={[styles.timeText, time === t && styles.textOn]}>{timeText(t)}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </Section>

          <Section title="Flyer" note="Optional, but events with a flyer or photo get a lot more attention.">
            {flyer ? (
              <View style={styles.flyerWrap}>
                <Image source={{ uri: flyer.uri }} style={[styles.flyer, { aspectRatio: flyerShape(flyer.aspect) }]} contentFit="cover" />
                <View style={styles.flyerActions}>
                  <Pressable onPress={chooseFlyer} style={styles.flyerBtn} accessibilityRole="button">
                    <Ionicons name="swap-horizontal" size={16} color={colors.text} />
                    <Text style={styles.flyerBtnText}>Change</Text>
                  </Pressable>
                  <Pressable onPress={() => setFlyer(null)} style={styles.flyerBtn} accessibilityRole="button">
                    <Ionicons name="trash-outline" size={16} color={colors.red} />
                    <Text style={[styles.flyerBtnText, { color: colors.red }]}>Remove</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable onPress={chooseFlyer} style={({ pressed }) => [styles.flyerAdd, pressed && { opacity: 0.8 }]} accessibilityRole="button">
                <View style={styles.flyerIcon}>
                  <Ionicons name="image-outline" size={24} color={colors.blue} />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.flyerAddTitle}>Add a flyer or photo</Text>
                  <Text style={styles.flyerAddSub}>Any shape works. Posters look best.</Text>
                </View>
                <Ionicons name="add-circle" size={26} color={colors.blue} />
              </Pressable>
            )}
          </Section>

          <Section title="Where" note="Start typing the venue and pick it, or just add an address.">
            <Field
              value={venue}
              onChangeText={(t) => {
                setVenue(t);
                if (picked && t !== picked.name) setPicked(null);
              }}
              placeholder="Venue name, e.g. Brooklyn Music Kitchen"
              maxLength={80}
            />
            {suggestions.length ? (
              <View style={styles.suggest}>
                {suggestions.map((p, i) => (
                  <Pressable
                    key={`${p.name}${p.address}`}
                    onPress={() => pickPlace(p)}
                    style={({ pressed }) => [styles.suggestRow, i > 0 && styles.suggestLine, pressed && { opacity: 0.7 }]}
                    accessibilityRole="button"
                    accessibilityLabel={`${p.name}, ${p.address}`}
                  >
                    <Ionicons name="location-outline" size={18} color={colors.blue} />
                    <View style={styles.flex}>
                      <Text style={styles.suggestName} numberOfLines={1}>
                        {p.name}
                      </Text>
                      <Text style={styles.suggestAddr} numberOfLines={1}>
                        {p.address}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            ) : null}
            <Field
              value={address}
              onChangeText={(t) => {
                setAddress(t);
                if (picked && t !== picked.address) setPicked(null);
              }}
              placeholder="Street address, e.g. 177 Vanderbilt Ave, Brooklyn"
              maxLength={140}
              autoCorrect={false}
            />
          </Section>

          <Section title="Details">
            <Field value={description} onChangeText={setDescription} placeholder="What should people expect? Who should come? Bring anything?" maxLength={1000} multiline />
          </Section>

          <View style={styles.optionalBox}>
            <View style={styles.optionalHead}>
              <Text style={styles.optionalTitle}>Extras</Text>
              <View style={styles.optionalPill}>
                <Text style={styles.optionalPillText}>OPTIONAL</Text>
              </View>
            </View>
            <Text style={styles.optionalNote}>Skip any of these.</Text>
            <OptionalField label="Cost" value={cost} onChangeText={setCost} placeholder="e.g. Free, $10 at the door" maxLength={60} />
            <OptionalField label="How to join" value={signUp} onChangeText={setSignUp} placeholder="e.g. Sign-up list at 7 PM" maxLength={120} />
            <OptionalField
              label="Link"
              value={link}
              onChangeText={setLink}
              placeholder="Tickets, Instagram, flyer"
              maxLength={300}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            <OptionalField
              label="Capacity"
              hint="Once it’s full, people can join a waitlist and get notified if a spot opens."
              value={capacity}
              onChangeText={(t) => setCapacity(t.replace(/[^0-9]/g, ''))}
              placeholder="e.g. 30"
              maxLength={4}
              keyboardType="number-pad"
            />
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <ErrorText message={error} />
          <Button
            title={progress !== null ? `Uploading flyer… ${Math.round(progress * 100)}%` : 'Submit for review'}
            onPress={submit}
            loading={saving && progress === null}
            disabled={!!missing || saving}
          />
          {missing ? <Text style={styles.hint}>{missing}</Text> : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {note ? <Text style={styles.sectionNote}>{note}</Text> : null}
      {children}
    </View>
  );
}

function OptionalField({ label, hint, ...props }: React.ComponentProps<typeof TextInput> & { label: string; hint?: string }) {
  const styles = useStyles();
  return (
    <View style={styles.optField}>
      <Text style={styles.optLabel}>{label}</Text>
      <Field {...props} />
      {hint ? <Text style={styles.sectionNote}>{hint}</Text> : null}
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  cancel: { fontFamily: fonts.bodyMedium, fontSize: 16, color: colors.blue, width: 52 },
  headerTitle: { fontFamily: fonts.heading, fontSize: 18, color: colors.text },
  content: { paddingHorizontal: 20, paddingBottom: 24, gap: 18 },
  intro: { fontFamily: fonts.body, fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  section: { gap: 8 },
  sectionTitle: { fontFamily: fonts.bodySemibold, fontSize: 15, color: colors.text },
  sectionNote: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary, marginTop: -2 },
  suggest: { backgroundColor: colors.white, borderRadius: 14, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', marginTop: -2 },
  suggestRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10 },
  suggestLine: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  suggestName: { fontFamily: fonts.bodySemibold, fontSize: 15, color: colors.text },
  suggestAddr: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary },
  optionalBox: { gap: 10, padding: 14, borderRadius: 18, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#C9D6E2', backgroundColor: 'rgba(255,255,255,0.45)' },
  optionalHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  optionalTitle: { fontFamily: fonts.bodySemibold, fontSize: 15, color: colors.text },
  optionalPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: '#E6F1F7' },
  optionalPillText: { fontFamily: fonts.bodySemibold, fontSize: 10, letterSpacing: 1, color: '#2F7FA6' },
  optionalNote: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary, marginTop: -6 },
  optField: { gap: 5 },
  optLabel: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.textSecondary },
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
  dayChip: { width: 58, paddingVertical: 8, borderRadius: 14, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  dayWeek: { fontFamily: fonts.body, fontSize: 11, color: colors.textSecondary },
  dayNum: { fontFamily: fonts.heading, fontSize: 20, color: colors.text, marginVertical: 1 },
  timeChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.full, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  timeText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.text },
  chipOn: { backgroundColor: colors.blue, borderColor: colors.blue },
  textOn: { color: colors.white },
  footer: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 6, gap: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  hint: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary, textAlign: 'center' },
  flyerAdd: {
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
  flyerIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: '#E3F0F6', alignItems: 'center', justifyContent: 'center' },
  flyerAddTitle: { fontFamily: fonts.bodySemibold, fontSize: 16, color: colors.text },
  flyerAddSub: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  flyerWrap: { gap: 10 },
  flyer: { width: '100%', borderRadius: 18, backgroundColor: colors.bgSecondary },
  flyerActions: { flexDirection: 'row', gap: 10 },
  flyerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: colors.white,
  },
  flyerBtnText: { fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.text },
}));
