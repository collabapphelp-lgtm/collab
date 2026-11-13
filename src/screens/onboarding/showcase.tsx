import { useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StepScreen } from '@/components/onboarding/StepScreen';
import { MediaSheet } from '@/components/onboarding/MediaSheet';
import { PromptSheet } from '@/components/onboarding/PromptSheet';
import { useOnboarding } from '@/lib/onboarding-context';
import { useAuth } from '@/lib/auth-context';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { IconName } from '@/components/OptionIcon';
import { BLOCKED_LANGUAGE_MESSAGE, hasBlockedLanguage } from '@/lib/moderation';
import { BIO_MAX_CHARS, CONTENT_PROMPTS, detectPlatform, MUSICIAN_PROMPTS, normalizeUrl, SHOWCASE } from '@/lib/onboarding-data';
import { roleLine } from '@/lib/labels';
import type { ShowcaseItem, ShowcaseMedia, ShowcasePrompt } from '@/lib/types';
import { colors, fonts, radius } from '@/lib/theme';

type Slot = ShowcaseItem | null;

// What each empty slot says, in order. Media and prompts alternate.
const EMPTY_COPY = [
  { emoji: '🎵', title: 'Add a snippet', body: 'Upload a file or share a link' },
  { emoji: '💬', title: 'Answer a prompt', body: 'Share your perspective on a topic' },
  { emoji: '🎬', title: 'Add another snippet', body: 'Show a different side of your work' },
  { emoji: '✨', title: 'Another prompt', body: 'Another topic, another perspective' },
  { emoji: '📸', title: 'Keep building', body: 'Photos, clips or links to your work' },
  { emoji: '🎯', title: 'One more prompt', body: 'Stand out from the crowd' },
];

/** Put saved items back into their slots: media into media slots, prompts into prompt slots. */
function toSlots(items: ShowcaseItem[] | undefined): Slot[] {
  const media = (items ?? []).filter((i): i is ShowcaseMedia => i.type === 'media');
  const prompts = (items ?? []).filter((i): i is ShowcasePrompt => i.type === 'prompt');
  return SHOWCASE.slots.map((kind) => (kind === 'media' ? media.shift() : prompts.shift()) ?? null);
}

// Last step: show your work. The two easiest things sit right on the page (one prompt answer,
// one pasted link) so nobody has to open a sheet; more slots and uploads are tucked under "Add more".
// Plus an optional note on what they want in a collab partner (stored as `bio`).
const BRANDS: { platform: string; label: string; icon: IconName; color: string }[] = [
  { platform: 'spotify', label: 'Spotify', icon: 'spotify', color: '#1DB954' },
  { platform: 'soundcloud', label: 'SoundCloud', icon: 'soundcloud', color: '#FF5500' },
  { platform: 'applemusic', label: 'Apple Music', icon: 'apple', color: '#FA2D48' },
];

const LINK_SLOT = 0; // first media slot
const PROMPT_SLOT = 1; // first prompt slot

export default function ShowcaseStep() {
  const { draft, finish, advance, mode } = useOnboarding();
  const { profile } = useAuth();
  const [partner, setPartner] = useState(draft.bio ?? '');
  const prompts = draft.creatorType === 'content' ? CONTENT_PROMPTS : MUSICIAN_PROMPTS;

  const [slots, setSlots] = useState<Slot[]>(() => toSlots(draft.showcase));
  const [showMore, setShowMore] = useState(() => slots.slice(2).some(Boolean));
  const [editing, setEditing] = useState<{ index: number; kind: 'media' | 'prompt' } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inline prompt
  const firstPrompt = slots[PROMPT_SLOT] as ShowcasePrompt | null;
  const [question, setQuestion] = useState(firstPrompt?.question ?? prompts.work[0]);
  const [answer, setAnswer] = useState(firstPrompt?.answer ?? '');
  // Inline link (an uploaded file in that slot shows as a card instead)
  const firstMedia = slots[LINK_SLOT] as ShowcaseMedia | null;
  const [link, setLink] = useState(firstMedia?.source === 'link' ? firstMedia.url : '');
  const linkUrl = normalizeUrl(link);
  const linkPlatform = linkUrl ? detectPlatform(linkUrl) : null;

  const filled = slots.filter(Boolean).length;
  const usedQuestions = slots.filter((s): s is ShowcasePrompt => s?.type === 'prompt').map((s) => s.question);

  function put(index: number, item: Slot) {
    setSlots((s) => s.map((v, i) => (i === index ? item : v)));
  }

  function onAnswer(text: string, q = question) {
    setAnswer(text);
    put(PROMPT_SLOT, text.trim() ? { type: 'prompt', question: q, answer: text.trim() } : null);
  }

  function onLink(text: string) {
    setLink(text);
    const url = normalizeUrl(text);
    put(LINK_SLOT, url ? { type: 'media', source: 'link', url, platform: detectPlatform(url).platform } : null);
  }

  function onSlotPress(index: number) {
    const kind = SHOWCASE.slots[index];
    const current = slots[index];
    if (!current) return setEditing({ index, kind });
    Alert.alert(kind === 'media' ? 'Snippet' : 'Prompt', undefined, [
      { text: kind === 'media' ? 'Replace' : 'Edit', onPress: () => setEditing({ index, kind }) },
      { text: 'Remove', style: 'destructive', onPress: () => put(index, null) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  async function save(withShowcase: boolean) {
    const answers = slots.filter((s): s is ShowcasePrompt => s?.type === 'prompt').map((s) => s.answer);
    if (hasBlockedLanguage(partner, ...answers)) return setError(BLOCKED_LANGUAGE_MESSAGE);
    setSaving(true);
    setError(null);
    try {
      await finish({
        ...(withShowcase ? { showcase: slots.filter((s): s is ShowcaseItem => s !== null) } : {}),
        bio: partner.trim(),
      });
      if (mode === 'edit') advance('/onboarding/showcase');
    } catch {
      setError('Couldn’t save. Check your connection and try again.');
      setSaving(false);
    }
  }
  const next = () => (filled >= SHOWCASE.minItems ? save(true) : undefined);

  const editingPrompt = editing?.kind === 'prompt' ? (slots[editing.index] as ShowcasePrompt | null) : null;
  const uploaded = firstMedia?.source === 'upload' ? firstMedia : null;

  return (
    <StepScreen
      step="showcase"
      onSkip={() => save(false)}
      continueLabel={mode === 'edit' ? 'Save' : 'Complete profile'}
      title="Show your work"
      subtitle="Profiles with work get shown first. One line or one link is enough."
      onContinue={next}
      continueDisabled={filled < SHOWCASE.minItems}
      saving={saving}
      error={error}
      footerHint={filled === 0 ? 'Answer the prompt or paste a link to finish' : `${filled} added · looking good`}
      footerHintStrong={filled === 0}
    >
      {/* 1. What they want in a partner (bio) */}
      <View style={styles.partner}>
        <Text style={styles.partnerTitle}>
          What are you looking for in a collab partner? <Text style={styles.optionalInline}>Optional</Text>
        </Text>
        <TextInput
          value={partner}
          onChangeText={setPartner}
          multiline
          maxLength={BIO_MAX_CHARS}
          placeholder="e.g. Someone consistent who’s down to link weekly. Into moody R&B and big hooks."
          placeholderTextColor={colors.textMuted}
          style={styles.partnerInput}
          accessibilityLabel="What are you looking for in a collab partner"
        />
        {partner.length > BIO_MAX_CHARS - 100 ? (
          <Text style={styles.partnerCount}>
            {partner.length}/{BIO_MAX_CHARS}
          </Text>
        ) : null}
      </View>

      {/* 2. Paste a link */}
      <View style={styles.box}>
        <View style={styles.boxHead}>
          <Text style={styles.boxLabel}>Link to your work</Text>
          <View style={styles.brands}>
            {BRANDS.map((b) => {
              const on = linkPlatform?.platform === b.platform;
              return (
                <View key={b.platform} style={[styles.brand, on && { backgroundColor: b.color }]} accessibilityLabel={b.label}>
                  <MaterialCommunityIcons name={b.icon} size={16} color={on ? '#FFFFFF' : b.color} />
                </View>
              );
            })}
          </View>
        </View>
        {uploaded ? (
          <SlotCard index={LINK_SLOT} slot={uploaded} onPress={() => onSlotPress(LINK_SLOT)} />
        ) : (
          <>
            <View style={styles.linkRow}>
              <MaterialCommunityIcons name="link-variant" size={18} color={colors.textMuted} />
              <TextInput
                value={link}
                onChangeText={onLink}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                placeholder="Paste a link"
                placeholderTextColor={colors.textMuted}
                style={styles.linkInput}
                accessibilityLabel="Link to your work"
              />
              {linkPlatform ? <Text style={styles.linkOk}>✓ {linkPlatform.label}</Text> : null}
            </View>
            {link.trim() && !linkUrl ? <Text style={styles.linkErr}>That doesn’t look like a link yet.</Text> : null}
            <Text style={styles.optional}>Spotify, SoundCloud, Apple Music, YouTube, Instagram or any link</Text>
            <Pressable onPress={() => setEditing({ index: LINK_SLOT, kind: 'media' })} hitSlop={8} accessibilityRole="button">
              <Text style={styles.uploadLink}>or upload a file from your phone</Text>
            </Pressable>
          </>
        )}
      </View>

      {/* 3. Quick prompt, answered right here */}
      <View style={styles.box}>
        <View style={styles.boxHead}>
          <Text style={styles.boxLabel}>Quick prompt</Text>
          <Text style={styles.badge}>30 sec</Text>
        </View>
        <Pressable
          onPress={() => setEditing({ index: PROMPT_SLOT, kind: 'prompt' })}
          accessibilityRole="button"
          accessibilityLabel={`Prompt: ${question} Tap to change the question.`}
          style={styles.questionRow}
        >
          <Text style={styles.question}>{question}</Text>
          <Text style={styles.change}>Change</Text>
        </Pressable>
        <TextInput
          value={answer}
          onChangeText={(t) => onAnswer(t)}
          multiline
          maxLength={SHOWCASE.promptMaxChars}
          placeholder={draft.creatorType === 'content' ? 'e.g. A short doc series on NYC street musicians.' : 'e.g. Finishing a 5-song R&B EP. Need a producer for 2 tracks.'}
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          accessibilityLabel="Your answer"
        />
      </View>

      {/* Live preview */}
      {filled > 0 ? <PreviewCard name={profile?.firstName ?? ''} role={roleLine(draft)} slots={slots} /> : null}

      {/* 3. More, optional */}
      {showMore ? (
        <View style={styles.list}>
          <Text style={styles.moreTitle}>More (optional)</Text>
          {slots.map((slot, i) => (i > PROMPT_SLOT ? <SlotCard key={i} index={i} slot={slot} onPress={() => onSlotPress(i)} /> : null))}
        </View>
      ) : (
        <Pressable onPress={() => setShowMore(true)} hitSlop={8} style={styles.more} accessibilityRole="button">
          <Text style={styles.moreText}>＋ Add more snippets or prompts</Text>
        </Pressable>
      )}

      <MediaSheet
        visible={editing?.kind === 'media'}
        onClose={() => setEditing(null)}
        onAdd={(item) => {
          if (editing) {
            put(editing.index, item);
            if (editing.index === LINK_SLOT) setLink(item.source === 'link' ? item.url : '');
          }
          setEditing(null);
        }}
      />
      <PromptSheet
        key={editing?.kind === 'prompt' ? `prompt-${editing.index}` : 'prompt-closed'}
        visible={editing?.kind === 'prompt'}
        prompts={prompts}
        usedQuestions={usedQuestions}
        initial={editing?.index === PROMPT_SLOT ? { type: 'prompt', question: '', answer } : editingPrompt}
        onClose={() => setEditing(null)}
        onSave={(item) => {
          if (editing?.index === PROMPT_SLOT) {
            // Picked a new question for the inline prompt: keep what they'd typed if the sheet's answer is empty.
            setQuestion(item.question);
            onAnswer(item.answer || answer, item.question);
          } else if (editing) put(editing.index, item);
          setEditing(null);
        }}
      />
    </StepScreen>
  );
}

/** "How you'll show up": a tiny version of their Discover card, so the effort feels worth it. */
function PreviewCard({ name, role, slots }: { name: string; role: string; slots: Slot[] }) {
  const prompt = slots.find((s): s is ShowcasePrompt => s?.type === 'prompt');
  const media = slots.find((s): s is ShowcaseMedia => s?.type === 'media');
  const p = media?.source === 'link' ? detectPlatform(media.url) : null;
  return (
    <View style={styles.preview}>
      <Text style={styles.previewLabel}>How you’ll show up</Text>
      <LinearGradient colors={['#E6F1F7', '#EFEBF8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.previewCard}>
        <Text style={styles.previewName}>{name || 'You'}</Text>
        <Text style={styles.previewRole}>{role}</Text>
        {prompt ? (
          <View style={styles.previewPrompt}>
            <Text style={styles.previewQ}>{prompt.question}</Text>
            <Text style={styles.previewA} numberOfLines={3}>
              {prompt.answer}
            </Text>
          </View>
        ) : null}
        {media ? (
          <Text style={styles.previewMedia}>
            {p ? `${p.emoji} ${p.label}` : media.mediaKind === 'audio' ? '🎵 Audio snippet' : '🎬 Snippet'}
          </Text>
        ) : null}
      </LinearGradient>
    </View>
  );
}

function SlotCard({ index, slot, onPress }: { index: number; slot: Slot; onPress: () => void }) {
  const kind = SHOWCASE.slots[index];
  const empty = EMPTY_COPY[index];

  let emoji = empty.emoji;
  let title = empty.title;
  let body = empty.body;
  if (slot?.type === 'media') {
    const p = slot.source === 'link' ? detectPlatform(slot.url) : null;
    emoji = p ? p.emoji : slot.mediaKind === 'audio' ? '🎵' : slot.mediaKind === 'video' ? '🎬' : '🖼️';
    title = slot.title ?? (p ? `${p.label} link` : 'Uploaded file');
    body = p ? p.label : slot.mediaKind === 'audio' ? 'Audio' : slot.mediaKind === 'video' ? 'Video' : 'Photo';
  } else if (slot?.type === 'prompt') {
    emoji = '💬';
    title = slot.question;
    body = slot.answer;
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={slot ? `${title}. Tap to edit or remove.` : `${title}. ${body}`}
      style={({ pressed }) => [
        styles.slot,
        slot && styles.slotFilled,
        pressed && { opacity: 0.8 },
      ]}
    >
      <LinearGradient
        colors={kind === 'media' ? ['#DCEEF7', '#E7E2F5'] : ['#FCF1CC', '#FBE1D2']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.icon}
      >
        <Text style={styles.iconText}>{emoji}</Text>
      </LinearGradient>
      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={slot ? 2 : 1}>
          {title}
        </Text>
        <Text style={[styles.body, slot && styles.bodyFilled]} numberOfLines={slot ? 2 : 1}>
          {body}
        </Text>
      </View>
      <View style={[styles.trailing, slot && styles.trailingFilled]}>
        <Text style={[styles.trailingText, slot && styles.trailingTextFilled]}>{slot ? '✓' : '+'}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8 },
  box: {
    gap: 10,
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#E3EEF4',
    shadowColor: '#2A3B4D',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  boxHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  brands: { flexDirection: 'row', gap: 6 },
  brand: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F3F5' },
  boxLabel: { fontFamily: fonts.bodySemibold, fontSize: 15, color: colors.text },
  badge: {
    fontFamily: fonts.bodySemibold,
    fontSize: 12,
    color: '#7A5A00',
    backgroundColor: '#FCEFC7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
  },
  optional: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, marginTop: -4 },
  questionRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  question: { flex: 1, fontFamily: fonts.heading, fontSize: 17, color: colors.text },
  change: { fontFamily: fonts.bodySemibold, fontSize: 13, color: colors.blue },
  input: {
    minHeight: 64,
    borderRadius: 12,
    backgroundColor: '#F4F8FB',
    padding: 12,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 21,
    color: colors.text,
    textAlignVertical: 'top',
    ...Platform.select({ web: { outlineWidth: 0 }, default: {} }),
  },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, backgroundColor: '#F4F8FB', paddingHorizontal: 12 },
  linkInput: {
    flex: 1,
    paddingVertical: 12,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.text,
    ...Platform.select({ web: { outlineWidth: 0 }, default: {} }),
  },
  linkOk: { fontFamily: fonts.bodySemibold, fontSize: 12, color: '#2E8B57' },
  linkErr: { fontFamily: fonts.body, fontSize: 12, color: colors.red },
  uploadLink: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.blue },
  moreTitle: { fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.textSecondary },
  preview: { gap: 6 },
  previewLabel: { fontFamily: fonts.bodySemibold, fontSize: 12, letterSpacing: 0.8, textTransform: 'uppercase', color: colors.textMuted },
  previewCard: { borderRadius: radius.md, padding: 14, gap: 4 },
  previewName: { fontFamily: fonts.heading, fontSize: 20, color: colors.text },
  previewRole: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.textSecondary },
  previewPrompt: { marginTop: 8, padding: 10, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.75)', gap: 2 },
  previewQ: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
  previewA: { fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.text },
  previewMedia: { marginTop: 6, fontFamily: fonts.bodySemibold, fontSize: 13, color: colors.blue },
  partner: {
    gap: 8,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#E4DEF3',
    shadowColor: '#2A3B4D',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  optionalInline: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },
  partnerHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  partnerTitle: { flex: 1, fontFamily: fonts.bodySemibold, fontSize: 15, lineHeight: 20, color: colors.text },
  partnerInput: {
    minHeight: 58,
    borderRadius: 12,
    backgroundColor: '#F7F5FB',
    padding: 12,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 21,
    color: colors.text,
    textAlignVertical: 'top',
    ...Platform.select({ web: { outlineWidth: 0 }, default: {} }),
  },
  partnerCount: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, textAlign: 'right' },
  more: { alignSelf: 'center', paddingVertical: 2, paddingHorizontal: 12 },
  moreText: { fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.blue },
  listNote: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.textMuted },
  slot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#ECEAE4',
    backgroundColor: colors.white,
    shadowColor: '#2A3B4D',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  slotFilled: { borderColor: 'rgba(75,163,199,0.45)', backgroundColor: 'rgba(75,163,199,0.04)' },
  icon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 20 },
  text: { flex: 1, gap: 2 },
  title: { fontFamily: fonts.bodySemibold, fontSize: 15, color: colors.text },
  body: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.textSecondary },
  bodyFilled: { color: colors.text },
  trailing: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(75,163,199,0.12)' },
  trailingFilled: { backgroundColor: colors.blue },
  trailingText: { fontFamily: fonts.bodySemibold, fontSize: 18, lineHeight: 20, color: colors.blue },
  trailingTextFilled: { fontSize: 14, color: colors.white },
});
