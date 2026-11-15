import { useEffect, useMemo, useRef, useState } from 'react';
import { setOpenChat } from '@/lib/push';
import { BLOCKED_LANGUAGE_MESSAGE, hasBlockedLanguage } from '@/lib/moderation';
import {
  Alert,
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
import { LinearGradient } from '@/components/ThemedGradient';
import { ChatProfileCard } from '@/components/ChatProfileCard';
import { RecordingBar, useVoiceRecorder, VoiceBubble } from '@/components/VoiceNote';
import { Avatar } from '@/components/Avatar';
import { GroupAvatar } from '@/components/GroupAvatar';
import { Sheet } from '@/components/onboarding/Sheet';
import { SafetyButton } from '@/components/SafetyButton';
import { useAuth } from '@/lib/auth-context';
import * as Haptics from 'expo-haptics';
import {
  groupTitle,
  isGroupId,
  leaveGroup,
  listenToMessages,
  markRead,
  MESSAGE_MAX_CHARS,
  REACTIONS,
  sendMessage,
  sendVoiceNote,
  setReaction,
  type ChatMessage,
} from '@/lib/connections';
import { roleLine, displayName } from '@/lib/labels';
import { clockTime, dayLabel, sameDay } from '@/lib/time';
import type { UserProfile } from '@/lib/types';
import { useMatches } from '@/lib/use-matches';
import { fonts, radius, makeStyles, useColors } from '@/lib/theme';

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

type Row =
  | { kind: 'day'; key: string; label: string }
  | { kind: 'sys'; key: string; text: string }
  | { kind: 'msg'; key: string; msg: ChatMessage; mine: boolean; tail: boolean; head: boolean };

export default function ChatScreen() {
  const styles = useStyles();
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, profile: myProfile } = useAuth();
  const { matches, groups } = useMatches();
  const me = user?.uid ?? '';
  const isGroup = !!id && isGroupId(id);
  const match = isGroup ? undefined : matches?.find((m) => m.id === id);
  const group = isGroup ? groups?.find((g) => g.id === id && g.members.includes(me)) : undefined;
  const them = match?.other;
  const [infoOpen, setInfoOpen] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [draft, setDraft] = useState('');
  const [sendError, setSendError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cardOpen, setCardOpen] = useState(true);
  const [picking, setPicking] = useState<string | null>(null); // message id with the reaction bar open
  const [sendingVoice, setSendingVoice] = useState(false);
  const lastTap = useRef<{ id: string; at: number } | null>(null);
  const voice = useVoiceRecorder((uri, ms) => sendVoice(uri, ms));

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
    if (id && me && (match || group)) markRead(id, me).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-mark when a new message arrives
  }, [id, me, lastAt, !!match, !!group]);

  // Build rows newest-first for an inverted list: day separators + bubbles grouped by sender.
  const rows = useMemo<Row[]>(() => {
    if (!messages) return [];
    const out: Row[] = [];
    messages.forEach((msg, i) => {
      const prev = messages[i - 1];
      const next = messages[i + 1];
      if (!prev || !sameDay(prev.at, msg.at)) out.push({ kind: 'day', key: `d${msg.at}`, label: dayLabel(msg.at) });
      if (msg.senderId === 'system') return void out.push({ kind: 'sys', key: msg.id, text: msg.text });
      const tail = !next || next.senderId !== msg.senderId || next.at - msg.at > 5 * 60_000;
      const head = !prev || prev.senderId !== msg.senderId || msg.at - prev.at > 5 * 60_000 || !sameDay(prev.at, msg.at);
      out.push({ kind: 'msg', key: msg.id, msg, mine: msg.senderId === me, tail, head });
    });
    return out.reverse();
  }, [messages, me]);

  async function send(text = draft) {
    if (!id || !me || !text.trim()) return;
    if (hasBlockedLanguage(text)) return setSendError(BLOCKED_LANGUAGE_MESSAGE);
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

  async function sendVoice(uri: string, durationMs: number) {
    if (!id || !me) return;
    if (durationMs < 700) return setSendError('Too short. Tap the mic, talk, then tap send.');
    setSendError(null);
    setSendingVoice(true);
    try {
      await sendVoiceNote(id, me, uri, durationMs);
    } catch (e) {
      console.warn('Voice note failed', e);
      setSendError('Voice note didn’t send. Check your internet and try again.');
    } finally {
      setSendingVoice(false);
    }
  }

  async function stopAndSendVoice() {
    const take = await voice.stop();
    if (take) await sendVoice(take.uri, take.durationMs);
  }

  // Double-tap a message to ❤️ it (double-tap again to take it back). Single tap closes the reaction bar.
  function tapMessage(msg: ChatMessage) {
    const now = Date.now();
    if (lastTap.current?.id === msg.id && now - lastTap.current.at < 300) {
      lastTap.current = null;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      react(msg, '❤️');
      return;
    }
    lastTap.current = { id: msg.id, at: now };
    if (picking) setPicking(null);
  }

  function openPicker(msgId: string) {
    Haptics.selectionAsync().catch(() => {});
    setPicking((cur) => (cur === msgId ? null : msgId));
  }

  async function react(msg: ChatMessage, emoji: string) {
    setPicking(null);
    if (!id || !me) return;
    const next = msg.reactions?.[me] === emoji ? null : emoji; // tapping your current reaction removes it
    try {
      await setReaction(id, msg.id, me, next);
    } catch (e) {
      console.warn('Reaction failed', e);
      setSendError('Couldn’t add that reaction. Try again.');
    }
  }

  if (isGroup ? groups && !group : matches && !match) {
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
        {group ? (
          <Pressable
            style={styles.headerWho}
            onPress={() => setInfoOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={`${groupTitle(group, me)}. Group info`}
          >
            <GroupAvatar group={group} me={me} size={46} />
            <View style={styles.flex}>
              <Text style={styles.headerName} numberOfLines={1}>
                {groupTitle(group, me)}
              </Text>
              <Text style={styles.headerRole} numberOfLines={1}>
                {group.members.length} in chat{group.invited.length ? ` · ${group.invited.length} invited` : ''} · Info
              </Text>
            </View>
          </Pressable>
        ) : them ? (
          <Pressable
            style={styles.headerWho}
            onPress={() => router.push({ pathname: '/user/[id]', params: { id: them.id } })}
            accessibilityRole="button"
            accessibilityLabel={`View ${displayName(them)}'s profile`}
          >
            <LinearGradient colors={[colors.blue, colors.purple]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ring}>
              <View style={styles.ringInner}>
                <Avatar uri={them.photoURL} name={displayName(them)} seed={them.id} size={40} />
              </View>
            </LinearGradient>
            <View style={styles.flex}>
              <Text style={styles.headerName} numberOfLines={1}>
                {displayName(them)}
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
            <Text style={styles.emptyTitle}>You and {displayName(them)} are connected</Text>
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
            onScrollBeginDrag={() => setPicking(null)}
            extraData={picking}
            ListFooterComponent={loadError ? <Text style={styles.error}>{loadError}</Text> : undefined}
            renderItem={({ item }) =>
              item.kind === 'day' ? (
                <Text style={styles.day}>{item.label}</Text>
              ) : item.kind === 'sys' ? (
                <Text style={styles.sys}>{item.text}</Text>
              ) : (
                <View style={[styles.bubbleRow, item.mine ? styles.rowMine : styles.rowTheirs, item.tail && { marginBottom: 8 }]}>
                  {picking === item.msg.id ? (
                    <View style={[styles.picker, item.mine ? { alignSelf: 'flex-end' } : { alignSelf: 'flex-start' }]}>
                      {REACTIONS.map((e) => (
                        <Pressable
                          key={e}
                          onPress={() => react(item.msg, e)}
                          style={({ pressed }) => [styles.pickOpt, item.msg.reactions?.[me] === e && styles.pickOn, pressed && { transform: [{ scale: 1.2 }] }]}
                          accessibilityRole="button"
                          accessibilityLabel={`React ${e}`}
                        >
                          <Text style={styles.pickEmoji}>{e}</Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                  {group && !item.mine && item.head ? (
                    <Text style={styles.sender}>{group.people[item.msg.senderId]?.firstName ?? 'Someone'}</Text>
                  ) : null}
                  <Pressable
                    onLongPress={() => openPicker(item.msg.id)}
                    onPress={() => tapMessage(item.msg)}
                    delayLongPress={300}
                    accessibilityHint="Double-tap to like, long-press for more reactions"
                  >
                    {item.mine ? (
                      <LinearGradient
                        colors={[colors.blue, '#6F8FD0']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={[styles.bubble, item.tail && styles.tailMine]}
                      >
                        {item.msg.audioUrl ? (
                          <VoiceBubble id={item.msg.id} url={item.msg.audioUrl} durationMs={item.msg.durationMs ?? 0} mine />
                        ) : (
                          <Text style={[styles.text, { color: colors.white }]}>{item.msg.text}</Text>
                        )}
                      </LinearGradient>
                    ) : (
                      <View style={[styles.bubble, styles.theirs, item.tail && styles.tailTheirs]}>
                        {item.msg.audioUrl ? (
                          <VoiceBubble id={item.msg.id} url={item.msg.audioUrl} durationMs={item.msg.durationMs ?? 0} mine={false} />
                        ) : (
                          <Text style={styles.text}>{item.msg.text}</Text>
                        )}
                      </View>
                    )}
                  </Pressable>
                  <Reactions msg={item.msg} mine={item.mine} me={me} onPress={() => openPicker(item.msg.id)} />
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
        {sendingVoice ? <Text style={styles.sendingVoice}>Sending voice note…</Text> : null}
        <View style={styles.composer}>
          {voice.recording ? (
            <RecordingBar durationMs={voice.durationMs} onCancel={() => voice.cancel()} />
          ) : (
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder={group ? `Message ${groupTitle(group, me)}…` : them ? `Message ${displayName(them)}…` : 'Message…'}
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={MESSAGE_MAX_CHARS}
              onFocus={() => setCardOpen(false)}
              style={styles.input}
              accessibilityLabel="Message"
            />
          )}
          {voice.recording || draft.trim() ? (
            <Pressable
              onPress={() => (voice.recording ? stopAndSendVoice() : send())}
              accessibilityRole="button"
              accessibilityLabel={voice.recording ? 'Send voice note' : 'Send'}
            >
              <LinearGradient colors={[colors.blue, colors.purple]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.send}>
                <Ionicons name="arrow-up" size={22} color={colors.white} />
              </LinearGradient>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => {
                setCardOpen(false);
                voice.start().catch((e) => {
                  console.warn('Recording failed', e);
                  setSendError('Couldn’t start recording. Try again.');
                });
              }}
              disabled={sendingVoice}
              style={[styles.mic, sendingVoice && { opacity: 0.4 }]}
              accessibilityRole="button"
              accessibilityLabel="Record a voice note"
            >
              <Ionicons name="mic" size={22} color={colors.blue} />
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
      {group ? <GroupInfo visible={infoOpen} onClose={() => setInfoOpen(false)} groupId={group.id} /> : null}
    </SafeAreaView>
  );
}

/** Who's in the group (tap to see a profile), who's still invited, and Leave. */
function GroupInfo({ visible, onClose, groupId }: { visible: boolean; onClose: () => void; groupId: string }) {
  const styles = useStyles();
  const colors = useColors();
  const { user } = useAuth();
  const { groups } = useMatches();
  const me = user?.uid ?? '';
  const group = groups?.find((g) => g.id === groupId);
  if (!group) return null;
  const row = (uid: string, invited: boolean) => {
    const p = group.people[uid];
    if (!p) return null;
    return (
      <Pressable
        key={uid}
        onPress={() => {
          if (uid === me) return;
          onClose();
          router.push({ pathname: '/user/[id]', params: { id: uid } });
        }}
        style={({ pressed }) => [styles.member, pressed && uid !== me && { opacity: 0.7 }]}
        accessibilityRole={uid === me ? undefined : 'button'}
      >
        <Avatar uri={p.photoURL} name={displayName(p)} seed={p.id} size={40} />
        <View style={styles.flex}>
          <Text style={styles.memberName}>
            {uid === me ? 'You' : displayName(p)}
            {uid === group.createdBy ? <Text style={styles.memberTag}>  · Started it</Text> : null}
          </Text>
          <Text style={styles.memberRole} numberOfLines={1}>
            {invited ? 'Invited · hasn’t joined yet' : roleLine(p, 2)}
          </Text>
        </View>
        {uid !== me ? <Ionicons name="chevron-forward" size={18} color={colors.textMuted} /> : null}
      </Pressable>
    );
  };
  function leave() {
    Alert.alert('Leave this group?', 'You’ll stop getting its messages. Your connections stay as they are.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          onClose();
          router.back();
          await leaveGroup(groupId).catch((e) => console.warn('Leave failed', e));
        },
      },
    ]);
  }
  return (
    <Sheet visible={visible} title={groupTitle(group, me)} onClose={onClose}>
      <View style={styles.members}>
        {group.members.map((u) => row(u, false))}
        {group.invited.map((u) => row(u, true))}
      </View>
      <Pressable onPress={leave} style={({ pressed }) => [styles.leave, pressed && { opacity: 0.7 }]} accessibilityRole="button">
        <Text style={styles.leaveText}>Leave group</Text>
      </Pressable>
    </Sheet>
  );
}

/** The little emoji pill under a bubble: each emoji once, plus a count when both of you reacted. */
function Reactions(props: { msg: ChatMessage; mine: boolean; me: string; onPress: () => void }) {
  const styles = useStyles();
  const all = Object.values(props.msg.reactions ?? {});
  if (all.length === 0) return null;
  const unique = [...new Set(all)];
  const iReacted = !!props.msg.reactions?.[props.me];
  return (
    <Pressable
      onPress={props.onPress}
      style={[styles.reactions, props.mine ? styles.reactionsMine : styles.reactionsTheirs, iReacted && styles.reactionsOn]}
      accessibilityRole="button"
      accessibilityLabel={`Reactions: ${all.join(' ')}`}
    >
      <Text style={styles.reactionsText}>
        {unique.join('')}
        {all.length > 1 ? ` ${all.length}` : ''}
      </Text>
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
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
  sys: { alignSelf: 'center', textAlign: 'center', fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.textSecondary, marginVertical: 8, paddingHorizontal: 24 },
  sender: { fontFamily: fonts.bodySemibold, fontSize: 12, color: colors.textSecondary, marginLeft: 12, marginBottom: 3 },
  members: { gap: 4 },
  member: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  memberName: { fontFamily: fonts.bodySemibold, fontSize: 16, color: colors.text },
  memberTag: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },
  memberRole: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary },
  leave: { marginTop: 18, alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 20 },
  leaveText: { fontFamily: fonts.bodySemibold, fontSize: 16, color: colors.red },
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
  picker: {
    flexDirection: 'row',
    gap: 2,
    padding: 4,
    marginBottom: 6,
    borderRadius: radius.full,
    backgroundColor: colors.white,
    shadowColor: '#2A3B4D',
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  pickOpt: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  pickOn: { backgroundColor: '#E6F1F7' },
  pickEmoji: { fontSize: 24 },
  reactions: {
    marginTop: -8,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: '#F6F3EE',
    shadowColor: '#2A3B4D',
    shadowOpacity: 0.08,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  reactionsMine: { alignSelf: 'flex-start', marginLeft: 8 },
  reactionsTheirs: { alignSelf: 'flex-end', marginRight: 8 },
  reactionsOn: { backgroundColor: '#E6F1F7' },
  reactionsText: { fontSize: 14, lineHeight: 18, color: colors.textSecondary, fontFamily: fonts.bodySemibold },
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
  mic: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#E6F1F7', alignItems: 'center', justifyContent: 'center' },
  sendingVoice: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.textSecondary, textAlign: 'right', paddingHorizontal: 16, paddingBottom: 4 },
  send: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center' },
  error: { fontFamily: fonts.body, fontSize: 13, color: colors.red, textAlign: 'center', paddingVertical: 6 },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  missingText: { fontFamily: fonts.body, fontSize: 16, color: colors.textSecondary },
  link: { fontFamily: fonts.bodySemibold, fontSize: 16, color: colors.blue },
}));
