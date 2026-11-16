/**
 * "Add to calendar" for Events: GET /cal/event.ics?t=Title&s=startMs&e=endMs&l=Location&d=Notes&u=Link
 * Returns a one-event .ics file. iPhone opens it in Safari with an "Add to Calendar" prompt; Android and
 * desktop open it in their calendar app. Everything comes from the query string (curated events live in
 * the app, not the database), so nothing is stored. Reached through Hosting at collab-609ac.web.app/cal/*.
 */
const { onRequest } = require('firebase-functions/v2/https');

const text = (v, max) => String(v ?? '').slice(0, max);
// RFC 5545 text escaping, then fold long lines at 74 chars.
const esc = (v) => v.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const fold = (line) => line.match(/.{1,74}/g).join('\r\n ');
const stamp = (ms) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

exports.calendarFile = onRequest({ maxInstances: 3, memory: '256MiB', invoker: 'public' }, (req, res) => {
  const start = Number(req.query.s);
  if (!Number.isFinite(start) || start < 1.6e12 || start > 2.2e12) return res.status(400).send('Missing start time');
  let end = Number(req.query.e);
  if (!Number.isFinite(end) || end <= start || end - start > 24 * 3600e3) end = start + 3 * 3600e3;
  const title = text(req.query.t, 120) || 'Collab event';
  const location = text(req.query.l, 200);
  const link = text(req.query.u, 300);
  const notes = [text(req.query.d, 1000), link, 'Found on Collab'].filter(Boolean).join('\n\n');
  const uid = `${start}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}@collab-609ac.web.app`;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Collab//Events//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${stamp(Date.now())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(title)}`,
    location ? `LOCATION:${esc(location)}` : null,
    `DESCRIPTION:${esc(notes)}`,
    /^https?:\/\//.test(link) ? `URL:${link}` : null,
    'BEGIN:VALARM',
    'TRIGGER:-PT2H',
    'ACTION:DISPLAY',
    `DESCRIPTION:${esc(title)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);

  res.set('Content-Type', 'text/calendar; charset=utf-8');
  res.set('Content-Disposition', 'inline; filename="collab-event.ics"');
  res.set('Cache-Control', 'public, max-age=300');
  res.send(lines.map(fold).join('\r\n') + '\r\n');
});
