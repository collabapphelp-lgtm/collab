import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { VOICE_NOTE_MAX_MS } from '@/lib/connections';
import { colors, fonts } from '@/lib/theme';

export function formatClock(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// Fixed-looking waveform bars per message (a seeded pattern, not real levels) so bubbles read as audio.
function bars(seed: string, n = 28) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return Array.from({ length: n }, (_, i) => {
    h = (h * 1103515245 + 12345) >>> 0;
    const base = 0.35 + 0.65 * Math.abs(Math.sin(i / 3.1));
    return Math.max(0.18, Math.min(1, base * (0.55 + ((h >>> 16) % 100) / 220)));
  });
}

/** A playable voice note inside a chat bubble. The player is only created once you tap play. */
export function VoiceBubble(props: { id: string; url: string; durationMs: number; mine: boolean }) {
  const [started, setStarted] = useState(false);
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  const total = status.duration > 0 ? status.duration * 1000 : props.durationMs;
  const progress = started && total > 0 ? Math.min(1, (status.currentTime * 1000) / total) : 0;
  const pattern = useMemo(() => bars(props.id), [props.id]);

  useEffect(() => {
    if (status.didJustFinish) {
      player.pause();
      player.seekTo(0).catch(() => {});
    }
  }, [status.didJustFinish, player]);

  async function toggle() {
    if (status.playing) return player.pause();
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(() => {});
    if (!started) {
      player.replace({ uri: props.url });
      setStarted(true);
    }
    player.play();
  }

  const fg = props.mine ? colors.white : colors.blue;
  const dim = props.mine ? 'rgba(255,255,255,0.45)' : '#C9D6E2';
  return (
    <View style={styles.voice}>
      <Pressable
        onPress={toggle}
        hitSlop={8}
        style={[styles.playBtn, { backgroundColor: props.mine ? 'rgba(255,255,255,0.22)' : '#E6F1F7' }]}
        accessibilityRole="button"
        accessibilityLabel={status.playing ? 'Pause voice note' : 'Play voice note'}
      >
        {started && status.isBuffering && !status.playing ? (
          <Ionicons name="ellipsis-horizontal" size={18} color={fg} />
        ) : (
          <Ionicons name={status.playing ? 'pause' : 'play'} size={18} color={fg} style={!status.playing && { marginLeft: 2 }} />
        )}
      </Pressable>
      <View style={styles.wave}>
        {pattern.map((v, i) => (
          <View key={i} style={[styles.bar, { height: 4 + v * 22, backgroundColor: i / pattern.length < progress ? fg : dim }]} />
        ))}
      </View>
      <Text style={[styles.len, { color: props.mine ? colors.white : colors.textSecondary }]}>
        {formatClock(started && status.playing ? status.currentTime * 1000 : total)}
      </Text>
    </View>
  );
}

/**
 * Recording state for the chat composer: start() asks for the mic, then records;
 * stop() returns the file and length; cancel() throws the take away.
 */
export function useVoiceRecorder(onAutoStop: (uri: string, durationMs: number) => void) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder, 200);
  const [recording, setRecording] = useState(false);
  const limit = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedAt = useRef(0);

  async function start() {
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Microphone is off', 'To send voice notes, allow Collab to use the microphone in Settings.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
      ]);
      return;
    }
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    startedAt.current = Date.now();
    setRecording(true);
    // Two minutes max: stop and send automatically.
    limit.current = setTimeout(() => {
      finish().then((r) => r && onAutoStop(r.uri, r.durationMs));
    }, VOICE_NOTE_MAX_MS);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }

  async function finish(): Promise<{ uri: string; durationMs: number } | null> {
    if (limit.current) clearTimeout(limit.current);
    limit.current = null;
    if (!startedAt.current) return null;
    const durationMs = Math.min(Date.now() - startedAt.current, VOICE_NOTE_MAX_MS);
    startedAt.current = 0;
    await recorder.stop();
    setRecording(false);
    await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    return recorder.uri ? { uri: recorder.uri, durationMs } : null;
  }

  async function cancel() {
    await finish();
  }

  useEffect(
    () => () => {
      if (limit.current) clearTimeout(limit.current);
    },
    [],
  );

  return { recording, durationMs: state.durationMillis, start, stop: finish, cancel };
}

/** Replaces the text box while recording: red dot, timer, cancel. */
export function RecordingBar(props: { durationMs: number; onCancel: () => void }) {
  return (
    <View style={styles.recBar}>
      <Pressable onPress={props.onCancel} hitSlop={10} accessibilityRole="button" accessibilityLabel="Cancel voice note">
        <Ionicons name="trash-outline" size={22} color={colors.red} />
      </Pressable>
      <View style={styles.recDot} />
      <Text style={styles.recTime}>{formatClock(props.durationMs)}</Text>
      <Text style={styles.recHint} numberOfLines={1}>
        Recording… tap send when done
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  voice: { flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 220 },
  playBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  wave: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 2, height: 28 },
  bar: { flex: 1, borderRadius: 2 },
  len: { fontFamily: fonts.bodyMedium, fontSize: 12, minWidth: 30, textAlign: 'right' },
  recBar: {
    flex: 1,
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    borderRadius: 21,
    backgroundColor: '#FDECEC',
  },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.red },
  recTime: { fontFamily: fonts.bodySemibold, fontSize: 15, color: colors.text, minWidth: 40 },
  recHint: { flex: 1, fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary },
});
