/**
 * Tester dashboard numbers (hosting/public/admin.html calls this).
 *
 * Only the Collab accounts listed in ADMIN_UIDS can call it. Firebase asks for that value
 * the first time you deploy; it's your user ID from Firebase console → Authentication.
 *
 * Internal accounts (admins, and collabapphelp+anything@gmail.com such as the App Review
 * account) are left out of the numbers so they reflect real testers.
 */
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

const { adminUids } = require('./params');

const STEPS = [
  ['location', 'Location'],
  ['type', 'I am a…'],
  ['looking', 'Looking for'],
  ['taste', 'Your sound'],
  ['showcase', 'Showcase + collab partner'],
];

const ms = (t) => (t && typeof t.toMillis === 'function' ? t.toMillis() : null);
const dayKey = (millis) => {
  const d = new Date(millis - 5 * 3600_000); // US Eastern (close enough for daily buckets)
  return d.toISOString().slice(0, 10);
};
const lastNDays = (n) => {
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(dayKey(Date.now() - i * 86400_000));
  return out;
};
const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

exports.metrics = onCall({ maxInstances: 2, memory: '256MiB' }, async (request) => {
  const admins = adminUids();
  if (!request.auth || !admins.includes(request.auth.uid)) {
    throw new HttpsError('permission-denied', 'This dashboard is only for the Collab team.');
  }

  const db = getFirestore();
  const [usersSnap, activitySnap, likesSnap, passesSnap, matchesSnap, messagesSnap] = await Promise.all([
    db.collection('users').get(),
    db.collection('activity').get(),
    db.collectionGroup('likes').get(),
    db.collectionGroup('passes').get(),
    db.collection('matches').get(),
    db.collectionGroup('messages').get(),
  ]);
  const reportsSnap = await db.collection('reports').orderBy('createdAt', 'desc').limit(50).get();

  // Who's internal: admins + any collabapphelp(+tag)@gmail.com login.
  const internal = new Set(admins);
  let pageToken;
  do {
    const page = await getAuth().listUsers(1000, pageToken);
    for (const u of page.users) if (/^collabapphelp(\+[^@]*)?@gmail\.com$/i.test(u.email ?? '')) internal.add(u.uid);
    pageToken = page.pageToken;
  } while (pageToken);

  const activity = new Map(activitySnap.docs.map((d) => [d.id, d.data()]));
  const users = usersSnap.docs.filter((d) => !internal.has(d.id)).map((d) => ({ id: d.id, ...d.data() }));
  const real = new Set(users.map((u) => u.id));
  const ownerOf = (doc) => doc.ref.parent.parent?.id; // users/{uid}/likes/{them} → uid

  // Swipes
  const likesBy = new Map();
  const passesBy = new Map();
  for (const d of likesSnap.docs) if (real.has(ownerOf(d))) likesBy.set(ownerOf(d), (likesBy.get(ownerOf(d)) ?? 0) + 1);
  for (const d of passesSnap.docs) if (real.has(ownerOf(d))) passesBy.set(ownerOf(d), (passesBy.get(ownerOf(d)) ?? 0) + 1);

  // Matches & messages (count a match if at least one member is a real tester)
  const msgsByMatch = new Map();
  for (const d of messagesSnap.docs) {
    const id = d.ref.parent.parent?.id;
    if (!id) continue;
    const m = d.data();
    const list = msgsByMatch.get(id) ?? [];
    list.push({ senderId: m.senderId, at: ms(m.createdAt) });
    msgsByMatch.set(id, list);
  }
  const matches = matchesSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((m) => Array.isArray(m.members) && m.members.some((u) => real.has(u)));
  const matchesBy = new Map();
  const sentBy = new Map();
  let withMessages = 0;
  let withReplies = 0;
  const firstMsgDelays = [];
  const convoLengths = [];
  for (const m of matches) {
    for (const u of m.members) if (real.has(u)) matchesBy.set(u, (matchesBy.get(u) ?? 0) + 1);
    const msgs = (msgsByMatch.get(m.id) ?? []).sort((a, b) => (a.at ?? 0) - (b.at ?? 0));
    for (const x of msgs) if (real.has(x.senderId)) sentBy.set(x.senderId, (sentBy.get(x.senderId) ?? 0) + 1);
    if (msgs.length) {
      withMessages++;
      convoLengths.push(msgs.length);
      if (new Set(msgs.map((x) => x.senderId)).size >= 2) withReplies++;
      const created = ms(m.createdAt);
      if (created && msgs[0].at) firstMsgDelays.push((msgs[0].at - created) / 3600_000);
    }
  }

  // Setup funnel: a step counts as reached if the app recorded it, or the profile already has
  // that step's answer (covers people who signed up before tracking existed).
  const answered = {
    location: (u) => !!u.location,
    type: (u) => !!u.creatorType,
    looking: (u) => (u.lookingFor?.length ?? 0) > 0,
    taste: (u) => (u.genres?.length ?? 0) + (u.interests?.length ?? 0) > 0 || !!u.openToAll,
    showcase: (u) => (u.showcase?.length ?? 0) > 0,
  };
  const reached = (u, i) => {
    if (i === 0) return true; // everyone who signs up lands on Location
    const step = STEPS[i][0];
    const a = activity.get(u.id);
    return (a?.stepsReached ?? []).includes(step) || u.onboardingComplete || STEPS.slice(i).some(([s]) => answered[s](u));
  };
  const funnel = [
    { label: 'Signed up', n: users.length },
    ...STEPS.map(([step, label], i) => ({
      label: `Reached ${label}`,
      n: users.filter((u) => reached(u, i)).length,
      skipped: users.filter((u) => (activity.get(u.id)?.skipped ?? []).includes(step)).length,
    })),
    { label: 'Finished setup', n: users.filter((u) => u.onboardingComplete).length },
  ];

  // Return visits
  const daysOf = (u) => activity.get(u.id)?.days ?? [];
  const recent = lastNDays(14);
  const dailyActive = recent.map((day) => ({ day, n: users.filter((u) => daysOf(u).includes(day)).length }));
  const signupsByDay = recent.map((day) => ({ day, n: users.filter((u) => ms(u.createdAt) && dayKey(ms(u.createdAt)) === day).length }));
  const week = new Set(lastNDays(7));

  const swipers = users.filter((u) => (likesBy.get(u.id) ?? 0) + (passesBy.get(u.id) ?? 0) > 0);
  const totalLikes = [...likesBy.values()].reduce((a, b) => a + b, 0);
  const totalPasses = [...passesBy.values()].reduce((a, b) => a + b, 0);
  const finished = users.filter((u) => u.onboardingComplete);

  // Reports, newest first, with names so you can act on them.
  const nameOf = new Map(usersSnap.docs.map((d) => [d.id, [d.data().firstName, (d.data().lastName ?? '').slice(0, 1)].filter(Boolean).join(' ')]));
  const reports = reportsSnap.docs.map((d) => {
    const r = d.data();
    return {
      at: ms(r.createdAt),
      reason: r.reason,
      details: r.details ?? null,
      reporter: nameOf.get(r.reporterId) ?? '(deleted account)',
      reported: nameOf.get(r.reportedId) ?? '(deleted account)',
      reportedId: r.reportedId,
    };
  });

  return {
    generatedAt: Date.now(),
    reports,
    internalExcluded: internal.size,
    totals: {
      testers: users.length,
      finishedSetup: finished.length,
      activeLast7Days: users.filter((u) => daysOf(u).some((d) => week.has(d))).length,
      cameBackAnotherDay: users.filter((u) => new Set(daysOf(u)).size >= 2).length,
    },
    funnel,
    profiles: {
      withPhoto: finished.filter((u) => !!u.photoURL).length,
      withShowcase: finished.filter((u) => (u.showcase?.length ?? 0) > 0).length,
      withBio: finished.filter((u) => !!u.bio).length,
      avgShowcaseItems: finished.length ? finished.reduce((a, u) => a + (u.showcase?.length ?? 0), 0) / finished.length : 0,
    },
    discover: {
      swipers: swipers.length,
      likes: totalLikes,
      passes: totalPasses,
      likeRate: totalLikes + totalPasses ? totalLikes / (totalLikes + totalPasses) : null,
      medianSwipesPerSwiper: median(swipers.map((u) => (likesBy.get(u.id) ?? 0) + (passesBy.get(u.id) ?? 0))),
    },
    connections: {
      matches: matches.length,
      testersWithAMatch: users.filter((u) => matchesBy.has(u.id)).length,
      conversationsStarted: withMessages,
      conversationsWithReplies: withReplies,
      medianMessagesPerConversation: median(convoLengths),
      medianHoursToFirstMessage: median(firstMsgDelays),
    },
    dailyActive,
    signupsByDay,
    people: users
      .map((u) => ({
        name: [u.firstName, (u.lastName ?? '').slice(0, 1)].filter(Boolean).join(' '),
        role: u.creatorType ?? null,
        joined: ms(u.createdAt),
        finished: !!u.onboardingComplete,
        showcase: u.showcase?.length ?? 0,
        likes: likesBy.get(u.id) ?? 0,
        passes: passesBy.get(u.id) ?? 0,
        matches: matchesBy.get(u.id) ?? 0,
        sent: sentBy.get(u.id) ?? 0,
        daysActive: new Set(daysOf(u)).size,
        lastActive: daysOf(u).sort().at(-1) ?? null,
      }))
      .sort((a, b) => (b.joined ?? 0) - (a.joined ?? 0)),
  };
});
