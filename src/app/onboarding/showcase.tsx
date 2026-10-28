import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { StepScreen } from '@/components/onboarding/StepScreen';
import { MediaSheet } from '@/components/onboarding/MediaSheet';
import { PromptSheet } from '@/components/onboarding/PromptSheet';
import { useOnboarding } from '@/lib/onboarding-context';
import { CONTENT_PROMPTS, detectPlatform, MUSICIAN_PROMPTS, SHOWCASE } from '@/lib/onboarding-data';
import type { ShowcaseItem, ShowcaseMedia, ShowcasePrompt } from '@/lib/types';
import { colors, fonts, radius } from '@/lib/theme';

type Slot = ShowcaseItem | null;

// What each empty slot says, in order. Media and prompts alternate.
const EMPTY_COPY = [
  { emoji: '🎵', title: 'Upload a snippet', body: 'A track, clip or link to your work' },
  { emoji: '💬', title: 'Answer a prompt', body: 'Let people get to know the real you' },
  { emoji: '🎬', title: 'Add another snippet', body: 'Show a different side of your work' },
  { emoji: '✨', title: 'Another prompt', body: 'Share more about your creative vision' },
  { emoji: '📸', title: 'Keep building', body: 'Photos, clips or links to your work' },
  { emoji: '🎯', title: 'One more prompt', body: 'Stand out from the crowd' },
];

/** Put saved items back into their slots: media into media slots, prompts into prompt slots. */
function toSlots(items: ShowcaseItem[] | undefined): Slot[] {
  const media = (items ?? []).filter((i): i is ShowcaseMedia => i.type === 'media');
  const prompts = (items ?? []).filter((i): i is ShowcasePrompt => i.type === 'prompt');
  return SHOWCASE.slots.map((kind) => (kind === 'media' ? media.shift() : prompts.shift()) ?? null);
}

// Step 6: show off your best work (snippets + prompts, at least one).
export default function ShowcaseStep() {
  const { draft, saveStep } = useOnboarding();
  const prompts = draft.creatorType === 'content' ? CONTENT_PROMPTS : MUSICIAN_PROMPTS;

  const [slots, setSlots] = useState<Slot[]>(() => toSlots(draft.showcase));
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

  async function next() {
    if (filled < SHOWCASE.minItems) return;
    setSaving(true);
    setError(null);
    try {
      await saveStep({ showcase: slots.filter((s): s is ShowcaseItem => s !== null) });
      router.push('/onboarding/bio');
    } catch {
      setError('Couldn’t save. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  const editingPrompt = editing?.kind === 'prompt' ? (slots[editing.index] as ShowcasePrompt | null) : null;

  return (
    <StepScreen
      step="showcase"
      emoji="🎨"
      title="Show off your best work"
      subtitle="Add snippets and answer prompts so people can see what you’re about. Fill at least one to continue."
      onContinue={next}
      continueDisabled={filled < SHOWCASE.minItems}
      saving={saving}
      error={error}
      footerHint={filled === 0 ? 'Add at least one snippet or prompt' : `${filled} of ${SHOWCASE.slots.length} added`}
    >
      <View style={styles.list}>
        {slots.map((slot, i) => (
          <SlotCard key={i} index={i} slot={slot} onPress={() => onSlotPress(i)} />
        ))}
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
        kind === 'prompt' && !slot && styles.slotPrompt,
        pressed && { opacity: 0.8 },
      ]}
    >
      <View style={[styles.icon, kind === 'media' ? styles.iconMedia : styles.iconPrompt]}>
        <Text style={styles.iconText}>{emoji}</Text>
      </View>
      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={slot ? 2 : 1}>
          {title}
        </Text>
        <Text style={[styles.body, slot && styles.bodyFilled]} numberOfLines={2}>
          {body}
        </Text>
      </View>
      <Text style={[styles.trailing, slot && styles.trailingFilled]}>{slot ? '✓' : '+'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12 },
  slot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: radius.md,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  slotPrompt: { backgroundColor: 'rgba(229,197,71,0.05)' },
  slotFilled: { borderStyle: 'solid', borderColor: colors.blue, backgroundColor: 'rgba(75,163,199,0.06)' },
  icon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  iconMedia: { backgroundColor: 'rgba(75,163,199,0.15)' },
  iconPrompt: { backgroundColor: 'rgba(229,197,71,0.22)' },
  iconText: { fontSize: 22 },
  text: { flex: 1, gap: 2 },
  title: { fontFamily: fonts.bodySemibold, fontSize: 15, color: colors.text },
  body: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.textSecondary },
  bodyFilled: { color: colors.text },
  trailing: { fontSize: 24, color: colors.textMuted, width: 24, textAlign: 'center' },
  trailingFilled: { fontSize: 18, color: colors.blue, fontFamily: fonts.bodySemibold },
});
