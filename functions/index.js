/**
 * Collab Cloud Functions: push notifications.
 *
 * Deploy from the project folder:  firebase deploy --only functions
 *
 * - New match    → notify the person who liked first (the other one is already looking at "Let's Collab!").
 * - New message  → notify the other person in the chat, unless the chat is blocked or closed.
 *
 * Phones register their Expo push token in pushTokens/{uid} (see src/lib/push.ts).
 * Notifications go out through Expo's push service, which forwards them to Apple / Google.
 */
const { onDocumentCreated, onDocumentDeleted } = require('firebase-functions/v2/firestore');
const { setGlobalOptions, logger } = require('firebase-functions/v2');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

initializeApp();
const db = getFirestore();

// Small and cheap: low traffic, and a cap so a bug can never run up a bill.
setGlobalOptions({ maxInstances: 5, memory: '256MiB' });

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

async function tokensFor(uid) {
  const snap = await db.doc(`pushTokens/${uid}`).get();
  const tokens = snap.exists ? snap.get('tokens') : [];
  return Array.isArray(tokens) ? tokens.filter((t) => typeof t === 'string' && t.startsWith('ExponentPushToken')) : [];
}

async function firstName(uid) {
  const snap = await db.doc(`users/${uid}`).get();
  return (snap.exists && snap.get('firstName')) || 'Someone';
}

/** Sends one notification to every phone the person is signed in on, and forgets phones that no longer accept them. */
async function notify(uid, { title, body, data }) {
  const tokens = await tokensFor(uid);
  if (tokens.length === 0) return;

  const messages = tokens.map((to) => ({ to, title, body, data, sound: 'default', priority: 'high' }));
  const res = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(messages),
  });
  if (!res.ok) {
    logger.error('Expo push request failed', { status: res.status, body: await res.text() });
    return;
  }

  const { data: tickets = [] } = await res.json();
  const dead = tickets
    .map((t, i) => (t.status === 'error' && t.details?.error === 'DeviceNotRegistered' ? tokens[i] : null))
    .filter(Boolean);
  if (dead.length) await db.doc(`pushTokens/${uid}`).update({ tokens: FieldValue.arrayRemove(...dead) });

  const errors = tickets.filter((t) => t.status === 'error');
  if (errors.length) logger.warn('Some notifications were not accepted', { uid, errors });
}

const preview = (text) => (text.length > 120 ? `${text.slice(0, 117)}…` : text);

exports.onNewMatch = onDocumentCreated('matches/{matchId}', async (event) => {
  const match = event.data?.data();
  if (!match || !Array.isArray(match.members)) return;
  const { matchId } = event.params;

  // createdBy is whoever's like completed the match; the other person liked first and hasn't seen it yet.
  const creator = match.createdBy;
  const recipients = creator ? match.members.filter((m) => m !== creator) : match.members;

  await Promise.all(
    recipients.map(async (uid) => {
      const other = match.members.find((m) => m !== uid);
      const name = await firstName(other);
      return notify(uid, {
        title: 'Let’s Collab! 🎶',
        body: `You and ${name} are both in. Say hi and start creating.`,
        data: { type: 'match', matchId },
      });
    }),
  );
});

exports.onNewMessage = onDocumentCreated('matches/{matchId}/messages/{messageId}', async (event) => {
  const msg = event.data?.data();
  if (!msg || typeof msg.text !== 'string') return;
  const { matchId } = event.params;

  const matchSnap = await db.doc(`matches/${matchId}`).get();
  if (!matchSnap.exists) return;
  const match = matchSnap.data();
  if (match.blockedBy || match.closedBy) return;

  const recipient = match.members.find((m) => m !== msg.senderId);
  if (!recipient) return;

  await notify(recipient, {
    title: await firstName(msg.senderId),
    body: preview(msg.text),
    data: { type: 'message', matchId },
  });
});

// "Liked you": mirror each like into users/{them}/likedBy/{me} (server-written, so it can't be faked),
// and nudge them, unless the like completed a match (onNewMatch covers that).
exports.onLikeCreated = onDocumentCreated('users/{uid}/likes/{otherUid}', async (event) => {
  const { uid, otherUid } = event.params;
  if (uid === otherUid) return;
  await db.doc(`users/${otherUid}/likedBy/${uid}`).set({ createdAt: FieldValue.serverTimestamp() });
  const mutual = (await db.doc(`users/${otherUid}/likes/${uid}`).get()).exists;
  const blocked = (await db.doc(`users/${otherUid}/blocks/${uid}`).get()).exists;
  if (mutual || blocked) return;
  await notify(otherUid, {
    title: 'Someone wants to collab with you 👀',
    body: 'Open Collab to see who.',
    data: { type: 'like' },
  });
});

exports.onLikeDeleted = onDocumentDeleted('users/{uid}/likes/{otherUid}', async (event) => {
  const { uid, otherUid } = event.params;
  await db.doc(`users/${otherUid}/likedBy/${uid}`).delete();
});

// Safety: tell the Collab team right away when someone files a report.
const { adminUids } = require('./params');

exports.onNewReport = onDocumentCreated('reports/{reportId}', async (event) => {
  const r = event.data?.data();
  if (!r) return;
  const [reporter, reported] = await Promise.all([firstName(r.reporterId), firstName(r.reportedId)]);
  const admins = adminUids();
  await Promise.all(
    admins.map((uid) =>
      notify(uid, {
        title: `🚩 New report: ${reported}`,
        body: `${reporter} reported ${reported} (“${r.reason}”). Review it on the dashboard.`,
        data: { type: 'report' },
      }),
    ),
  );
});

// Tester dashboard (private).
exports.metrics = require('./metrics').metrics;
exports.accounts = require('./admin').accounts;
exports.deleteAccounts = require('./admin').deleteAccounts;
