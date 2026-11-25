// Browser notifications for kasba.co.in (Web Push), run by the result watcher Worker.
//
// How it works, with no new secrets and no paid services:
// - The Worker makes its own VAPID key pair on first use and keeps it in KV; the private key
//   never leaves Cloudflare. GET /push/key gives the site the public key.
// - A reader taps "अलर्ट चालू करें" on the site; the browser subscribes and the site sends the
//   subscription's endpoint to POST /push/subscribe. Only the endpoint is kept (KV metadata).
// - The site's build writes /push.json with one "alert": the newest story worth a notification
//   (jobs, results, schemes, weather, a last date). Every 30 minutes the Worker reads it, and if
//   that story was not sent yet, it sends an empty push to every subscriber. The browser's
//   service worker (public/sw.js) then reads /push.json itself and shows the headline. Empty
//   pushes need no payload encryption, only the VAPID signature.
// - At most MAX_PER_DAY alerts a day. Subscriptions the push service says are gone are deleted.
// - Free plan: one invocation may make 50 outside requests, so subscribers are sent in batches of
//   BATCH, each batch in its own invocation through the SELF service binding.

const SITE = 'https://kasba.co.in';
const ORIGINS = [SITE, 'https://www.kasba.co.in', 'https://kasba.pages.dev'];
const BATCH = 40;
const MAX_PER_DAY = 5;

const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const text = (s) => new TextEncoder().encode(s);
const hash = async (s) => b64url(await crypto.subtle.digest('SHA-256', text(s))).slice(0, 32);

export function cors(request) {
  const origin = request.headers.get('Origin') ?? '';
  const ok = ORIGINS.includes(origin) || /^https:\/\/[a-z0-9-]+\.kasba\.pages\.dev$/.test(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin : SITE,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
}

// The VAPID key pair and an internal token for batch calls, made once and kept in KV.
async function keys(env) {
  const saved = await env.WATCH.get('push:vapid', 'json');
  if (saved) return saved;
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const made = {
    privateJwk: await crypto.subtle.exportKey('jwk', pair.privateKey),
    publicKey: b64url(await crypto.subtle.exportKey('raw', pair.publicKey)),
    token: b64url(crypto.getRandomValues(new Uint8Array(24))),
  };
  await env.WATCH.put('push:vapid', JSON.stringify(made));
  return made;
}

// VAPID (RFC 8292): a short-lived ES256 token for the push service of this endpoint.
async function vapidHeader(k, endpoint) {
  const key = await crypto.subtle.importKey('jwk', k.privateJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const head = b64url(text(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const body = b64url(text(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: 'mailto:admin@kasba.co.in' })));
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, text(`${head}.${body}`));
  return `vapid t=${head}.${body}.${b64url(sig)}, k=${k.publicKey}`;
}

// Push services browsers use. Anything else is refused, so the Worker never calls random hosts.
const PUSH_HOSTS = /(^|\.)(fcm\.googleapis\.com|googleapis\.com|push\.services\.mozilla\.com|notify\.windows\.com|push\.apple\.com)$/;

async function send(env, k, batch) {
  let sent = 0, gone = 0;
  await Promise.all(batch.map(async ({ name, metadata }) => {
    try {
      const res = await fetch(metadata.e, {
        method: 'POST',
        headers: { Authorization: await vapidHeader(k, metadata.e), TTL: '43200', Urgency: 'normal', 'Content-Length': '0' },
      });
      if (res.status === 404 || res.status === 410) { await env.WATCH.delete(name); gone++; } else if (res.ok) sent++;
    } catch {}
  }));
  return { sent, gone };
}

// One batch of subscribers, from a KV list cursor. Returns the next cursor, if any.
async function sendBatch(env, k, cursor) {
  const page = await env.WATCH.list({ prefix: 'sub:', limit: BATCH, cursor });
  const r = await send(env, k, page.keys.filter((x) => x.metadata?.e));
  return { ...r, cursor: page.list_complete ? null : page.cursor };
}

// Cron: send the site's current alert if it is new and today's limit is not reached.
export async function pushRun(env) {
  const res = await fetch(`${SITE}/push.json`, { cf: { cacheTtl: 0 } }).catch(() => null);
  if (!res?.ok) return;
  const { alert } = await res.json();
  if (!alert?.id) return;
  const state = (await env.WATCH.get('push:state', 'json')) ?? { last: null, day: '', count: 0, log: [] };
  if (state.last === alert.id) return;
  const day = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
  if (state.day !== day) { state.day = day; state.count = 0; }
  if (state.count >= MAX_PER_DAY) return;
  const k = await keys(env);
  let { sent, gone, cursor } = await sendBatch(env, k, undefined);
  // Further batches each run in their own invocation (own limit of outside requests).
  let batches = 1;
  while (cursor && env.SELF && batches < 45) {
    const r = await env.SELF.fetch('https://self/push/batch', { method: 'POST', body: JSON.stringify({ token: k.token, cursor }) });
    const out = await r.json().catch(() => ({}));
    sent += out.sent ?? 0; gone += out.gone ?? 0; cursor = out.cursor; batches++;
  }
  state.last = alert.id;
  state.count++;
  state.log = [{ at: new Date().toISOString(), id: alert.id, sent, gone }, ...(state.log ?? [])].slice(0, 30);
  await env.WATCH.put('push:state', JSON.stringify(state));
}

// HTTP routes under /push. Returns a Response, or null if the path is not a push route.
export async function pushFetch(request, env) {
  const path = new URL(request.url).pathname;
  if (!path.startsWith('/push/')) return null;
  const h = { ...cors(request), 'Content-Type': 'application/json; charset=utf-8' };
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
  if (path === '/push/key') return new Response(JSON.stringify({ key: (await keys(env)).publicKey }), { headers: { ...h, 'Cache-Control': 'public, max-age=3600' } });
  if (path === '/push/status') {
    const state = (await env.WATCH.get('push:state', 'json')) ?? {};
    let count = 0, cursor;
    do { const p = await env.WATCH.list({ prefix: 'sub:', cursor }); count += p.keys.length; cursor = p.list_complete ? null : p.cursor; } while (cursor);
    return new Response(JSON.stringify({ subscribers: count, ...state }), { headers: h });
  }
  if (request.method !== 'POST') return new Response('{"error":"POST only"}', { status: 405, headers: h });
  const body = await request.json().catch(() => ({}));
  if (path === '/push/batch') {
    const k = await keys(env);
    if (body.token !== k.token) return new Response('{"error":"no"}', { status: 403, headers: h });
    return new Response(JSON.stringify(await sendBatch(env, k, body.cursor)), { headers: h });
  }
  let endpoint;
  try { endpoint = new URL(body.endpoint); } catch {}
  if (!endpoint || endpoint.protocol !== 'https:' || !PUSH_HOSTS.test(endpoint.hostname) || body.endpoint.length > 900) {
    return new Response('{"error":"bad endpoint"}', { status: 400, headers: h });
  }
  const name = `sub:${await hash(body.endpoint)}`;
  if (path === '/push/subscribe') {
    await env.WATCH.put(name, '', { metadata: { e: body.endpoint, at: new Date().toISOString().slice(0, 10) } });
    return new Response('{"ok":true}', { headers: h });
  }
  if (path === '/push/unsubscribe') {
    await env.WATCH.delete(name);
    return new Response('{"ok":true}', { headers: h });
  }
  return new Response('{"error":"not found"}', { status: 404, headers: h });
}
