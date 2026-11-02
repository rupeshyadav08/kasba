// Kasba result watcher: a Cloudflare Worker that wakes every 30 minutes (6 am to 11:30 pm
// India time), looks at the notice boards of exam bodies, and starts the news pipeline the
// moment a new result, admit card, answer key or last-date notice appears, so Kasba is early
// on the stories readers search for most. It only starts a run; drafting, checks and
// publishing stay in the pipeline. Free plan: Workers cron + KV (writes only when a page changes).
//
// Secrets (set by .github/workflows/watcher.yml): GITHUB_TOKEN (Actions: write on the repo).
// GET /status shows the last check of every board.

const BOARDS = [
  // Already Kasba sources: a new item here becomes a story in the run this starts.
  { id: 'nta', url: 'https://nta.ac.in/NoticeBoardArchive' },
  { id: 'cbse', url: 'https://www.cbse.gov.in/cbsenew/cbse.html' },
  { id: 'up-board', url: 'https://upmsp.edu.in/' },
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

// The link texts on a page: what a reader would see as the list of notices.
function links(html) {
  const out = new Set();
  for (const m of html.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)) {
    const text = m[1].replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    if (text.length >= 12 && text.length <= 300) out.add(text);
  }
  return [...out];
}

async function checkBoard(board, env) {
  const seenKey = `seen:${board.id}`;
  const status = { id: board.id, at: new Date().toISOString() };
  try {
    const res = await fetch(board.url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KasbaWatcher/1.0; +https://kasba.co.in/about)', From: 'admin@kasba.co.in' },
      cf: { cacheTtl: 0 },
      signal: AbortSignal.timeout(20000),
    });
    status.http = res.status;
    if (!res.ok) return status;
    const now = links(await res.text());
    status.links = now.length;
    const before = JSON.parse((await env.WATCH.get(seenKey)) ?? 'null');
    const fresh = before ? now.filter((t) => !before.includes(t)) : [];
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
    if (new URL(request.url).pathname === '/status') {
      return new Response((await env.WATCH.get('status')) ?? '{}', { headers: { 'Content-Type': 'application/json' } });
    }
    return new Response('Kasba result watcher', { status: 200 });
  },
};
