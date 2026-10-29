import {
  collection,
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
import { db } from './firebase';
import { UI_PREVIEW } from './preview';
import { PREVIEW_PROFILES } from './preview-data';
import { getProfile } from './profiles';
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

export type ChatMessage = { id: string; text: string; senderId: string; at: number; pending?: boolean };

export const MESSAGE_MAX_CHARS = 1000;

const ms = (t?: FirestoreTime | null) => t?.toMillis?.() ?? Date.now();

export function isUnread(m: Match, me: string) {
  return !!m.lastMessage && m.lastMessage.senderId !== me && m.lastMessage.at > (m.lastRead[me] ?? 0);
}

/** Most recent activity first: last message, or when you connected. */
const activity = (m: Match) => m.lastMessage?.at ?? m.createdAt;

/** Live list of my connections, most recent activity first, each with the other person's profile. */
export function listenToMatches(me: string, onChange: (matches: Match[]) => void, onError?: (e: Error) => void) {
  if (UI_PREVIEW) {
    const l = () => onChange([...preview.matches].sort((a, b) => activity(b) - activity(a)));
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
          };
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
    query(collection(db, 'matches', matchId, 'messages'), orderBy('createdAt', 'desc'), limit(200)),
    (snap) => {
      const msgs = snap.docs.map((d) => {
        const data = d.data({ serverTimestamps: 'estimate' }) as { text: string; senderId: string; createdAt?: FirestoreTime };
        return { id: d.id, text: data.text, senderId: data.senderId, at: ms(data.createdAt), pending: d.metadata.hasPendingWrites };
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
    const m = preview.matches.find((x) => x.id === matchId);
    if (m) {
      m.lastMessage = { text: clean, senderId: me, at };
      m.lastRead[me] = at;
    }
    preview.emit();
    return;
  }

  const matchRef = doc(db, 'matches', matchId);
  const batch = writeBatch(db);
  batch.set(doc(collection(matchRef, 'messages')), { text: clean, senderId: me, createdAt: serverTimestamp() });
  batch.update(matchRef, {
    lastMessage: { text: clean, senderId: me, createdAt: serverTimestamp() },
    [`lastRead.${me}`]: serverTimestamp(),
  });
  await batch.commit();
}

/** Marks the chat as read for me (clears the unread badge). */
export async function markRead(matchId: string, me: string) {
  if (UI_PREVIEW) {
    const m = preview.matches.find((x) => x.id === matchId);
    if (m) {
      m.lastRead[me] = Date.now();
      preview.emit();
    }
    return;
  }
  await updateDoc(doc(db, 'matches', matchId), { [`lastRead.${me}`]: serverTimestamp() });
}

// ---- Preview-mode store (in memory only; never touches Firebase) ----
const preview = {
  matches: [] as Match[],
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
      { id: 'm2', senderId: 'p6', text: 'Appreciate that!! Your beat tape is on repeat over here 🔥', at: t0 + 1000 * 60 * 20 },
      { id: 'm3', senderId: 'preview', text: 'Want to shoot something for my next single? Thinking moody, late night.', at: t0 + 1000 * 60 * 60 * 2 },
      { id: 'm4', senderId: 'p6', text: 'Bet. Thursday at 7 works. I’ll bring the camera 🎥', at: t0 + 1000 * 60 * 60 * 25 },
    ]);
  }
}
