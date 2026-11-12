/**
 * Public endpoints behind the Join page (collab-609ac.web.app/join), reached through Hosting at /api/*.
 *   POST /api/visit     { s, platform }  → counts a page view per source (sticker, link…) and platform
 *   POST /api/waitlist  { email, s }     → Android waitlist sign-up
 * No login needed; inputs are validated and capped. Read on the dashboard.
 */
const { onRequest } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const clean = (v, max = 24) =>
  String(v ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, max) || 'direct';
const PLATFORMS = new Set(['ios', 'android', 'other']);

exports.joinApi = onRequest({ maxInstances: 3, memory: '256MiB', invoker: 'public' }, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const db = getFirestore();
  const body = typeof req.body === 'object' && req.body ? req.body : {};
  const source = clean(body.s);

  if (req.path.endsWith('/visit')) {
    const platform = PLATFORMS.has(body.platform) ? body.platform : 'other';
    await db.doc(`joinStats/${source}`).set(
      { visits: FieldValue.increment(1), [platform]: FieldValue.increment(1), lastAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
    return res.json({ ok: true });
  }

  if (req.path.endsWith('/waitlist')) {
    const email = String(body.email ?? '').trim().toLowerCase();
    if (email.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email.' });
    }
    // Email is the doc id, so signing up twice doesn't duplicate.
    const id = email.replace(/\//g, '_');
    await db.doc(`waitlist/${id}`).set(
      { email, platform: 'android', source, createdAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
    return res.json({ ok: true });
  }

  return res.status(404).json({ error: 'Not found' });
});
