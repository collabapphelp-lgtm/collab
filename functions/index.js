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
const { onDocumentCreated, onDocumentDeleted, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { setGlobalOptions, logger } = require('firebase-functions/v2');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

initializeApp();
const db = getFirestore();

// Small and cheap: low traffic, and a cap so a bug can never run up a bill.
setGlobalOptions({ maxInstances: 5, memory: '256MiB' });

const { firstName, notify, preview } = require('./notify');

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
        body: match.viaGroup
          ? `You and ${name} are now connected through your group chat.`
          : `You and ${name} are both in. Say hi and start creating.`,
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

// Admin alert when someone finishes setting up their profile (a real new member, not just an email signup).
exports.onProfileCompleted = onDocumentUpdated('users/{uid}', async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!after || before?.onboardingComplete || !after.onboardingComplete) return;
  // Skipped the "Show your work" step? Remind them once, a day later (see sendShowcaseNudges).
  if (!(after.showcase ?? []).length) {
    await db.doc(`nudges/${event.params.uid}`).set({ kind: 'showcase', dueAt: Date.now() + 24 * 60 * 60 * 1000 });
  }
  const admins = adminUids().filter((uid) => uid !== event.params.uid);
  const name = after.firstName || 'Someone';
  const where = after.location ? ` · ${String(after.location).split(',')[0]}` : '';
  const skills = (after.skills ?? []).slice(0, 2).join(', ');
  await Promise.all(
    admins.map((uid) =>
      notify(uid, {
        title: `🎉 New member: ${name}${where}`,
        body: skills ? `${name} just finished their profile (${skills}).` : `${name} just finished their profile.`,
        data: { type: 'signup' },
      }),
    ),
  );
});

// Hourly: send due reminders to add work. Skipped if they've added something since.
exports.sendShowcaseNudges = onSchedule('every 60 minutes', async () => {
  const due = await db.collection('nudges').where('dueAt', '<=', Date.now()).limit(200).get();
  for (const doc of due.docs) {
    const user = (await db.doc(`users/${doc.id}`).get()).data();
    if (user && !(user.showcase ?? []).length) {
      await notify(doc.id, {
        title: 'Get noticed on Collab 👀',
        body: 'Profiles with work get shown first. Answer one prompt or paste a link. It takes 30 seconds.',
        data: { type: 'nudge', url: '/edit/showcase' },
      });
    }
    await doc.ref.delete();
  }
});

// Tester dashboard (private).
// Tell the team when someone posts an event that needs review.
exports.onEventSubmitted = onDocumentCreated('events/{eventId}', async (event) => {
  const e = event.data?.data();
  if (!e || e.status !== 'pending') return;
  await Promise.all(
    adminUids().map((uid) =>
      notify(uid, {
        title: `📍 New event to review: ${e.title}`,
        body: `${e.hostName} posted ${e.title} at ${e.venue}. Approve it on the dashboard.`,
        data: { type: 'report' },
      }),
    ),
  );
});

// Tell the host when their event is approved.
exports.onEventReviewed = onDocumentUpdated('events/{eventId}', async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!before || !after || before.status === after.status || after.status !== 'approved') return;
  await notify(after.hostId, {
    title: 'Your event is live 🎉',
    body: `${after.title} is on the Events map. Share it with your people.`,
    data: { type: 'event' },
  });
});

exports.metrics = require('./metrics').metrics;
exports.eventSubmissions = require('./events').eventSubmissions;
exports.reviewEvent = require('./events').reviewEvent;
exports.accounts = require('./admin').accounts;
exports.deleteAccounts = require('./admin').deleteAccounts;
exports.joinApi = require('./join').joinApi;
exports.calendarFile = require('./calendar').calendarFile;
exports.createGroup = require('./groups').createGroup;
exports.respondToGroup = require('./groups').respondToGroup;
exports.leaveGroup = require('./groups').leaveGroup;
exports.onGroupMessage = require('./groups').onGroupMessage;
