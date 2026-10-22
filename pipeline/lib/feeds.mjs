// Reads RSS feeds and official pages with no extra packages.
const UA = 'KasbaBot/1.0 (+https://kasba.co.in/sources-ai; admin@kasba.co.in)';

export async function get(url, timeoutMs = 20000) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: '*/*' }, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.text();
}

const decode = (s) => s
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&amp;/g, '&')
  .trim();

const tag = (block, name) => {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? decode(m[1]) : '';
};

// Returns [{ title, link, description, date }] in feed order.
export function parseRss(xml) {
  return [...xml.matchAll(/<item[\s>][\s\S]*?<\/item>/gi)].map(([block]) => {
    const raw = tag(block, 'pubDate') || tag(block, 'dc:date');
    const date = raw && !Number.isNaN(Date.parse(raw)) ? new Date(raw) : null;
    return { title: tag(block, 'title'), link: tag(block, 'link').trim(), description: htmlToText(tag(block, 'description')), date };
  }).filter((i) => i.title && i.link);
}

// Plain readable text from an HTML page, without menus, scripts or styles.
export function htmlToText(html) {
  return decode(html
    .replace(/<(script|style|noscript|nav|header|footer|form)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|div|li|tr|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, ' '))
    .replace(/[ \t ]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}
