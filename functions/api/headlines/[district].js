// GET /api/headlines/<district>: the latest local headlines for one UP district, from local
// papers' own RSS feeds. Kasba shows only the headline, the paper's name and a link to the
// paper's page; nothing is copied or rewritten, and the stories are the papers' own.
// Runs as a Cloudflare Pages Function, so the headlines stay fresh without rebuilding the site.
import { districtBySlug } from '../../../src/lib/places';

const MAX_AGE_HOURS = 48;
const LIMIT = 8;

// Amar Ujala has one feed per district; its address uses the district's usual name.
const amarUjalaSlug = { 'gautam-buddh-nagar': 'noida', 'kanpur-nagar': 'kanpur' };
const sources = [
  { name: 'अमर उजाला', url: (slug) => `https://www.amarujala.com/rss/${amarUjalaSlug[slug] ?? slug}.xml`, all: true },
  // Dainik Bhaskar has one feed for all of UP; a headline counts if it names the district.
  { name: 'दैनिक भास्कर', url: () => 'https://www.bhaskar.com/rss-v1--category-2052.xml', all: false },
];

const decode = (s) => s
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&quot;/g, '"').replace(/&#039;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
  .replace(/<[^>]+>/g, '').trim();
const tag = (item, name) => decode(item.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`))?.[1] ?? '');

function parse(xml, source) {
  return [...xml.matchAll(/<item[\s>][\s\S]*?<\/item>/g)].map(([item]) => ({
    title: tag(item, 'title'),
    url: tag(item, 'link'),
    source,
    date: Date.parse(tag(item, 'pubDate')) || 0,
  }));
}

export async function onRequestGet({ params, request, waitUntil }) {
  const district = districtBySlug(String(params.district));
  if (!district) return new Response('Unknown district', { status: 404 });
  // Cloudflare's edge cache (works on kasba.co.in; on *.pages.dev it is skipped).
  const cache = caches.default;
  const hit = await cache.match(request);
  if (hit) return hit;
  // "गौतम बुद्ध नगर (नोएडा)" is matched as either name.
  const names = district.hi.split(/[()]/).map((s) => s.trim()).filter(Boolean);
  const cutoff = Date.now() - MAX_AGE_HOURS * 3600e3;

  const lists = await Promise.all(sources.map(async (s) => {
    try {
      const res = await fetch(s.url(district.slug), { headers: { Accept: 'application/rss+xml, application/xml', From: 'admin@kasba.co.in' } });
      if (!res.ok) return [];
      return parse(await res.text(), s.name).filter((h) => s.all || names.some((n) => h.title.includes(n)));
    } catch {
      return []; // one paper being down should not empty the box
    }
  }));

  const seen = new Set();
  const items = lists.flat()
    .filter((h) => h.title && /^https:\/\//.test(h.url) && !h.url.includes('/video/') && h.date >= cutoff)
    .filter((h) => !seen.has(h.title) && seen.add(h.title))
    .sort((a, b) => b.date - a.date)
    .slice(0, LIMIT)
    .map((h) => ({ ...h, date: new Date(h.date).toISOString() }));

  const res = Response.json({ district: district.slug, items }, {
    // Browsers and Cloudflare keep the answer for 30 minutes, so each feed is read at most twice an hour.
    headers: { 'Cache-Control': 'public, max-age=1800' },
  });
  waitUntil(cache.put(request, res.clone()));
  return res;
}
