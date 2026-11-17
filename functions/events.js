/**
 * Event submissions (Collab team only): list what's waiting for review, and approve or reject it.
 * People post events from the app as status 'pending'; nothing shows to others until it's approved here.
 */
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { adminUids } = require('./params');

function requireAdmin(request) {
  if (!request.auth || !adminUids().includes(request.auth.uid)) {
    throw new HttpsError('permission-denied', 'This is only for the Collab team.');
  }
}

function shape(d) {
  const e = d.data();
  return {
    id: d.id,
    title: e.title,
    type: e.type,
    venue: e.venue,
    address: e.address,
    neighborhood: e.neighborhood,
    startsAt: e.startsAt,
    cost: e.cost ?? null,
    signUp: e.signUp ?? null,
    description: e.description,
    link: e.link ?? null,
    hostId: e.hostId,
    hostName: e.hostName,
    status: e.status,
    collabHosted: !!e.collabHosted,
    createdAt: e.createdAt?.toMillis?.() ?? null,
    flyerURL: e.flyerURL ?? null,
    flyerAspect: e.flyerAspect ?? null,
  };
}

/** Pending submissions, plus upcoming approved events so they can be taken down if needed. */
exports.eventSubmissions = onCall({ maxInstances: 2, memory: '256MiB' }, async (request) => {
  requireAdmin(request);
  const db = getFirestore();
  const [pending, approved] = await Promise.all([
    db.collection('events').where('status', '==', 'pending').get(),
    db.collection('events').where('status', '==', 'approved').get(),
  ]);
  const startOfToday = Date.now() - 12 * 3600 * 1000;
  return {
    pending: pending.docs.map(shape).sort((a, b) => a.startsAt - b.startsAt),
    approved: approved.docs.map(shape).filter((e) => e.startsAt >= startOfToday).sort((a, b) => a.startsAt - b.startsAt),
  };
});

/** { id, decision: 'approve' | 'reject' | 'remove', collabHosted?: boolean } */
exports.reviewEvent = onCall({ maxInstances: 2, memory: '256MiB' }, async (request) => {
  requireAdmin(request);
  const { id, decision, collabHosted } = request.data ?? {};
  if (typeof id !== 'string' || !['approve', 'reject', 'remove'].includes(decision)) {
    throw new HttpsError('invalid-argument', 'Pick an event and a decision.');
  }
  const ref = getFirestore().doc(`events/${id}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'That event no longer exists.');
  if (decision === 'remove') {
    await ref.delete();
  } else {
    await ref.update({
      status: decision === 'approve' ? 'approved' : 'rejected',
      collabHosted: decision === 'approve' && !!collabHosted,
      reviewedAt: FieldValue.serverTimestamp(),
      reviewedBy: request.auth.uid,
    });
  }
  return { ok: true };
});

/** For the app: is this person on the Collab team, and how many events are waiting for review? */
exports.teamStatus = onCall({ maxInstances: 3, memory: '256MiB' }, async (request) => {
  if (!request.auth || !adminUids().includes(request.auth.uid)) return { admin: false, pending: 0 };
  const pending = await getFirestore().collection('events').where('status', '==', 'pending').count().get();
  return { admin: true, pending: pending.data().count };
});
