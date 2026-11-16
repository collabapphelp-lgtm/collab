import {
  collection,
  deleteField,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { httpsCallable, getFunctions } from 'firebase/functions';
import { app, db } from './firebase';
import { UI_PREVIEW } from './preview';
import { PREVIEW_PROFILES } from './preview-data';
import { getProfile } from './profiles';
import { uploadVoiceNote } from './upload';
import type { UserProfile } from './types';

/**
 * Connections (two people who liked each other) and their chats.
 *
 *   matches/{uidA_uidB}
 *     members:     [uidA, uidB]
 *     createdAt
 *     lastMessage: { text, senderId, createdAt }   — drives the Messages list
 *     lastRead:    { [uid]: timestamp }            — drives unread badges
 *   matches/{uidA_uidB}/messages/{autoId}
 *     text, senderId, createdAt
 */

type FirestoreTime = { toMillis?: () => number; toDate?: () => Date };

export type LastMessage = { text: string; senderId: string; at: number };

export type Match = {
  id: string;
  members: string[];
  createdAt: number;
  other: UserProfile;
  lastMessage?: LastMessage;
  /** When each member last opened the chat (ms). */
  lastRead: Record<string, number>;
};

export type ChatMessage = {
  id: string;
  text: string;
  senderId: string;
  at: number;
  pending?: boolean;
  /** uid → emoji. One reaction per person per message. */
  reactions?: Record<string, string>;
  /** Voice notes: a Storage download URL and the length. `text` is '🎤 Voice note' so previews and alerts read well. */
  audioUrl?: string;
  durationMs?: number;
};

export const VOICE_NOTE_TEXT = '🎤 Voice note';
export const VOICE_NOTE_MAX_MS = 120_000;

/** The reactions you can put on a message (long-press a bubble). Keep in sync with firestore.rules. */
export const REACTIONS = ['❤️', '👍', '🔥', '😂', '😮', '🙏'] as const;

export const MESSAGE_MAX_CHARS = 1000;

const ms = (t?: FirestoreTime | null) => t?.toMillis?.() ?? Date.now();

/** Group chat ids start with "g-"; everything else is a 1:1 connection (uidA_uidB). */
export const isGroupId = (id: string) => id.startsWith('g-');
const chatRef = (id: string) => doc(db, isGroupId(id) ? 'groups' : 'matches', id);
const previewChat = (id: string) => preview.matches.find((x) => x.id === id) ?? preview.groups.find((x) => x.id === id);

export function isUnread(m: Match, me: string) {
  return !!m.lastMessage && m.lastMessage.senderId !== me && m.lastMessage.at > (m.lastRead[me] ?? 0);
}

/** Most recent activity first: last message, or when you connected. */
const activity = (m: Match) => m.lastMessage?.at ?? m.createdAt;

/** Live list of my connections, most recent activity first, each with the other person's profile. */
export function listenToMatches(me: string, onChange: (matches: Match[]) => void, onError?: (e: Error) => void) {
  if (UI_PREVIEW) {
    const l = () =>
      onChange(preview.matches.filter((m) => !previewBlocked.has(m.other.id)).sort((a, b) => activity(b) - activity(a)));
    preview.listeners.add(l);
    l();
    return () => void preview.listeners.delete(l);
  }

  const profiles = new Map<string, UserProfile>();
  return onSnapshot(
    query(collection(db, 'matches'), where('members', 'array-contains', me)),
    async (snap) => {
      const rows = await Promise.all(
        snap.docs.map(async (d): Promise<Match | null> => {
          const data = d.data({ serverTimestamps: 'estimate' }) as {
            members: string[];
            createdAt?: FirestoreTime;
            lastMessage?: { text: string; senderId: string; createdAt?: FirestoreTime };
            lastRead?: Record<string, FirestoreTime>;
            blockedBy?: string;
            closedBy?: string;
          };
          // Blocked or closed (account deleted) connections disappear for both people.
          if (data.blockedBy || data.closedBy) return null;
          const otherId = data.members.find((m) => m !== me);
          if (!otherId) return null;
          if (!profiles.has(otherId)) {
            const p = await getProfile(otherId);
            if (p) profiles.set(otherId, p);
          }
          const other = profiles.get(otherId);
          if (!other) return null;
          return {
            id: d.id,
            members: data.members,
            createdAt: ms(data.createdAt),
            other,
            lastMessage: data.lastMessage
              ? { text: data.lastMessage.text, senderId: data.lastMessage.senderId, at: ms(data.lastMessage.createdAt) }
              : undefined,
            lastRead: Object.fromEntries(Object.entries(data.lastRead ?? {}).map(([k, v]) => [k, ms(v)])),
          };
        }),
      );
      onChange(rows.filter((r): r is Match => r !== null).sort((a, b) => activity(b) - activity(a)));
    },
    (e) => onError?.(e),
  );
}

/** Live messages in one chat, oldest first (the last 200). */
export function listenToMessages(matchId: string, onChange: (msgs: ChatMessage[]) => void, onError?: (e: Error) => void) {
  if (UI_PREVIEW) {
    const l = () => onChange([...(preview.messages.get(matchId) ?? [])]);
    preview.listeners.add(l);
    l();
    return () => void preview.listeners.delete(l);
  }

  return onSnapshot(
    query(collection(chatRef(matchId), 'messages'), orderBy('createdAt', 'desc'), limit(200)),
    (snap) => {
      const msgs = snap.docs.map((d) => {
        const data = d.data({ serverTimestamps: 'estimate' }) as {
          text: string;
          senderId: string;
          createdAt?: FirestoreTime;
          reactions?: Record<string, string>;
          audioUrl?: string;
          durationMs?: number;
        };
        return {
          id: d.id,
          text: data.text,
          senderId: data.senderId,
          at: ms(data.createdAt),
          pending: d.metadata.hasPendingWrites,
          reactions: data.reactions,
          audioUrl: data.audioUrl,
          durationMs: data.durationMs,
        };
      });
      onChange(msgs.reverse());
    },
    (e) => onError?.(e),
  );
}

/** Sends a message and updates the chat's preview + the sender's read marker in one write. */
export async function sendMessage(matchId: string, me: string, text: string) {
  const clean = text.trim().slice(0, MESSAGE_MAX_CHARS);
  if (!clean) return;

  if (UI_PREVIEW) {
    const list = preview.messages.get(matchId) ?? [];
    const at = Date.now();
    list.push({ id: String(at), text: clean, senderId: me, at });
    preview.messages.set(matchId, list);
    const m = previewChat(matchId);
    if (m) {
      m.lastMessage = { text: clean, senderId: me, at };
      m.lastRead[me] = at;
    }
    preview.emit();
    return;
  }

  const matchRef = chatRef(matchId);
  const batch = writeBatch(db);
  batch.set(doc(collection(matchRef, 'messages')), { text: clean, senderId: me, createdAt: serverTimestamp() });
  batch.update(matchRef, {
    lastMessage: { text: clean, senderId: me, createdAt: serverTimestamp() },
    [`lastRead.${me}`]: serverTimestamp(),
  });
  await batch.commit();
}

/** Uploads a recorded voice note and posts it to the chat. */
export async function sendVoiceNote(matchId: string, me: string, localUri: string, durationMs: number) {
  const length = Math.min(Math.round(durationMs), VOICE_NOTE_MAX_MS);
  if (UI_PREVIEW) {
    const list = preview.messages.get(matchId) ?? [];
    const at = Date.now();
    list.push({ id: String(at), text: VOICE_NOTE_TEXT, senderId: me, at, audioUrl: localUri, durationMs: length });
    preview.messages.set(matchId, list);
    const m = previewChat(matchId);
    if (m) {
      m.lastMessage = { text: VOICE_NOTE_TEXT, senderId: me, at };
      m.lastRead[me] = at;
    }
    preview.emit();
    return;
  }

  const { url } = await uploadVoiceNote(me, matchId, localUri);
  const matchRef = chatRef(matchId);
  const batch = writeBatch(db);
  batch.set(doc(collection(matchRef, 'messages')), {
    text: VOICE_NOTE_TEXT,
    senderId: me,
    createdAt: serverTimestamp(),
    audioUrl: url,
    durationMs: length,
  });
  batch.update(matchRef, {
    lastMessage: { text: VOICE_NOTE_TEXT, senderId: me, createdAt: serverTimestamp() },
    [`lastRead.${me}`]: serverTimestamp(),
  });
  await batch.commit();
}

/** Sets my reaction on a message, or removes it (emoji = null). */
export async function setReaction(matchId: string, messageId: string, me: string, emoji: string | null) {
  if (UI_PREVIEW) {
    const msg = preview.messages.get(matchId)?.find((m) => m.id === messageId);
    if (!msg) return;
    const next = { ...(msg.reactions ?? {}) };
    if (emoji) next[me] = emoji;
    else delete next[me];
    msg.reactions = next;
    preview.emit();
    return;
  }
  await updateDoc(doc(chatRef(matchId), 'messages', messageId), {
    [`reactions.${me}`]: emoji ?? deleteField(),
  });
}

/** Marks the chat as read for me (clears the unread badge). */
export async function markRead(matchId: string, me: string) {
  if (UI_PREVIEW) {
    const m = previewChat(matchId);
    if (m) {
      m.lastRead[me] = Date.now();
      preview.emit();
    }
    return;
  }
  await updateDoc(chatRef(matchId), { [`lastRead.${me}`]: serverTimestamp() });
}

// ---- Group chats (see functions/groups.js) ----

export const GROUP_MAX_PEOPLE = 6;

export type Group = {
  id: string;
  name: string;
  createdBy: string;
  members: string[];
  invited: string[];
  /** Profiles of everyone in it or invited, by uid (me included when loaded). */
  people: Record<string, UserProfile>;
  createdAt: number;
  lastMessage?: LastMessage;
  lastRead: Record<string, number>;
};

/** "Ava, Leo & Dre" (the group's name if it has one). */
export function groupTitle(g: Group, me: string) {
  if (g.name) return g.name;
  const names = [...g.members, ...g.invited].filter((u) => u !== me).map((u) => g.people[u]?.firstName ?? 'Someone');
  return names.length <= 2 ? names.join(' & ') : `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
}

export function isGroupUnread(g: Group, me: string) {
  return !!g.lastMessage && g.lastMessage.senderId !== me && g.lastMessage.at > (g.lastRead[me] ?? 0);
}

/** Live list of group chats I'm in or invited to. */
export function listenToGroups(me: string, onChange: (groups: Group[]) => void, onError?: (e: Error) => void) {
  if (UI_PREVIEW) {
    const l = () => onChange([...preview.groups].sort((a, b) => (b.lastMessage?.at ?? b.createdAt) - (a.lastMessage?.at ?? a.createdAt)));
    preview.listeners.add(l);
    l();
    return () => void preview.listeners.delete(l);
  }

  const profiles = new Map<string, UserProfile>();
  const parts: { members: Group[]; invited: Group[] } = { members: [], invited: [] };
  const emit = () => {
    const byId = new Map([...parts.invited, ...parts.members].map((g) => [g.id, g]));
    onChange([...byId.values()].sort((a, b) => (b.lastMessage?.at ?? b.createdAt) - (a.lastMessage?.at ?? a.createdAt)));
  };
  const listen = (field: 'members' | 'invited') =>
    onSnapshot(
      query(collection(db, 'groups'), where(field, 'array-contains', me)),
      async (snap) => {
        const rows = await Promise.all(
          snap.docs.map(async (d): Promise<Group> => {
            const data = d.data({ serverTimestamps: 'estimate' }) as {
              name?: string;
              createdBy: string;
              members?: string[];
              invited?: string[];
              createdAt?: FirestoreTime;
              lastMessage?: { text: string; senderId: string; createdAt?: FirestoreTime };
              lastRead?: Record<string, FirestoreTime>;
            };
            const uids = [...(data.members ?? []), ...(data.invited ?? [])];
            await Promise.all(
              uids
                .filter((u) => !profiles.has(u))
                .map(async (u) => {
                  const p = await getProfile(u).catch(() => null);
                  if (p) profiles.set(u, p);
                }),
            );
            return {
              id: d.id,
              name: data.name ?? '',
              createdBy: data.createdBy,
              members: data.members ?? [],
              invited: data.invited ?? [],
              people: Object.fromEntries(uids.filter((u) => profiles.has(u)).map((u) => [u, profiles.get(u)!])),
              createdAt: ms(data.createdAt),
              lastMessage: data.lastMessage
                ? { text: data.lastMessage.text, senderId: data.lastMessage.senderId, at: ms(data.lastMessage.createdAt) }
                : undefined,
              lastRead: Object.fromEntries(Object.entries(data.lastRead ?? {}).map(([k, v]) => [k, ms(v)])),
            };
          }),
        );
        parts[field] = rows;
        emit();
      },
      (e) => onError?.(e),
    );
  const a = listen('members');
  const b = listen('invited');
  return () => {
    a();
    b();
  };
}

const call = <T, R>(name: string) => httpsCallable<T, R>(getFunctions(app), name);

/** Starts a group with some of my connections. They get an invite to join. Returns the new chat id. */
export async function createGroup(me: UserProfile, invite: UserProfile[], name: string): Promise<string> {
  if (UI_PREVIEW) {
    const id = `g-preview-${Date.now()}`;
    const at = Date.now();
    const text = `${me.firstName} started ${name.trim() ? `“${name.trim()}”` : 'the group'}`;
    preview.groups.unshift({
      id,
      name: name.trim(),
      createdBy: me.id,
      members: [me.id],
      invited: invite.map((p) => p.id),
      people: Object.fromEntries([me, ...invite].map((p) => [p.id, p])),
      createdAt: at,
      lastMessage: { text, senderId: 'system', at },
      lastRead: { [me.id]: at },
    });
    preview.messages.set(id, [{ id: 'sys', text, senderId: 'system', at }]);
    preview.emit();
    return id;
  }
  const res = await call<{ invite: string[]; name: string }, { id: string }>('createGroup')({
    invite: invite.map((p) => p.id),
    name: name.trim(),
  });
  return res.data.id;
}

/** Join or decline a group I was added to. Joining also connects me with members I wasn't connected with. */
export async function respondToGroup(groupId: string, me: UserProfile, accept: boolean) {
  if (UI_PREVIEW) {
    const g = preview.groups.find((x) => x.id === groupId);
    if (!g) return;
    g.invited = g.invited.filter((u) => u !== me.id);
    if (accept) {
      g.members = [...g.members, me.id];
      g.people[me.id] = me;
      const at = Date.now();
      const text = `${me.firstName} joined`;
      preview.messages.set(groupId, [...(preview.messages.get(groupId) ?? []), { id: `j${at}`, text, senderId: 'system', at }]);
      g.lastMessage = { text, senderId: 'system', at };
      g.lastRead[me.id] = at;
    } else {
      preview.groups = preview.groups.filter((x) => x.id !== groupId);
    }
    preview.emit();
    return;
  }
  await call<{ groupId: string; accept: boolean }, unknown>('respondToGroup')({ groupId, accept });
}

export async function leaveGroup(groupId: string) {
  if (UI_PREVIEW) {
    preview.groups = preview.groups.filter((x) => x.id !== groupId);
    preview.emit();
    return;
  }
  await call<{ groupId: string }, unknown>('leaveGroup')({ groupId });
}

// ---- Preview-mode store (in memory only; never touches Firebase) ----
export const previewBlocked = new Set<string>();
export function previewBlock(uid: string) {
  previewBlocked.add(uid);
  preview.emit();
}

const preview = {
  matches: [] as Match[],
  groups: [] as Group[],
  messages: new Map<string, ChatMessage[]>(),
  listeners: new Set<() => void>(),
  emit() {
    this.listeners.forEach((l) => l());
  },
};

export function addPreviewMatch(m: Omit<Match, 'lastRead' | 'createdAt'>) {
  if (preview.matches.some((x) => x.id === m.id)) return;
  preview.matches.unshift({ ...m, createdAt: Date.now(), lastRead: {} });
  preview.emit();
}

if (UI_PREVIEW) {
  // One existing conversation so the Messages list and a chat with history can be previewed.
  const tasha = PREVIEW_PROFILES.find((p) => p.id === 'p6');
  if (tasha) {
    const id = 'p6_preview';
    const t0 = Date.now() - 1000 * 60 * 60 * 26;
    preview.matches.push({
      id,
      members: ['preview', 'p6'],
      createdAt: t0,
      other: tasha,
      lastMessage: { text: 'Bet. Thursday at 7 works. I’ll bring the camera 🎥', senderId: 'p6', at: t0 + 1000 * 60 * 60 * 25 },
      lastRead: { preview: t0 + 1000 * 60 * 60 * 2 },
    });
    preview.messages.set(id, [
      { id: 'm1', senderId: 'preview', text: 'Yo! Loved your Westside visual. Your color grading is crazy.', at: t0 + 60_000 },
      { id: 'm2', senderId: 'p6', text: 'Appreciate that!! Your beat tape is on repeat over here 🔥', at: t0 + 1000 * 60 * 20, reactions: { preview: '❤️' } },
      { id: 'm3', senderId: 'preview', text: 'Want to shoot something for my next single? Thinking moody, late night.', at: t0 + 1000 * 60 * 60 * 2, reactions: { p6: '🔥' } },
      { id: 'm4', senderId: 'p6', text: 'Bet. Thursday at 7 works. I’ll bring the camera 🎥', at: t0 + 1000 * 60 * 60 * 25, reactions: { preview: '👍' } },
      { id: 'm5', senderId: 'p6', text: VOICE_NOTE_TEXT, at: t0 + 1000 * 60 * 60 * 25.1, audioUrl: '/shots/voice.m4a', durationMs: 23_000 },
    ]);
  }
  // A pending group invite, so the invite card can be previewed.
  const [leo, dre] = ['p2', 'p4'].map((pid) => PREVIEW_PROFILES.find((p) => p.id === pid));
  if (leo && dre) {
    const at = Date.now() - 1000 * 60 * 40;
    preview.groups.push({
      id: 'g-preview-invite',
      name: 'Sunday session',
      createdBy: leo.id,
      members: [leo.id, dre.id],
      invited: ['preview'],
      people: { [leo.id]: leo, [dre.id]: dre },
      createdAt: at,
      lastMessage: { text: 'I got the camera. Shooting BTS for the reel 🎥', senderId: leo.id, at },
      lastRead: {},
    });
    preview.messages.set('g-preview-invite', [
      { id: 's1', text: `${leo.firstName} started “Sunday session”`, senderId: 'system', at: at - 5 * 60_000 },
      { id: 's2', text: 'Made a group so we can lock in Sunday 🙌', senderId: leo.id, at: at - 4 * 60_000 },
      { id: 's3', text: `${dre.firstName} joined`, senderId: 'system', at: at - 3 * 60_000 },
      { id: 's4', text: 'Studio’s booked 2–6. Who’s bringing the mic?', senderId: dre.id, at: at - 2 * 60_000 },
      { id: 's5', text: 'I got the camera. Shooting BTS for the reel 🎥', senderId: leo.id, at, reactions: { [dre.id]: '🔥' } },
    ]);
  }
  // App Store screenshots: a fuller Connections grid.
  if (process.env.EXPO_PUBLIC_SHOT_PHOTOS === '1') {
    for (const pid of ['p2', 'p4', 'p5']) {
      const other = PREVIEW_PROFILES.find((p) => p.id === pid);
      if (other) preview.matches.push({ id: `${pid}_preview`, members: ['preview', pid], createdAt: Date.now(), other, lastRead: {} });
    }
  }
}
