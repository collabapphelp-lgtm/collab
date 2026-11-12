import { useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StepScreen } from '@/components/onboarding/StepScreen';
import { MediaSheet } from '@/components/onboarding/MediaSheet';
import { PromptSheet } from '@/components/onboarding/PromptSheet';
import { useOnboarding } from '@/lib/onboarding-context';
import { BIO_MAX_CHARS, CONTENT_PROMPTS, detectPlatform, MUSICIAN_PROMPTS, SHOWCASE } from '@/lib/onboarding-data';
import type { ShowcaseItem, ShowcaseMedia, ShowcasePrompt } from '@/lib/types';
import { colors, fonts, radius } from '@/lib/theme';

type Slot = ShowcaseItem | null;

const INITIAL_SLOTS = 3;

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

// Last step: show off your best work (snippets + prompts, at least one), plus an optional note on
// what they want in a collab partner (stored as `bio`). Finishing flips onboardingComplete.
export default function ShowcaseStep() {
  const { draft, finish, advance, mode } = useOnboarding();
  const [partner, setPartner] = useState(draft.bio ?? '');
  const prompts = draft.creatorType === 'content' ? CONTENT_PROMPTS : MUSICIAN_PROMPTS;

  const [slots, setSlots] = useState<Slot[]>(() => toSlots(draft.showcase));
  // Show 3 slots up front so it doesn't feel like homework; the rest open on request (or if already used).
  const [showAll, setShowAll] = useState(() => slots.slice(INITIAL_SLOTS).some(Boolean));
  const [editing, setEditing] = useState<{ index: number; kind: 'media' | 'prompt' } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filled = slots.filter(Boolean).length;
  const usedQuestions = slots.filter((s): s is ShowcasePrompt => s?.type === 'prompt').map((s) => s.question);

  function put(index: number, item: Slot) {
    setSlots((s) => s.map((v, i) => (i === index ? item : v)));
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
    setSaving(true);
    setError(null);
    try {
      await finish({
        ...(withShowcase ? { showcase: slots.filter((s): s is ShowcaseItem => s !== null) } : {}),
        bio: partner.trim(),
      });
      // Onboarding: the app sees setup is complete and moves them in. Editing: back to Edit profile.
      if (mode === 'edit') advance('/onboarding/showcase');
    } catch {
      setError('Couldn’t save. Check your connection and try again.');
      setSaving(false);
    }
  }
  const next = () => (filled >= SHOWCASE.minItems ? save(true) : undefined);

  const editingPrompt = editing?.kind === 'prompt' ? (slots[editing.index] as ShowcasePrompt | null) : null;

  return (
    <StepScreen
      step="showcase"
      onSkip={() => save(false)}
      continueLabel={mode === 'edit' ? 'Save' : 'Complete profile 🚀'}
      emoji="🔥"
      inlineEmoji
      tinted
      title="Show off your best work"
      subtitle="Snippets and prompts show people what you’re about."
      onContinue={next}
      continueDisabled={filled < SHOWCASE.minItems}
      saving={saving}
      error={error}
      footerHint={filled === 0 ? '☝️ Add at least one snippet or prompt' : `${filled} of ${SHOWCASE.slots.length} added · the rest are optional`}
      footerHintStrong={filled === 0}
    >
      <View style={styles.list}>
        <Text style={styles.listNote}>One is enough to start. Add more anytime.</Text>
        {slots.map((slot, i) =>
          showAll || i < INITIAL_SLOTS ? <SlotCard key={i} index={i} slot={slot} onPress={() => onSlotPress(i)} /> : null,
        )}
        {showAll ? null : (
          <Pressable onPress={() => setShowAll(true)} hitSlop={8} style={styles.more} accessibilityRole="button">
            <Text style={styles.moreText}>＋ Room for {SHOWCASE.slots.length - INITIAL_SLOTS} more</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.partner}>
        <View style={styles.partnerHead}>
          <Text style={styles.partnerTitle}>🤝 What are you looking for in a collab partner?</Text>
          <Text style={styles.optional}>OPTIONAL</Text>
        </View>
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

      <MediaSheet
        visible={editing?.kind === 'media'}
        onClose={() => setEditing(null)}
        onAdd={(item) => {
          if (editing) put(editing.index, item);
          setEditing(null);
        }}
      />
      <PromptSheet
        key={editing?.kind === 'prompt' ? `prompt-${editing.index}` : 'prompt-closed'}
        visible={editing?.kind === 'prompt'}
        prompts={prompts}
        usedQuestions={usedQuestions}
        initial={editingPrompt}
        onClose={() => setEditing(null)}
        onSave={(item) => {
          if (editing) put(editing.index, item);
          setEditing(null);
        }}
      />
    </StepScreen>
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
  list: { gap: 10, marginTop: -6 },
  partner: {
    gap: 10,
    marginTop: 6,
    padding: 14,
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
  partnerHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  partnerTitle: { flex: 1, fontFamily: fonts.bodySemibold, fontSize: 15, lineHeight: 20, color: colors.text },
  optional: {
    fontFamily: fonts.bodyMedium,
    fontSize: 10,
    letterSpacing: 0.5,
    color: colors.textMuted,
    backgroundColor: 'rgba(163,153,199,0.16)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  partnerInput: {
    minHeight: 84,
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
  more: { alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 12 },
  moreText: { fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.blue },
  listNote: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.textMuted },
  slot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
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
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
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
