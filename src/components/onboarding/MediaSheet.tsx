import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Sheet } from './Sheet';
import { Button } from '@/components/Button';
import { ErrorText } from '@/components/ErrorText';
import { TextField } from '@/components/TextField';
import { useAuth } from '@/lib/auth-context';
import { detectPlatform, SHOWCASE } from '@/lib/onboarding-data';
import { uploadMedia } from '@/lib/upload';
import type { ShowcaseMedia } from '@/lib/types';
import { colors, fonts, radius } from '@/lib/theme';
import { BLOCKED_LANGUAGE_MESSAGE, hasBlockedLanguage } from '@/lib/moderation';

const CHOICES = [
  { value: 'link', emoji: '🔗', title: 'Paste a link', body: 'Spotify, YouTube, SoundCloud, TikTok…' },
  { value: 'upload', emoji: '📲', title: 'Upload a file', body: 'Audio, video or photo from your phone' },
] as const;

type Props = { visible: boolean; onClose: () => void; onAdd: (item: ShowcaseMedia) => void };

/** Add a snippet by pasting a link (Spotify, YouTube…) or uploading a file from the phone. */
export function MediaSheet({ visible, onClose, onAdd }: Props) {
  const { user } = useAuth();
  const [tab, setTab] = useState<'link' | 'upload'>('link');
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalized = normalizeUrl(url);
  const platform = normalized ? detectPlatform(normalized) : null;

  function reset() {
    setUrl('');
    setTitle('');
    setError(null);
    setUploading(false);
    setTab('link');
  }

  function close() {
    if (uploading) return; // don't abandon an upload halfway
    reset();
    onClose();
  }

  function addLink() {
    if (!normalized) return setError('That doesn’t look like a link. Paste the full URL.');
    if (hasBlockedLanguage(title)) return setError(BLOCKED_LANGUAGE_MESSAGE);
    onAdd({ type: 'media', source: 'link', url: normalized, platform: platform!.platform, title: title.trim() || undefined });
    reset();
  }

  async function upload(localUri: string, fileName: string, mimeType: string | undefined, size: number | undefined, kind: 'audio' | 'video' | 'image') {
    if (!user) return;
    if (hasBlockedLanguage(title)) return setError(BLOCKED_LANGUAGE_MESSAGE);
    if (size && size > SHOWCASE.maxUploadMB * 1024 * 1024) {
      return setError(`That file is over ${SHOWCASE.maxUploadMB} MB. Try a shorter clip.`);
    }
    setUploading(true);
    setError(null);
    try {
      // Storage rules only accept image/video/audio types, so never upload without one.
      const contentType = mimeType || { image: 'image/jpeg', video: 'video/mp4', audio: 'audio/mpeg' }[kind];
      const { url: downloadUrl, path } = await uploadMedia(user.uid, localUri, fileName, contentType);
      onAdd({
        type: 'media',
        source: 'upload',
        url: downloadUrl,
        storagePath: path,
        mediaKind: kind,
        title: title.trim() || fileName,
      });
      reset();
    } catch (e) {
      console.warn('Upload failed', e);
      setError('Upload failed. Check your connection and try again.');
      setUploading(false);
    }
  }

  async function pickPhotoOrVideo() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      videoMaxDuration: 120,
      quality: 0.8,
    });
    if (res.canceled) return;
    const a = res.assets[0];
    const kind = a.type === 'video' ? 'video' : 'image';
    await upload(a.uri, a.fileName ?? `${kind}-${Date.now()}`, a.mimeType, a.fileSize, kind);
  }

  async function pickAudio() {
    const res = await DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true });
    if (res.canceled) return;
    const a = res.assets[0];
    await upload(a.uri, a.name, a.mimeType, a.size, 'audio');
  }

  return (
    <Sheet visible={visible} title="Add a snippet" onClose={close}>
      <Text style={styles.choose}>Two ways to add your work:</Text>
      <View style={styles.tabs}>
        {CHOICES.map((c) => {
          const on = tab === c.value;
          return (
            <Pressable
              key={c.value}
              onPress={() => !uploading && setTab(c.value)}
              style={({ pressed }) => [styles.tab, on && styles.tabOn, pressed && { opacity: 0.8 }]}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
            >
              <View style={[styles.tabIcon, on && styles.tabIconOn]}>
                <Text style={styles.tabEmoji}>{c.emoji}</Text>
              </View>
              <Text style={[styles.tabText, on && styles.tabTextOn]}>{c.title}</Text>
              <Text style={styles.tabBody}>{c.body}</Text>
              <View style={[styles.tabRadio, on && styles.tabRadioOn]}>{on ? <View style={styles.tabRadioDot} /> : null}</View>
            </Pressable>
          );
        })}
      </View>

      {tab === 'link' ? (
        <>
          <TextField
            label="Link"
            value={url}
            onChangeText={(t) => {
              setUrl(t);
              setError(null);
            }}
            placeholder="Spotify, SoundCloud, YouTube, TikTok, Instagram…"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            textContentType="URL"
          />
          {platform ? (
            <Text style={styles.detected}>
              {platform.emoji} {platform.label} link
            </Text>
          ) : null}
          <TextField label="Title" optional value={title} onChangeText={setTitle} placeholder="e.g. My latest single" />
          <ErrorText message={error} />
          <Button title="Add link" onPress={addLink} disabled={!url.trim()} />
        </>
      ) : (
        <>
          <TextField label="Title" optional value={title} onChangeText={setTitle} placeholder="e.g. Studio session clip" />
          {uploading ? (
            <View style={styles.uploading}>
              <ActivityIndicator color={colors.blue} />
              <Text style={styles.uploadingText}>Uploading… keep the app open</Text>
            </View>
          ) : (
            <View style={styles.pickers}>
              <PickButton emoji="🎬" title="Photo or video" body="From your camera roll" onPress={pickPhotoOrVideo} />
              <PickButton emoji="🎵" title="Audio file" body="MP3, WAV, M4A from Files" onPress={pickAudio} />
            </View>
          )}
          <Text style={styles.limit}>Up to {SHOWCASE.maxUploadMB} MB. Short clips work best.</Text>
          <ErrorText message={error} />
        </>
      )}
    </Sheet>
  );
}

function PickButton(props: { emoji: string; title: string; body: string; onPress: () => void }) {
  return (
    <Pressable onPress={props.onPress} style={({ pressed }) => [styles.pick, pressed && { opacity: 0.7 }]} accessibilityRole="button">
      <Text style={styles.pickEmoji}>{props.emoji}</Text>
      <Text style={styles.pickTitle}>{props.title}</Text>
      <Text style={styles.pickBody}>{props.body}</Text>
    </Pressable>
  );
}

/** Accepts "open.spotify.com/…" without https:// and returns a full URL, or null if it isn't one. */
function normalizeUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  const withScheme = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  try {
    const u = new URL(withScheme);
    return u.hostname.includes('.') ? u.toString() : null;
  } catch {
    return null;
  }
}

const styles = StyleSheet.create({
  choose: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.textSecondary, marginBottom: -4 },
  tabs: { flexDirection: 'row', gap: 10 },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingTop: 14,
    paddingBottom: 12,
    paddingHorizontal: 10,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  tabOn: { borderColor: colors.blue, backgroundColor: '#F1F8FB' },
  tabIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.bgSecondary, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  tabIconOn: { backgroundColor: 'rgba(75,163,199,0.16)' },
  tabEmoji: { fontSize: 22 },
  tabText: { fontFamily: fonts.bodySemibold, fontSize: 15, color: colors.text },
  tabTextOn: { color: colors.blue },
  tabBody: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: colors.textSecondary, textAlign: 'center' },
  tabRadio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  tabRadioOn: { borderColor: colors.blue },
  tabRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.blue },
  detected: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.blue, marginTop: -6 },
  pickers: { flexDirection: 'row', gap: 12 },
  pick: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 20,
    paddingHorizontal: 10,
    borderRadius: radius.md,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.blue,
    backgroundColor: 'rgba(75,163,199,0.05)',
  },
  pickEmoji: { fontSize: 28 },
  pickTitle: { fontFamily: fonts.bodySemibold, fontSize: 15, color: colors.text },
  pickBody: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary, textAlign: 'center' },
  uploading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 28 },
  uploadingText: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.textSecondary },
  limit: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, textAlign: 'center' },
});
