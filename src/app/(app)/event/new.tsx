import { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from '@/components/ThemedGradient';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { Button } from '@/components/Button';
import { ErrorText } from '@/components/ErrorText';
import { Chip, ChipGrid } from '@/components/onboarding/Chip';
import { useAuth } from '@/lib/auth-context';
import { inNyc, submitEvent, TYPE_META, type EventType } from '@/lib/events';
import { displayName } from '@/lib/labels';
import { BLOCKED_LANGUAGE_MESSAGE, hasBlockedLanguage } from '@/lib/moderation';
import { UI_PREVIEW } from '@/lib/preview';
import { useEvents } from '@/lib/use-events';
import { fonts, radius, makeStyles, useColors } from '@/lib/theme';

const TYPES: EventType[] = ['open-mic', 'jam', 'show', 'meetup'];
const DAYS_AHEAD = 30;

/** Start times from 10 AM to 1:30 AM, every 30 minutes, as minutes after midnight. */
const TIMES = Array.from({ length: 32 }, (_, i) => 600 + i * 30);
const timeText = (mins: number) => {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};

export default function NewEvent() {
  const styles = useStyles();
  const { user, profile } = useAuth();
  const { refresh } = useEvents();
  const [type, setType] = useState<EventType | null>(null);
  const [title, setTitle] = useState('');
  const [dayIndex, setDayIndex] = useState<number | null>(null);
  const [time, setTime] = useState<number | null>(null);
  const [venue, setVenue] = useState('');
  const [address, setAddress] = useState('');
  const [cost, setCost] = useState('');
  const [signUp, setSignUp] = useState('');
  const [description, setDescription] = useState('');
  const [link, setLink] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const days = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Array.from({ length: DAYS_AHEAD }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      return d;
    });
  }, []);

  const missing = !type ? 'Pick what kind of event it is' : !title.trim() ? 'Give it a name' : dayIndex === null ? 'Pick a date' : time === null ? 'Pick a start time' : !venue.trim() ? 'Add the venue' : !address.trim() ? 'Add the address' : description.trim().length < 10 ? 'Add a short description' : null;

  async function locate(): Promise<{ lat: number; lng: number; neighborhood: string } | null> {
    if (UI_PREVIEW || Platform.OS === 'web') return { lat: 40.72 + Math.random() * 0.03, lng: -73.99 + Math.random() * 0.03, neighborhood: 'NYC' };
    const query = /new york|brooklyn|queens|bronx|staten island|\bny\b/i.test(address) ? address : `${address}, New York, NY`;
    const [hit] = await Location.geocodeAsync(query);
    if (!hit || !inNyc(hit.latitude, hit.longitude)) return null;
    const [place] = await Location.reverseGeocodeAsync({ latitude: hit.latitude, longitude: hit.longitude }).catch(() => []);
    return { lat: hit.latitude, lng: hit.longitude, neighborhood: place?.district || place?.subregion || place?.city || 'NYC' };
  }

  async function submit() {
    setError(null);
    if (missing || !type || dayIndex === null || time === null || !user || !profile) return setError(missing);
    if (hasBlockedLanguage(title, venue, description, signUp, cost)) return setError(BLOCKED_LANGUAGE_MESSAGE);
    const url = link.trim() ? (/^https?:\/\//i.test(link.trim()) ? link.trim() : `https://${link.trim()}`) : undefined;

    setSaving(true);
    try {
      const where = await locate().catch(() => null);
      if (!where) {
        setSaving(false);
        return setError('We couldn’t find that address in NYC. Try the street address, like “177 Vanderbilt Ave, Brooklyn”.');
      }
      const start = new Date(days[dayIndex]);
      start.setMinutes(time);
      await submitEvent({
        title: title.trim(),
        type,
        venue: venue.trim(),
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
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <LinearGradient colors={['#E6F1F7', '#F3E9D8']} style={StyleSheet.absoluteFill} />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button">
          <Text style={styles.cancel}>Cancel</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Post an event</Text>
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

          <Section title="Date">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hScroll} contentContainerStyle={styles.hRow}>
              {days.map((d, i) => (
                <Pressable key={i} onPress={() => setDayIndex(i)} style={[styles.dayChip, dayIndex === i && styles.chipOn]} accessibilityRole="button">
                  <Text style={[styles.dayWeek, dayIndex === i && styles.textOn]}>{i === 0 ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'short' })}</Text>
                  <Text style={[styles.dayNum, dayIndex === i && styles.textOn]}>{d.getDate()}</Text>
                  <Text style={[styles.dayWeek, dayIndex === i && styles.textOn]}>{d.toLocaleDateString('en-US', { month: 'short' })}</Text>
                </Pressable>
              ))}
            </ScrollView>
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

          <Section title="Where">
            <Field value={venue} onChangeText={setVenue} placeholder="Venue name, e.g. Brooklyn Music Kitchen" maxLength={80} />
            <Field value={address} onChangeText={setAddress} placeholder="Street address, e.g. 177 Vanderbilt Ave, Brooklyn" maxLength={140} autoCorrect={false} />
          </Section>

          <Section title="Details">
            <Field value={description} onChangeText={setDescription} placeholder="What should people expect? Who should come? Bring anything?" maxLength={1000} multiline />
            <Field value={cost} onChangeText={setCost} placeholder="Cost (optional), e.g. Free, $10 at the door" maxLength={60} />
            <Field value={signUp} onChangeText={setSignUp} placeholder="How to join (optional), e.g. Sign-up list at 7 PM" maxLength={120} />
            <Field value={link} onChangeText={setLink} placeholder="Link (optional): tickets, Instagram, flyer" maxLength={300} autoCapitalize="none" autoCorrect={false} keyboardType="url" />
          </Section>
        </ScrollView>

        <View style={styles.footer}>
          <ErrorText message={error} />
          <Button title="Submit for review" onPress={submit} loading={saving} disabled={!!missing} />
          {missing ? <Text style={styles.hint}>{missing}</Text> : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
}));
