// Debug helper: one short block per URL (status, title, RSS item count, a few headlines and
// links), for checking many candidate sources in one run.
// Usage: node pipeline/probe-compact.mjs <url> [<url> ...]
const urls = process.argv.slice(2);
const strip = (s) => s.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
await Promise.all(urls.map(async (u) => {
  let out = `\n=== ${u}\n`;
  try {
    const r = await fetch(u, { headers: { From: 'admin@kasba.co.in', Accept: '*/*' }, signal: AbortSignal.timeout(20000) });
    const h = await r.text();
    const title = strip(h.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').slice(0, 100);
    const items = [...h.matchAll(/<item[\s>][\s\S]*?<\/item>/gi)].map(([i]) => strip(i.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').slice(0, 90) + ' | ' + strip(i.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1] ?? ''));
    out += `status ${r.status} final ${r.url} bytes ${h.length}\ntitle: ${title}\n`;
    if (items.length) out += `rss items ${items.length}:\n  ${items.slice(0, 4).join('\n  ')}\n`;
    else {
      const links = [...h.matchAll(/<a[^>]+href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
        .map(([, href, t]) => [href, strip(t)]).filter(([href, t]) => t.length > 25 && /press|news|release|notice|samachar|vigyapti|\.pdf|bulletin|advt|result/i.test(href + t));
      out += `news-ish links ${links.length}:\n  ${links.slice(0, 5).map(([href, t]) => t.slice(0, 80) + ' -> ' + href.slice(0, 90)).join('\n  ')}\n`;
    }
  } catch (e) { out += `ERROR ${e.cause?.code ?? ''} ${e.message}\n`; }
  console.log(out);
}));
