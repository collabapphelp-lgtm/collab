import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { flyerShape, TYPE_META } from '@/lib/events';
import { Image } from 'expo-image';
import { useEvents } from '@/lib/use-events';
import { loadSubmissions, refreshTeam, reviewEvent, setFeatured, useTeam, type Submission } from '@/lib/team';
import { fonts, makeStyles, useColors } from '@/lib/theme';

/** Collab team only: approve or reject events people posted, and take down live ones. */
export default function ReviewEvents() {
  const styles = useStyles();
  const colors = useColors();
  const { admin, checked } = useTeam();
  const { refresh: refreshEvents } = useEvents();
  const [data, setData] = useState<{ pending: Submission[]; approved: Submission[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [collab, setCollab] = useState<Record<string, boolean>>({});
  const [feat, setFeat] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await loadSubmissions());
    } catch {
      setError('Couldn’t load submissions. Pull down to try again.');
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function decide(e: Submission, decision: 'approve' | 'reject' | 'remove') {
    setBusy(e.id);
    try {
      await reviewEvent(e.id, decision, !!collab[e.id], !!feat[e.id]);
      await Promise.all([load(), refreshTeam()]);
      refreshEvents();
    } catch {
      Alert.alert('That didn’t go through', 'Check your connection and try again.');
    } finally {
      setBusy(null);
    }
  }

  function confirm(e: Submission, decision: 'reject' | 'remove') {
    Alert.alert(
      decision === 'reject' ? 'Reject this event?' : 'Take this event down?',
      decision === 'reject' ? 'It won’t be shown. The host isn’t notified.' : 'It disappears from everyone’s Events tab.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: decision === 'reject' ? 'Reject' : 'Take down', style: 'destructive', onPress: () => decide(e, decision) },
      ],
    );
  }

  // Live events: flip Featured right away (undo if it fails).
  async function toggleFeatured(e: Submission, v: boolean) {
    setFeat((f) => ({ ...f, [e.id]: v }));
    try {
      await setFeatured(e.id, v);
      refreshEvents();
    } catch {
      setFeat((f) => ({ ...f, [e.id]: !v }));
      Alert.alert('That didn’t go through', 'Check your connection and try again.');
    }
  }

  if (checked && !admin) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.empty}>This screen is for the Collab team.</Text>
      </SafeAreaView>
    );
  }

  const card = (e: Submission, pending: boolean) => {
    const meta = TYPE_META[e.type as keyof typeof TYPE_META];
    const when = new Date(e.startsAt).toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'America/New_York',
    });
    return (
      <View key={e.id} style={styles.card}>
        <Text style={[styles.kind, { color: meta?.color ?? colors.blue }]}>{(meta?.label ?? e.type).toUpperCase()}</Text>
        <Text style={styles.title}>{e.title}</Text>
        <Text style={styles.line}>
          {when} · {e.venue}
        </Text>
        <Text style={styles.line}>{e.address}</Text>
        {e.cost || e.signUp ? (
          <Text style={styles.line}>
            {[e.cost && `Cost: ${e.cost}`, e.signUp && `Sign-up: ${e.signUp}`].filter(Boolean).join(' · ')}
          </Text>
        ) : null}
        {e.description ? <Text style={styles.desc}>{e.description}</Text> : null}
        {e.flyerURL ? (
          <Image source={{ uri: e.flyerURL }} style={[styles.flyer, { aspectRatio: flyerShape(e.flyerAspect ?? undefined) }]} contentFit="contain" />
        ) : null}
        {e.link ? <Text style={styles.link}>{e.link}</Text> : null}
        <Pressable onPress={() => router.push({ pathname: '/user/[id]', params: { id: e.hostId } })}>
          <Text style={styles.host}>Posted by {e.hostName} ›</Text>
        </Pressable>

        {pending ? (
          <>
            <View style={styles.toggle}>
              <Text style={styles.toggleText}>Collab event (gold styling)</Text>
              <Switch value={!!collab[e.id]} onValueChange={(v) => setCollab((c) => ({ ...c, [e.id]: v }))} />
            </View>
            <View style={styles.toggle}>
              <Text style={styles.toggleText}>Feature this (shows under Featured)</Text>
              <Switch value={!!feat[e.id]} onValueChange={(v) => setFeat((f) => ({ ...f, [e.id]: v }))} />
            </View>
            <View style={styles.buttons}>
              <Pressable onPress={() => confirm(e, 'reject')} disabled={!!busy} style={[styles.btn, styles.reject]} accessibilityRole="button">
                <Text style={styles.rejectText}>Reject</Text>
              </Pressable>
              <Pressable onPress={() => decide(e, 'approve')} disabled={!!busy} style={[styles.btn, styles.approve]} accessibilityRole="button">
                {busy === e.id ? <ActivityIndicator color={colors.white} /> : <Text style={styles.approveText}>Approve</Text>}
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <View style={styles.toggle}>
              <Text style={styles.toggleText}>Feature this (shows under Featured)</Text>
              <Switch value={feat[e.id] ?? !!e.featured} onValueChange={(v) => toggleFeatured(e, v)} />
            </View>
            <Pressable onPress={() => confirm(e, 'remove')} disabled={!!busy} style={styles.remove} accessibilityRole="button">
              <Text style={styles.removeText}>Take down</Text>
            </Pressable>
          </>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.h1}>Review events</Text>
        <View style={{ width: 26 }} />
      </View>
      <ScrollView contentContainerStyle={styles.body} refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!data && !error ? <ActivityIndicator color={colors.blue} style={{ marginTop: 40 }} /> : null}
        {data ? (
          <>
            <Text style={styles.section}>Waiting for review ({data.pending.length})</Text>
            {data.pending.length ? data.pending.map((e) => card(e, true)) : <Text style={styles.empty}>Nothing waiting. You’ll get a notification when someone posts.</Text>}
            {data.approved.length ? <Text style={styles.section}>Live and upcoming ({data.approved.length})</Text> : null}
            {data.approved.map((e) => card(e, false))}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles((colors) => ({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  h1: { fontFamily: fonts.heading, fontSize: 20, color: colors.text },
  body: { padding: 16, paddingBottom: 48, gap: 12 },
  section: { fontFamily: fonts.bodySemibold, fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.textMuted, marginTop: 8 },
  card: { backgroundColor: colors.white, borderRadius: 18, padding: 16, gap: 4 },
  kind: { fontFamily: fonts.bodySemibold, fontSize: 11, letterSpacing: 1 },
  title: { fontFamily: fonts.heading, fontSize: 19, color: colors.text, marginBottom: 2 },
  line: { fontFamily: fonts.body, fontSize: 14, color: colors.textSecondary },
  flyer: { width: '100%', borderRadius: 14, marginTop: 8, backgroundColor: colors.bgSecondary },
  desc: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.text, marginTop: 6 },
  link: { fontFamily: fonts.body, fontSize: 13, color: colors.blue, marginTop: 2 },
  host: { fontFamily: fonts.bodySemibold, fontSize: 13, color: colors.blue, marginTop: 6 },
  toggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  toggleText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.text },
  buttons: { flexDirection: 'row', gap: 10, marginTop: 10 },
  btn: { flex: 1, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  reject: { borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.white },
  rejectText: { fontFamily: fonts.bodySemibold, fontSize: 15, color: colors.red },
  approve: { backgroundColor: '#2E8B57' },
  approveText: { fontFamily: fonts.bodySemibold, fontSize: 15, color: colors.white },
  remove: { alignSelf: 'flex-start', marginTop: 8, paddingVertical: 6 },
  removeText: { fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.red },
  empty: { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted, textAlign: 'center', marginTop: 12 },
  error: { fontFamily: fonts.body, fontSize: 14, color: colors.red, textAlign: 'center' },
}));
