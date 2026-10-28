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
    onAdd({ type: 'media', source: 'link', url: normalized, platform: platform!.platform, title: title.trim() || undefined });
    reset();
  }

  async function upload(localUri: string, fileName: string, mimeType: string | undefined, size: number | undefined, kind: 'audio' | 'video' | 'image') {
    if (!user) return;
    if (size && size > SHOWCASE.maxUploadMB * 1024 * 1024) {
      return setError(`That file is over ${SHOWCASE.maxUploadMB} MB. Try a shorter clip.`);
    }
    setUploading(true);
    setError(null);
    try {
      const { url: downloadUrl, path } = await uploadMedia(user.uid, localUri, fileName, mimeType);
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
      <View style={styles.tabs}>
        {(['link', 'upload'] as const).map((t) => (
          <Pressable
            key={t}
            onPress={() => !uploading && setTab(t)}
            style={[styles.tab, tab === t && styles.tabOn]}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === t }}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextOn]}>{t === 'link' ? '🔗 Paste a link' : '📁 Upload'}</Text>
          </Pressable>
        ))}
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
  tabs: { flexDirection: 'row', gap: 8, padding: 4, backgroundColor: colors.bgSecondary, borderRadius: radius.md },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
  tabOn: { backgroundColor: colors.white, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  tabText: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.textSecondary },
  tabTextOn: { color: colors.text, fontFamily: fonts.bodySemibold },
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
