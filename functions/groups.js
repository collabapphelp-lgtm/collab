/**
 * Group chats.
 *
 *   groups/g-{autoId}
 *     name        optional, ≤ 40 chars
 *     createdBy   uid
 *     members     uids who are in the chat (the creator, plus everyone who accepted)
 *     invited     uids who were added but haven't answered yet
 *     createdAt, lastMessage { text, senderId, createdAt }, lastRead { uid: time }
 *   groups/{id}/messages/{autoId}   same shape as 1:1 messages; senderId 'system' for "Ava joined" lines
 *
 * Only the creator adds people, only from their own connections, up to 6 people in total.
 * When two people who weren't connected have both joined, they become connected too
 * (a normal matches/{pair} doc, plus likes both ways so Discover stops showing them to each other).
 *
 * Creating, answering and leaving go through these functions; the app writes messages and read markers
 * directly (see firestore.rules).
 */
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const MAX_PEOPLE = 6;
const pair = (a, b) => [a, b].sort().join('_');

function deps() {
  // Lazy so this file can be required before initializeApp() runs in index.js.
  return { db: getFirestore(), ...require('./notify') };
}

async function connected(db, a, b) {
  const snap = await db.doc(`matches/${pair(a, b)}`).get();
  return snap.exists && !snap.get('blockedBy') && !snap.get('closedBy');
}

async function blockedEitherWay(db, a, b) {
  const [x, y] = await Promise.all([db.doc(`users/${a}/blocks/${b}`).get(), db.doc(`users/${b}/blocks/${a}`).get()]);
  return x.exists || y.exists;
}

async function systemLine(db, ref, text) {
  const now = FieldValue.serverTimestamp();
  const batch = db.batch();
  batch.set(ref.collection('messages').doc(), { text, senderId: 'system', createdAt: now });
  batch.update(ref, { lastMessage: { text, senderId: 'system', createdAt: now } });
  await batch.commit();
}

const listNames = (names) => (names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`);

exports.createGroup = onCall(async (req) => {
  const { db, firstName, notify } = deps();
  const me = req.auth?.uid;
  if (!me) throw new HttpsError('unauthenticated', 'Sign in first.');
  const raw = Array.isArray(req.data?.invite) ? req.data.invite : [];
  const invite = [...new Set(raw.filter((u) => typeof u === 'string' && u && u !== me))];
  const name = typeof req.data?.name === 'string' ? req.data.name.trim().slice(0, 40) : '';
  if (invite.length < 2) throw new HttpsError('invalid-argument', 'Pick at least two people.');
  if (invite.length > MAX_PEOPLE - 1) throw new HttpsError('invalid-argument', `Groups can have up to ${MAX_PEOPLE} people.`);
  for (const u of invite) {
    if (!(await connected(db, me, u))) throw new HttpsError('permission-denied', 'You can only add people you’re connected with.');
  }

  const ref = db.doc(`groups/g-${db.collection('groups').doc().id}`);
  const myName = await firstName(me);
  const now = FieldValue.serverTimestamp();
  const intro = `${myName} started ${name ? `“${name}”` : 'the group'}`;
  await ref.set({
    name,
    createdBy: me,
    members: [me],
    invited: invite,
    createdAt: now,
    lastMessage: { text: intro, senderId: 'system', createdAt: now },
    lastRead: { [me]: now },
  });
  await ref.collection('messages').add({ text: intro, senderId: 'system', createdAt: now });

  const names = await Promise.all(invite.map(firstName));
  await Promise.all(
    invite.map((uid, i) =>
      notify(uid, {
        title: `${myName} added you to a group chat`,
        body: `${name ? `${name}: ` : ''}with ${listNames(names.filter((_, j) => j !== i).concat('you').slice(0, 4))}. Tap to join.`,
        data: { type: 'group', groupId: ref.id },
      }),
    ),
  );
  return { id: ref.id };
});

exports.respondToGroup = onCall(async (req) => {
  const { db, firstName, notify } = deps();
  const me = req.auth?.uid;
  if (!me) throw new HttpsError('unauthenticated', 'Sign in first.');
  const id = String(req.data?.groupId ?? '');
  const accept = req.data?.accept === true;
  if (!id.startsWith('g-')) throw new HttpsError('invalid-argument', 'Unknown group.');
  const ref = db.doc(`groups/${id}`);

  const others = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', 'This group no longer exists.');
    const g = snap.data();
    if (!g.invited?.includes(me)) throw new HttpsError('failed-precondition', 'This invite is no longer open.');
    tx.update(ref, {
      invited: FieldValue.arrayRemove(me),
      ...(accept ? { members: FieldValue.arrayUnion(me), [`lastRead.${me}`]: FieldValue.serverTimestamp() } : {}),
    });
    return (g.members ?? []).filter((m) => m !== me);
  });
  if (!accept) return { ok: true };

  const myName = await firstName(me);
  await systemLine(db, ref, `${myName} joined`);

  // Connect me with everyone already in the chat I wasn't connected with yet.
  for (const other of others) {
    if (await connected(db, me, other)) continue;
    if (await blockedEitherWay(db, me, other)) continue;
    const matchRef = db.doc(`matches/${pair(me, other)}`);
    const existing = await matchRef.get();
    if (existing.exists) continue; // closed or blocked connection: leave it alone
    const batch = db.batch();
    const now = FieldValue.serverTimestamp();
    // Likes both ways in the same write, so the "someone wants to collab" nudge doesn't fire.
    batch.set(db.doc(`users/${me}/likes/${other}`), { createdAt: now, viaGroup: id });
    batch.set(db.doc(`users/${other}/likes/${me}`), { createdAt: now, viaGroup: id });
    batch.set(matchRef, { members: [me, other].sort(), createdAt: now, viaGroup: id });
    await batch.commit();
  }

  const g = (await ref.get()).data();
  await Promise.all(
    others.map((uid) =>
      notify(uid, {
        title: g?.name || 'Group chat',
        body: `${myName} joined the chat`,
        data: { type: 'group', groupId: id },
      }),
    ),
  );
  return { ok: true };
});

exports.leaveGroup = onCall(async (req) => {
  const { db, firstName } = deps();
  const me = req.auth?.uid;
  if (!me) throw new HttpsError('unauthenticated', 'Sign in first.');
  const id = String(req.data?.groupId ?? '');
  if (!id.startsWith('g-')) throw new HttpsError('invalid-argument', 'Unknown group.');
  const ref = db.doc(`groups/${id}`);
  const snap = await ref.get();
  if (!snap.exists || !snap.get('members')?.includes(me)) return { ok: true };
  await ref.update({ members: FieldValue.arrayRemove(me) });
  await systemLine(db, ref, `${await firstName(me)} left`);
  return { ok: true };
});

exports.onGroupMessage = onDocumentCreated('groups/{groupId}/messages/{messageId}', async (event) => {
  const { db, firstName, notify, preview } = deps();
  const msg = event.data?.data();
  if (!msg || typeof msg.text !== 'string' || msg.senderId === 'system') return;
  const { groupId } = event.params;
  const snap = await db.doc(`groups/${groupId}`).get();
  if (!snap.exists) return;
  const g = snap.data();
  const sender = await firstName(msg.senderId);
  await Promise.all(
    (g.members ?? [])
      .filter((m) => m !== msg.senderId)
      .map((uid) =>
        notify(uid, {
          title: g.name || 'Group chat',
          body: `${sender}: ${preview(msg.text)}`,
          data: { type: 'group', groupId },
        }),
      ),
  );
});
