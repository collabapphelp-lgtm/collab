/**
 * Share pages: collab-609ac.web.app/s/{id}
 * When someone shares an event or their own profile from the app, the app saves a small snapshot in
 * `shares/{id}` (only what the page shows). This renders it as a web page anyone can open, with
 * link-preview tags for iMessage / Instagram / WhatsApp, "Open in Collab" (for people who have it)
 * and "Get Collab" (for people who don't). Reached through Hosting (firebase.json rewrite).
 */
const { onRequest } = require('firebase-functions/v2/https');
const { getFirestore } = require('firebase-admin/firestore');

const SITE = 'https://collab-609ac.web.app';
// Swap for the App Store link once Collab is live.
const GET_URL = `${SITE}/join?s=share`;

const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const httpsOnly = (u) => (/^https:\/\/[^\s"'<>]+$/.test(String(u ?? '')) ? String(u) : '');

function when(start, end) {
  const tz = { timeZone: 'America/New_York' };
  const day = new Date(start).toLocaleDateString('en-US', { ...tz, weekday: 'long', month: 'long', day: 'numeric' });
  const t = (ms) => new Date(ms).toLocaleTimeString('en-US', { ...tz, hour: 'numeric', minute: '2-digit' });
  return `${day} · ${t(start)}${end ? ` – ${t(end)}` : ''}`;
}

function page({ title, description, image, body, openUrl, openLabel }) {
  const img = httpsOnly(image) || `${SITE}/logo-mark.png`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · Collab</title>
<meta name="description" content="${esc(description)}">
<meta property="og:site_name" content="Collab">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${esc(img)}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/logo-mark.png">
<style>
:root{--bg:#121315;--card:#1B1D20;--text:#ECEDEE;--muted:#A3A9B3;--line:#2C2F34;--gold:#F2C14E}
@media (prefers-color-scheme:light){:root{--bg:#F3E9D8;--card:#fff;--text:#1F2328;--muted:#5B6270;--line:#E6E2DA}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:16px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
.wrap{max-width:480px;margin:0 auto;padding:28px 16px 40px}
.top{display:flex;align-items:center;gap:10px;margin-bottom:20px;color:var(--muted);font-size:14px}
.top img{width:44px;height:auto}
.card{background:var(--card);border:1px solid var(--line);border-radius:22px;overflow:hidden}
.flyer{display:block;width:100%;max-height:560px;object-fit:cover;background:#000}
.pad{padding:18px 18px 20px}
.kicker{font-size:12px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:var(--gold);margin:0 0 6px}
h1{font-size:28px;line-height:1.15;margin:0 0 10px}
.row{display:flex;gap:10px;margin:8px 0;color:var(--muted)}.row b{color:var(--text);font-weight:600}
.desc{margin:14px 0 0;white-space:pre-line}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}.chip{border:1px solid var(--line);border-radius:999px;padding:6px 12px;font-size:14px}
.person{display:flex;gap:16px;align-items:center}
.avatar{width:96px;height:96px;border-radius:24px;object-fit:cover;background:var(--line);flex:none}
a.btn{display:block;text-align:center;text-decoration:none;font-weight:700;border-radius:999px;padding:16px;margin-top:12px}
.primary{background:linear-gradient(135deg,#F5D76E,#E8B04B);color:#1F2328}
.secondary{border:1px solid var(--line);color:var(--text)}
.small{font-size:13px;color:var(--muted);text-align:center;margin-top:18px}.small a{color:var(--muted)}
</style></head><body><div class="wrap">
<div class="top"><img src="/logo-mark.png" alt=""><span>Shared from Collab</span></div>
${body}
${openUrl ? `<a class="btn primary" id="open" href="${esc(openUrl)}">${esc(openLabel)}</a>` : ''}
<a class="btn ${openUrl ? 'secondary' : 'primary'}" href="${esc(GET_URL)}">Get Collab, it's free</a>
<p class="small">Collab connects NYC musicians and creators who want to make something together.<br><a href="/privacy">Privacy</a> · <a href="/terms">Terms</a></p>
</div>
<script>
// No app? The collab:// link does nothing, so send them to Get Collab instead.
var o=document.getElementById('open');
if(o){o.addEventListener('click',function(){var t=setTimeout(function(){if(!document.hidden)location.href=${JSON.stringify(GET_URL)};},1600);
document.addEventListener('visibilitychange',function(){if(document.hidden)clearTimeout(t);});});}
</script></body></html>`;
}

function eventPage(s) {
  const flyer = httpsOnly(s.flyerURL);
  const place = [s.venue, s.neighborhood].filter(Boolean).join(' · ');
  const time = Number.isFinite(s.start) ? when(s.start, s.end) : '';
  const cal = Number.isFinite(s.start)
    ? `${SITE}/cal/event.ics?${new URLSearchParams({ t: s.title, s: String(s.start), e: String(s.end ?? ''), l: [s.venue, s.address].filter(Boolean).join(', ') })}`
    : '';
  const body = `<div class="card">${flyer ? `<img class="flyer" src="${esc(flyer)}" alt="Event flyer">` : ''}<div class="pad">
<p class="kicker">${esc(s.typeLabel || 'Event')}</p><h1>${esc(s.title)}</h1>
${time ? `<div class="row">🗓️ <b>${esc(time)}</b></div>` : ''}
${place ? `<div class="row">📍 <span><b>${esc(s.venue || '')}</b>${s.address ? `<br>${esc(s.address)}` : ''}</span></div>` : ''}
${s.cost ? `<div class="row">🎟️ <span>${esc(s.cost)}</span></div>` : ''}
${s.description ? `<p class="desc">${esc(s.description)}</p>` : ''}
${cal ? `<a class="btn secondary" href="${esc(cal)}">Add to calendar</a>` : ''}
</div></div>`;
  return page({
    title: s.title,
    description: [time, place].filter(Boolean).join(' · ') || 'An event on Collab',
    image: flyer,
    body,
    openUrl: `collab://event/${encodeURIComponent(s.key)}`,
    openLabel: 'See who’s going in Collab',
  });
}

function profilePage(s) {
  const photo = httpsOnly(s.photoURL);
  const chips = (s.tags ?? []).slice(0, 6).map((t) => `<span class="chip">${esc(t)}</span>`).join('');
  const body = `<div class="card"><div class="pad">
<div class="person">${photo ? `<img class="avatar" src="${esc(photo)}" alt="">` : ''}<div>
<p class="kicker">${esc(s.role || 'Creative')}</p><h1 style="margin:0">${esc(s.name)}</h1>
${s.place ? `<div class="row" style="margin:6px 0 0">📍 ${esc(s.place)}</div>` : ''}</div></div>
${s.lookingFor ? `<p class="desc"><b>Looking to collab with:</b> ${esc(s.lookingFor)}</p>` : ''}
${chips ? `<div class="chips">${chips}</div>` : ''}
</div></div>`;
  return page({
    title: `${s.name} on Collab`,
    description: [s.role, s.place].filter(Boolean).join(' · ') || 'A creative on Collab',
    image: photo,
    body,
    openUrl: `collab://user/${encodeURIComponent(s.uid)}`,
    openLabel: `Collab with ${s.name}`,
  });
}

function notFound(res) {
  res.status(404).send(
    page({ title: 'Link not found', description: 'This Collab link has expired.', body: '<div class="card"><div class="pad"><h1>This link has expired</h1><p class="desc">The event may have ended, or the person stopped sharing their profile.</p></div></div>' }),
  );
}

exports.sharePage = onRequest({ maxInstances: 5, memory: '256MiB', invoker: 'public' }, async (req, res) => {
  const id = (req.path.split('/').filter(Boolean)[1] || '').slice(0, 40);
  res.set('Cache-Control', 'public, max-age=300, s-maxage=300');
  if (!/^[a-z0-9]{4,40}$/.test(id)) return notFound(res);
  const db = getFirestore();
  const snap = await db.doc(`shares/${id}`).get();
  if (!snap.exists) return notFound(res);
  const s = snap.data();
  if (s.kind === 'event') {
    // Posted events: use the live listing (and hide it if it was taken down).
    if (s.source === 'posted' && s.eventId) {
      const ev = await db.doc(`events/${s.eventId}`).get();
      if (!ev.exists || ev.data().status !== 'approved') return notFound(res);
      const e = ev.data();
      Object.assign(s, { title: e.title, venue: e.venue, address: e.address, description: e.description, cost: e.cost, flyerURL: e.flyerURL });
    }
    if (Number.isFinite(s.end ?? s.start) && (s.end ?? s.start + 4 * 3600e3) < Date.now() - 24 * 3600e3) return notFound(res);
    return res.send(eventPage(s));
  }
  if (s.kind === 'profile') {
    const u = await db.doc(`users/${s.uid}`).get();
    if (!u.exists) return notFound(res);
    return res.send(profilePage(s));
  }
  return notFound(res);
});
exports._pages = { eventPage, profilePage }; // for local previews
