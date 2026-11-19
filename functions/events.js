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
    featured: !!e.featured,
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

/**
 * { id, decision: 'approve' | 'reject' | 'remove' | 'feature', collabHosted?: boolean, featured?: boolean }
 * 'feature' only flips the Featured flag on an event that's already live.
 */
exports.reviewEvent = onCall({ maxInstances: 2, memory: '256MiB' }, async (request) => {
  requireAdmin(request);
  const { id, decision, collabHosted, featured } = request.data ?? {};
  if (typeof id !== 'string' || !['approve', 'reject', 'remove', 'feature'].includes(decision)) {
    throw new HttpsError('invalid-argument', 'Pick an event and a decision.');
  }
  const ref = getFirestore().doc(`events/${id}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'That event no longer exists.');
  if (decision === 'remove') {
    await ref.delete();
  } else if (decision === 'feature') {
    await ref.update({ featured: !!featured });
  } else {
    await ref.update({
      status: decision === 'approve' ? 'approved' : 'rejected',
      collabHosted: decision === 'approve' && !!collabHosted,
      featured: decision === 'approve' && !!featured,
      reviewedAt: FieldValue.serverTimestamp(),
      reviewedBy: request.auth.uid,
    });
  }
  return { ok: true };
});

/**
 * Collab team: delete any event from the app.
 * { eventId, source: 'posted' | 'curated', date?: 'YYYY-MM-DD' }
 *   posted  → the event is deleted for everyone.
 *   curated → built-in listings can't be deleted from code here, so they're hidden: just `date`
 *             if given, otherwise every date of the series.
 * Clears the matching "I'm going"s too.
 */
exports.adminDeleteEvent = onCall({ maxInstances: 2, memory: '256MiB' }, async (request) => {
  requireAdmin(request);
  const { eventId, source, date } = request.data ?? {};
  if (typeof eventId !== 'string' || !eventId || eventId.includes('/') || !['posted', 'curated'].includes(source)) {
    throw new HttpsError('invalid-argument', 'Pick an event.');
  }
  if (date != null && !(typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date))) {
    throw new HttpsError('invalid-argument', 'Bad date.');
  }
  const db = getFirestore();
  if (source === 'posted') {
    await db.doc(`events/${eventId}`).delete();
  } else {
    await db.doc(`hiddenEvents/${eventId}`).set(
      date
        ? { dates: FieldValue.arrayUnion(date), by: request.auth.uid, at: FieldValue.serverTimestamp() }
        : { all: true, by: request.auth.uid, at: FieldValue.serverTimestamp() },
      { merge: true },
    );
  }
  // RSVP keys are `${eventId}@${date}`.
  const prefix = date && source === 'curated' ? `${eventId}@${date}` : `${eventId}@`;
  const rsvps = await db.collection('rsvps').where('key', '>=', prefix).where('key', '<=', `${prefix}\uf8ff`).get();
  const batch = db.batch();
  rsvps.docs.slice(0, 450).forEach((d) => batch.delete(d.ref));
  await batch.commit();
  return { ok: true };
});

/**
 * Collab team: edit any event.
 * { eventId, source: 'posted' | 'curated', fields, reset? }
 *   posted  → the event doc is updated (null clears an optional field).
 *   curated → built-in listings live in the app's code, so edits are saved as an override in
 *             `eventOverrides/{eventId}` that the app applies on top. `reset: true` removes it.
 */
const TYPES = ['open-mic', 'jam', 'show', 'meetup'];
const str = (max, min = 0) => (v) => typeof v === 'string' && v.trim().length >= min && v.length <= max;
const optStr = (max) => (v) => v === null || str(max)(v);
const bool = (v) => typeof v === 'boolean';
const hhmm = (v) => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
const COMMON = {
  title: str(80, 1),
  type: (v) => TYPES.includes(v),
  venue: str(80, 1),
  address: str(140),
  neighborhood: str(60),
  lat: (v) => typeof v === 'number' && v > 40.45 && v < 40.95,
  lng: (v) => typeof v === 'number' && v > -74.3 && v < -73.65,
  description: str(1000),
  cost: optStr(60),
  signUp: optStr(120),
  link: optStr(300),
  featured: bool,
};
const POSTED = {
  ...COMMON,
  startsAt: (v) => typeof v === 'number' && v > 0,
  endsAt: (v) => v === null || (typeof v === 'number' && v > 0),
  capacity: (v) => v === null || (Number.isInteger(v) && v >= 1 && v <= 5000),
  collabHosted: bool,
};
const CURATED = {
  ...COMMON,
  days: (v) => Array.isArray(v) && v.length > 0 && v.length <= 7 && v.every((d) => Number.isInteger(d) && d >= 0 && d <= 6),
  date: (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v),
  time: hhmm,
  endTime: (v) => v === null || hhmm(v),
  verified: bool,
};

exports.adminUpdateEvent = onCall({ maxInstances: 2, memory: '256MiB' }, async (request) => {
  requireAdmin(request);
  const { eventId, source, fields, reset } = request.data ?? {};
  if (typeof eventId !== 'string' || !eventId || eventId.includes('/') || !['posted', 'curated'].includes(source)) {
    throw new HttpsError('invalid-argument', 'Pick an event.');
  }
  const db = getFirestore();
  if (source === 'curated' && reset) {
    await db.doc(`eventOverrides/${eventId}`).delete();
    return { ok: true };
  }
  if (!fields || typeof fields !== 'object') throw new HttpsError('invalid-argument', 'Nothing to save.');
  const rules = source === 'posted' ? POSTED : CURATED;
  const clean = {};
  for (const [k, v] of Object.entries(fields)) {
    if (!rules[k]) continue;
    if (!rules[k](v)) throw new HttpsError('invalid-argument', `Check the ${k} field.`);
    clean[k] = typeof v === 'string' ? v.trim() : v;
  }
  if (!Object.keys(clean).length) throw new HttpsError('invalid-argument', 'Nothing to save.');
  if (source === 'posted') {
    const ref = db.doc(`events/${eventId}`);
    if (!(await ref.get()).exists) throw new HttpsError('not-found', 'That event no longer exists.');
    const update = {};
    for (const [k, v] of Object.entries(clean)) update[k] = v === null ? FieldValue.delete() : v;
    update.editedAt = FieldValue.serverTimestamp();
    update.editedBy = request.auth.uid;
    await ref.update(update);
  } else {
    await db.doc(`eventOverrides/${eventId}`).set(
      { ...clean, editedAt: FieldValue.serverTimestamp(), editedBy: request.auth.uid },
      { merge: true },
    );
  }
  return { ok: true };
});

/** For the app: is this person on the Collab team, and how many events are waiting for review? */
exports.teamStatus = onCall({ maxInstances: 3, memory: '256MiB' }, async (request) => {
  if (!request.auth || !adminUids().includes(request.auth.uid)) return { admin: false, pending: 0 };
  const pending = await getFirestore().collection('events').where('status', '==', 'pending').count().get();
  return { admin: true, pending: pending.data().count };
});
