// Kasba result watcher: a Cloudflare Worker that wakes every 30 minutes (6 am to 11:30 pm
// India time), looks at the notice boards of exam bodies, and starts the news pipeline the
// moment a new result, admit card, answer key or last-date notice appears, so Kasba is early
// on the stories readers search for most. It only starts a run; drafting, checks and
// publishing stay in the pipeline. Free plan: Workers cron + KV (writes only when a page changes).
//
// Secrets (set by .github/workflows/watcher.yml): GITHUB_TOKEN (Actions: write on the repo).
// GET /status shows the last check of every board; GET /links/<id> the notices last seen there;
// GET /page/<id> fetches that board's page now. GET /feed/<id> is an RSS feed of a board's latest
// notices (SSC from its data feed, UPPSC from its advertisement table) and GET /file/<id>?u=<url>
// fetches one notice from that board, so the pipeline (on GitHub's servers, which these boards
// refuse) can turn them into stories. Only listed boards' own addresses are ever fetched.

const BOARDS = [
  // Already Kasba sources: a new item here becomes a story in the run this starts.
  { id: 'up-board', url: 'https://upmsp.edu.in/' },
  // NTA and CBSE refuse Cloudflare (530, 403 on 2 Nov 2026); the pipeline's own runs cover them.
  { id: 'nta', url: 'https://nta.ac.in/NoticeBoardArchive', probeOnly: true },
  { id: 'cbse', url: 'https://www.cbse.gov.in/cbsenew/cbse.html', probeOnly: true },
  // Not sources yet (they refuse GitHub's servers); watched to learn whether Cloudflare reaches them.
  // Sources through /feed: their notices are read from the feed, not the page's links.
  { id: 'ssc', url: 'https://ssc.gov.in/', feed: true },
  { id: 'uppsc', url: 'https://uppsc.up.nic.in/', feed: true },
  // Not sources (they refuse GitHub's servers and Cloudflare); watched to see if that changes.
  { id: 'upsssc', url: 'https://upsssc.gov.in/', probeOnly: true },
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

const strip = (h) => h.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const DAY = 86400e3;

// SSC's site is an app that loads its notices from a JSON API; notices and results are two lists.
async function sscFeed() {
  const api = 'https://ssc.gov.in/api/general-website/portal';
  const q = 'page=1&limit=15&key=createdAt&order=DESC&isPaginationRequired=false&isAttachment=true&language=english'
    + '&attributes=id,headline,examId,contentType,startDate,endDate,language,createdAt';
  const items = [];
  for (const [path, type] of [['notice-boards', 'notice-boards'], ['records', 'results']]) {
    const res = await fetch(`${api}/${path}?${q}&contentType=${type}`, { headers: { ...UA, Accept: 'application/json' }, signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`SSC ${type}: ${res.status}`);
    for (const n of (await res.json()).data ?? []) {
      const file = n.attachments?.[0]?.path;
      if (!n.headline || !file) continue;
      items.push({
        title: strip(n.headline).slice(0, 300),
        link: `https://ssc.gov.in/api/attachment/${file.replace(/\\/g, '/').replace(/^\/+/, '')}`,
        date: n.createdAt ? new Date(n.createdAt) : null,
      });
    }
  }
  return items.sort((a, b) => (b.date ?? 0) - (a.date ?? 0));
}

// UPPSC lists open recruitments in a server-made table; each advertisement has its own ID.
async function uppscFeed() {
  const url = 'https://uppsc.up.nic.in/CandidatePages/Notifications.aspx';
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`UPPSC: ${res.status}`);
  const html = await res.text();
  const items = new Map();
  for (const [row] of html.matchAll(/<tr[\s>][\s\S]*?<\/tr>/gi)) {
    const href = row.match(/href\s*=\s*["']([^"']*View_Advertisement\.aspx\?ID=(\d+)[^"']*)["']/i);
    if (!href || items.has(href[2])) continue;
    const cells = [...row.matchAll(/<td[\s\S]*?<\/td>/gi)].map(([c]) => strip(c)).filter(Boolean);
    const d = row.match(/(\d{2})\/(\d{2})\/(20\d{2})/);
    items.set(href[2], {
      title: `UPPSC: ${cells.join(' | ')}`.slice(0, 300),
      link: new URL(href[1].replace(/&amp;/g, '&'), url).toString(),
      date: d ? new Date(`${d[3]}-${d[2]}-${d[1]}T00:00:00+05:30`) : null,
    });
  }
  return [...items.values()];
}

const FEEDS = { ssc: sscFeed, uppsc: uppscFeed };

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Only fresh notices go out, so a new source does not hand the pipeline its whole archive.
function rss(id, items) {
  const fresh = items.filter((i) => !i.date || Date.now() - i.date < 14 * DAY).slice(0, 20);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>${id}</title>\n${fresh.map((i) =>
    `<item><title>${esc(i.title)}</title><link>${esc(i.link)}</link>${i.date ? `<pubDate>${i.date.toUTCString()}</pubDate>` : ''}</item>`).join('\n')}\n</channel></rss>`;
}

// Kasba respects robots.txt, here as in the pipeline.
async function robotsAllow(url) {
  const { origin, pathname } = new URL(url);
  try {
    const res = await fetch(`${origin}/robots.txt`, { headers: UA, signal: AbortSignal.timeout(10000) });
    if (!res.ok) return true;
    let applies = false;
    for (const line of (await res.text()).split(/\r?\n/)) {
      const [k, ...rest] = line.split(':');
      const key = k.trim().toLowerCase();
      const val = rest.join(':').trim();
      if (key === 'user-agent') applies = val === '*' || /kasba/i.test(val);
      else if (applies && key === 'disallow' && val && pathname.startsWith(val.replace(/\*.*$/, ''))) return false;
    }
  } catch {}
  return true;
}

async function checkBoard(board, env) {
  const seenKey = `seen:${board.id}`;
  const status = { id: board.id, at: new Date().toISOString() };
  try {
    let now;
    if (board.feed) {
      now = (await FEEDS[board.id]()).map((i) => ({ t: i.title, h: i.link }));
      status.http = 200;
    } else {
      const res = await fetch(board.url, {
        headers: UA,
        cf: { cacheTtl: 0 },
        signal: AbortSignal.timeout(20000),
      });
      status.http = res.status;
      if (!res.ok) return status;
      now = links(await res.text(), board.url);
    }
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
    if (kind === 'feed' && FEEDS[id]) {
      const items = await FEEDS[id]();
      return new Response(rss(id, items), { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
    }
    // One notice from a listed board's own site, for the pipeline to read.
    if (kind === 'file' && board) {
      let target;
      try { target = new URL(new URL(request.url).searchParams.get('u')); } catch {}
      if (!target || target.protocol !== 'https:' || target.hostname !== new URL(board.url).hostname) return new Response('not allowed', { status: 403 });
      if (!(await robotsAllow(target.toString()))) return new Response('robots.txt disallows', { status: 403 });
      const res = await fetch(target, { headers: UA, signal: AbortSignal.timeout(25000) });
      return new Response(res.body, { status: res.status, headers: { 'Content-Type': res.headers.get('Content-Type') ?? 'application/octet-stream' } });
    }
    return new Response('Kasba result watcher', { status: 200 });
  },
};
