// Kasba result watcher: a Cloudflare Worker that wakes every 30 minutes (6 am to 11:30 pm
// India time), looks at the notice boards of exam bodies, and starts the news pipeline the
// moment a new result, admit card, answer key or last-date notice appears, so Kasba is early
// on the stories readers search for most. It only starts a run; drafting, checks and
// publishing stay in the pipeline. Free plan: Workers cron + KV (writes only when a page changes).
//
// Secrets (set by .github/workflows/watcher.yml): GITHUB_TOKEN (Actions: write on the repo).
// GET /status shows the last check of every board; GET /links/<id> the notices last seen there;
// GET /page/<id> fetches that board's page now, so the pipeline (on GitHub's servers, which some
// boards refuse) can read boards that answer Cloudflare.

const BOARDS = [
  // Already Kasba sources: a new item here becomes a story in the run this starts.
  { id: 'up-board', url: 'https://upmsp.edu.in/' },
  // NTA and CBSE refuse Cloudflare (530, 403 on 2 Nov 2026); the pipeline's own runs cover them.
  { id: 'nta', url: 'https://nta.ac.in/NoticeBoardArchive', probeOnly: true },
  { id: 'cbse', url: 'https://www.cbse.gov.in/cbsenew/cbse.html', probeOnly: true },
  // Not sources yet (they refuse GitHub's servers); watched to learn whether Cloudflare reaches them.
  { id: 'ssc', url: 'https://ssc.gov.in/', probeOnly: true },
  { id: 'upsssc', url: 'https://upsssc.gov.in/', probeOnly: true },
  { id: 'uppsc', url: 'https://uppsc.up.nic.in/', probeOnly: true },
  { id: 'ibps', url: 'https://www.ibps.in/', probeOnly: true },
  { id: 'bpsc', url: 'https://bpsc.bihar.gov.in/', probeOnly: true },
  { id: 'mppsc', url: 'https://mppsc.mp.gov.in/', probeOnly: true },
  { id: 'rrb-cdg', url: 'https://www.rrbcdg.gov.in/', probeOnly: true },
  { id: 'dsssb', url: 'https://dsssb.delhi.gov.in/', probeOnly: true },
];

// Words that mark a notice readers rush to.
const URGENT = /result|admit|hall ?ticket|answer ?key|merit|cut ?off|last date|extension|परिणाम|रिजल्ट|प्रवेश ?पत्र|उत्तर ?कुंजी|अंतिम ?तिथि|मेरिट/i;

const REPO = 'rupeshyadav08/kasba';

// The links on a page, as a reader would see the list of notices: text plus full address.
function links(html, base) {
  const out = new Map();
  for (const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const text = m[2].replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    if (text.length < 12 || text.length > 300 || out.has(text)) continue;
    const href = m[1].match(/href\s*=\s*["']([^"']+)["']/i)?.[1];
    let url = '';
    try { url = href ? new URL(href.trim(), base).toString() : ''; } catch {}
    out.set(text, url);
  }
  return [...out].map(([t, h]) => ({ t, h }));
}

const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; KasbaWatcher/1.0; +https://kasba.co.in/about)', From: 'admin@kasba.co.in' };

async function checkBoard(board, env) {
  const seenKey = `seen:${board.id}`;
  const status = { id: board.id, at: new Date().toISOString() };
  try {
    const res = await fetch(board.url, {
      headers: UA,
      cf: { cacheTtl: 0 },
      signal: AbortSignal.timeout(20000),
    });
    status.http = res.status;
    if (!res.ok) return status;
    const now = links(await res.text(), board.url);
    status.links = now.length;
    const before = JSON.parse((await env.WATCH.get(seenKey)) ?? 'null');
    // Older entries were plain strings; newer ones are {t, h}.
    const seen = new Set((before ?? []).map((x) => (typeof x === 'string' ? x : x.t)));
    const fresh = before ? now.filter((x) => !seen.has(x.t)).map((x) => x.t) : [];
    status.fresh = fresh.slice(0, 5);
    status.urgent = fresh.filter((t) => URGENT.test(t)).slice(0, 5);
    // Write only when the page changed, to stay far inside KV's free daily writes.
    if (!before || fresh.length) await env.WATCH.put(seenKey, JSON.stringify(now.slice(0, 400)));
  } catch (e) {
    status.error = String(e.message ?? e).slice(0, 120);
  }
  return status;
}

async function run(env) {
  const results = await Promise.all(BOARDS.map((b) => checkBoard(b, env)));
  const trigger = results.filter((r, i) => !BOARDS[i].probeOnly && r.urgent?.length);
  if (trigger.length) {
    const res = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/pipeline.yml/dispatches`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json',
        'User-Agent': 'kasba-watcher', 'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ref: 'main', inputs: { urgent: true } }),
    });
    console.log('dispatch', res.status, trigger.map((t) => `${t.id}: ${t.urgent[0]}`).join(' | '));
  }
  await env.WATCH.put('status', JSON.stringify({ at: new Date().toISOString(), triggered: trigger.map((t) => t.id), results }));
}

export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(run(env));
  },
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    const json = { headers: { 'Content-Type': 'application/json; charset=utf-8' } };
    if (path === '/status') return new Response((await env.WATCH.get('status')) ?? '{}', json);
    const [, kind, id] = path.split('/');
    const board = BOARDS.find((b) => b.id === id);
    if (kind === 'links' && board) return new Response((await env.WATCH.get(`seen:${id}`)) ?? '[]', json);
    // Only the boards listed above, so this never becomes an open proxy.
    if (kind === 'page' && board) {
      const res = await fetch(board.url, { headers: UA, signal: AbortSignal.timeout(25000) });
      return new Response(res.body, { status: res.status, headers: { 'Content-Type': res.headers.get('Content-Type') ?? 'text/html' } });
    }
    return new Response('Kasba result watcher', { status: 200 });
  },
};
