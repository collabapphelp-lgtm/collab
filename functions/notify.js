/** Push notification helpers shared by the functions. */
const { logger } = require('firebase-functions/v2');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const db = () => getFirestore();

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

async function tokensFor(uid) {
  const snap = await db().doc(`pushTokens/${uid}`).get();
  const tokens = snap.exists ? snap.get('tokens') : [];
  return Array.isArray(tokens) ? tokens.filter((t) => typeof t === 'string' && t.startsWith('ExponentPushToken')) : [];
}

async function firstName(uid) {
  const snap = await db().doc(`users/${uid}`).get();
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
  if (dead.length) await db().doc(`pushTokens/${uid}`).update({ tokens: FieldValue.arrayRemove(...dead) });

  const errors = tickets.filter((t) => t.status === 'error');
  if (errors.length) logger.warn('Some notifications were not accepted', { uid, errors });
}

const preview = (text) => (text.length > 120 ? `${text.slice(0, 117)}…` : text);


module.exports = { tokensFor, firstName, notify, preview };
