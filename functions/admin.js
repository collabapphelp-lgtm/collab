/**
 * Dashboard account tools (Collab team only): list every account, and permanently delete test accounts.
 */
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const { getStorage } = require('firebase-admin/storage');
const { adminUids } = require('./params');

function requireAdmin(request) {
  if (!request.auth || !adminUids().includes(request.auth.uid)) {
    throw new HttpsError('permission-denied', 'This is only for the Collab team.');
  }
}

/** Every login with its profile basics, so test accounts are easy to spot. */
exports.accounts = onCall({ maxInstances: 2, memory: '256MiB' }, async (request) => {
  requireAdmin(request);
  const db = getFirestore();
  const admins = new Set(adminUids());
  const users = new Map((await db.collection('users').get()).docs.map((d) => [d.id, d.data()]));
  const out = [];
  let pageToken;
  do {
    const page = await getAuth().listUsers(1000, pageToken);
    for (const u of page.users) {
      const p = users.get(u.uid);
      out.push({
        uid: u.uid,
        email: u.email ?? null,
        name: p ? [p.firstName, p.lastName].filter(Boolean).join(' ') : null,
        created: u.metadata.creationTime ? Date.parse(u.metadata.creationTime) : null,
        lastSignIn: u.metadata.lastSignInTime ? Date.parse(u.metadata.lastSignInTime) : null,
        finished: !!p?.onboardingComplete,
        isAdmin: admins.has(u.uid),
        isReview: /^collabapphelp\+review@gmail\.com$/i.test(u.email ?? ''),
      });
    }
    pageToken = page.pageToken;
  } while (pageToken);
  return out.sort((a, b) => (b.created ?? 0) - (a.created ?? 0));
});

/** Permanently removes accounts and everything tied to them. Admin and App Review accounts are protected. */
exports.deleteAccounts = onCall({ maxInstances: 1, memory: '512MiB', timeoutSeconds: 300 }, async (request) => {
  requireAdmin(request);
  const uids = Array.isArray(request.data?.uids) ? request.data.uids.filter((u) => typeof u === 'string') : [];
  if (!uids.length || uids.length > 50) throw new HttpsError('invalid-argument', 'Pick between 1 and 50 accounts.');

  const db = getFirestore();
  const auth = getAuth();
  const bucket = getStorage().bucket();
  const admins = new Set(adminUids());
  const results = [];

  for (const uid of uids) {
    try {
      const u = await auth.getUser(uid).catch(() => null);
      if (admins.has(uid)) throw new Error('That’s a team account.');
      if (/^collabapphelp\+review@gmail\.com$/i.test(u?.email ?? '')) throw new Error('That’s the App Review account. Apple needs it.');

      // Connections they're in, with every message.
      const matches = await db.collection('matches').where('members', 'array-contains', uid).get();
      for (const m of matches.docs) await db.recursiveDelete(m.ref);

      // Likes other people gave them (and the mirror entries their own likes created).
      const likedBy = await db.collection(`users/${uid}/likedBy`).get();
      for (const d of likedBy.docs) await db.doc(`users/${d.id}/likes/${uid}`).delete();
      const likes = await db.collection(`users/${uid}/likes`).get();
      for (const d of likes.docs) await db.doc(`users/${d.id}/likedBy/${uid}`).delete();

      // Profile and its subcollections, private docs, uploaded files, then the login.
      await db.recursiveDelete(db.doc(`users/${uid}`));
      await db.doc(`pushTokens/${uid}`).delete();
      await db.doc(`activity/${uid}`).delete();
      await bucket.deleteFiles({ prefix: `profile-photos/${uid}/` }).catch(() => {});
      await bucket.deleteFiles({ prefix: `media/${uid}/` }).catch(() => {});
      if (u) await auth.deleteUser(uid);
      results.push({ uid, ok: true });
    } catch (e) {
      results.push({ uid, ok: false, error: e.message });
    }
  }
  return results;
});
