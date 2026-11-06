import { useEffect, useMemo, useState } from 'react';
import { setOpenChat } from '@/lib/push';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { ChatProfileCard } from '@/components/ChatProfileCard';
import { Avatar } from '@/components/Avatar';
import { SafetyButton } from '@/components/SafetyButton';
import { useAuth } from '@/lib/auth-context';
import { listenToMessages, markRead, MESSAGE_MAX_CHARS, sendMessage, type ChatMessage } from '@/lib/connections';
import { roleLine } from '@/lib/labels';
import { clockTime, dayLabel, sameDay } from '@/lib/time';
import type { UserProfile } from '@/lib/types';
import { useMatches } from '@/lib/use-matches';
import { colors, fonts, radius } from '@/lib/theme';

/** Openers based on their profile, shown in an empty chat to make the first message easy. */
function icebreakers(p: UserProfile): string[] {
  const out: string[] = [];
  const media = p.showcase?.find((s) => s.type === 'media' && s.title);
  if (media && media.type === 'media') out.push(`Loved “${media.title}”! How’d you make it?`);
  const wants = p.showcase?.find((s) => s.type === 'prompt' && /looking for/i.test(s.question));
  if (wants) out.push('Read what you’re looking for in a collab. I think we’d work well together.');
  out.push('What are you working on right now?');
  out.push('Want to set up a session this week?');
  return out.slice(0, 3);
}

type Row = { kind: 'day'; key: string; label: string } | { kind: 'msg'; key: string; msg: ChatMessage; mine: boolean; tail: boolean };

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, profile: myProfile } = useAuth();
  const { matches } = useMatches();
  const me = user?.uid ?? '';
  const match = matches?.find((m) => m.id === id);
  const them = match?.other;

  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [draft, setDraft] = useState('');
  const [sendError, setSendError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cardOpen, setCardOpen] = useState(true);

  useEffect(() => {
    if (!id) return;
    return listenToMessages(
      id,
      (m) => {
        setMessages(m);
        setLoadError(null);
      },
      () => setLoadError('Couldn’t load messages. Check your internet.'),
    );
  }, [id]);

  // While this chat is open, its new messages don't also pop a notification banner.
  useEffect(() => {
    setOpenChat(id ?? null);
    return () => setOpenChat(null);
  }, [id]);

  // Opening the chat, and every new message while it's open, counts as read.
  const lastAt = messages?.[messages.length - 1]?.at;
  useEffect(() => {
    if (id && me && match) markRead(id, me).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-mark when a new message arrives
  }, [id, me, lastAt, !!match]);

  // Build rows newest-first for an inverted list: day separators + bubbles grouped by sender.
  const rows = useMemo<Row[]>(() => {
    if (!messages) return [];
    const out: Row[] = [];
    messages.forEach((msg, i) => {
      const prev = messages[i - 1];
      const next = messages[i + 1];
      if (!prev || !sameDay(prev.at, msg.at)) out.push({ kind: 'day', key: `d${msg.at}`, label: dayLabel(msg.at) });
      const tail = !next || next.senderId !== msg.senderId || next.at - msg.at > 5 * 60_000;
      out.push({ kind: 'msg', key: msg.id, msg, mine: msg.senderId === me, tail });
    });
    return out.reverse();
  }, [messages, me]);

  async function send(text = draft) {
    if (!id || !me || !text.trim()) return;
    setSendError(null);
    setDraft('');
    try {
      await sendMessage(id, me, text);
    } catch (e) {
      console.warn('Send failed', e);
      setDraft(text);
      setSendError('Message didn’t send. Tap send to try again.');
    }
  }

  if (matches && !match) {
    return (
      <SafeAreaView style={styles.missing}>
        <Text style={styles.missingText}>This conversation isn’t available.</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.link}>Go back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const empty = messages !== null && messages.length === 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <LinearGradient colors={['#F7FAFC', '#F6F3EE']} style={StyleSheet.absoluteFill} />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        {them ? (
          <Pressable
            style={styles.headerWho}
            onPress={() => router.push({ pathname: '/user/[id]', params: { id: them.id } })}
            accessibilityRole="button"
            accessibilityLabel={`View ${them.firstName}'s profile`}
          >
            <LinearGradient colors={[colors.blue, colors.purple]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ring}>
              <View style={styles.ringInner}>
                <Avatar uri={them.photoURL} name={them.firstName} seed={them.id} size={40} />
              </View>
            </LinearGradient>
            <View style={styles.flex}>
              <Text style={styles.headerName} numberOfLines={1}>
                {them.firstName}
              </Text>
              <Text style={styles.headerRole} numberOfLines={1}>
                {roleLine(them)} · View profile
              </Text>
            </View>
          </Pressable>
        ) : (
          <View style={styles.headerWho} />
        )}
        {them ? <SafetyButton them={them} onBlocked={() => router.back()} /> : null}
      </View>

      {them ? <ChatProfileCard me={myProfile} them={them} expanded={cardOpen} onToggle={() => setCardOpen((v) => !v)} /> : null}

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
        {empty && them ? (
          <ScrollView contentContainerStyle={styles.empty} keyboardShouldPersistTaps="handled">
            <Text style={styles.emptyEmoji}>👋</Text>
            <Text style={styles.emptyTitle}>You and {them.firstName} are connected</Text>
            <Text style={styles.emptyBody}>Break the ice. Tap one to use it, or write your own.</Text>
            <View style={styles.breakers}>
              {icebreakers(them).map((t) => (
                <Pressable key={t} onPress={() => setDraft(t)} style={({ pressed }) => [styles.breaker, pressed && { opacity: 0.7 }]}>
                  <Text style={styles.breakerText}>{t}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        ) : (
          <FlatList
            inverted
            data={rows}
            keyExtractor={(r) => r.key}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            ListFooterComponent={loadError ? <Text style={styles.error}>{loadError}</Text> : undefined}
            renderItem={({ item }) =>
              item.kind === 'day' ? (
                <Text style={styles.day}>{item.label}</Text>
              ) : (
                <View style={[styles.bubbleRow, item.mine ? styles.rowMine : styles.rowTheirs, item.tail && { marginBottom: 8 }]}>
                  {item.mine ? (
                    <LinearGradient
                      colors={[colors.blue, '#6F8FD0']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={[styles.bubble, item.tail && styles.tailMine]}
                    >
                      <Text style={[styles.text, { color: colors.white }]}>{item.msg.text}</Text>
                    </LinearGradient>
                  ) : (
                    <View style={[styles.bubble, styles.theirs, item.tail && styles.tailTheirs]}>
                      <Text style={styles.text}>{item.msg.text}</Text>
                    </View>
                  )}
                  {item.tail ? (
                    <Text style={[styles.meta, item.mine && { textAlign: 'right' }]}>
                      {item.msg.pending ? 'Sending…' : clockTime(item.msg.at)}
                    </Text>
                  ) : null}
                </View>
              )
            }
          />
        )}

        {sendError ? <Text style={styles.error}>{sendError}</Text> : null}
        <View style={styles.composer}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={them ? `Message ${them.firstName}…` : 'Message…'}
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={MESSAGE_MAX_CHARS}
            onFocus={() => setCardOpen(false)}
            style={styles.input}
            accessibilityLabel="Message"
          />
          <Pressable
            onPress={() => send()}
            disabled={!draft.trim()}
            accessibilityRole="button"
            accessibilityLabel="Send"
            style={!draft.trim() && { opacity: 0.4 }}
          >
            <LinearGradient colors={[colors.blue, colors.purple]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.send}>
              <Ionicons name="arrow-up" size={22} color={colors.white} />
            </LinearGradient>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F6F3EE' },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  ring: { width: 46, height: 46, borderRadius: 23, padding: 2 },
  ringInner: { flex: 1, borderRadius: 21, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  headerWho: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerName: { fontFamily: fonts.heading, fontSize: 18, color: colors.text },
  headerRole: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },

  list: { paddingHorizontal: 14, paddingVertical: 12 },
  day: { alignSelf: 'center', fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.textMuted, marginVertical: 12 },
  bubbleRow: { maxWidth: '80%', marginBottom: 3 },
  rowMine: { alignSelf: 'flex-end' },
  rowTheirs: { alignSelf: 'flex-start' },
  bubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20 },
  theirs: {
    backgroundColor: colors.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E4E1DA',
    shadowColor: '#2A3B4D',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  tailMine: { borderBottomRightRadius: 6 },
  tailTheirs: { borderBottomLeftRadius: 6 },
  text: { fontFamily: fonts.body, fontSize: 16, lineHeight: 22, color: colors.text },
  meta: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginTop: 3, marginHorizontal: 4 },

  empty: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 8 },
  emptyEmoji: { fontSize: 40 },
  emptyTitle: { fontFamily: fonts.heading, fontSize: 21, color: colors.text, textAlign: 'center', marginTop: 8 },
  emptyBody: { fontFamily: fonts.body, fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
  breakers: { alignSelf: 'stretch', gap: 10, marginTop: 14 },
  breaker: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  breakerText: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.text },

  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 120,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    borderRadius: 21,
    backgroundColor: colors.bgSecondary,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.text,
    ...Platform.select({ web: { outlineWidth: 0 }, default: {} }),
  },
  send: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center' },
  error: { fontFamily: fonts.body, fontSize: 13, color: colors.red, textAlign: 'center', paddingVertical: 6 },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  missingText: { fontFamily: fonts.body, fontSize: 16, color: colors.textSecondary },
  link: { fontFamily: fonts.bodySemibold, fontSize: 16, color: colors.blue },
});
