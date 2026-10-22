// Reads RSS feeds and official pages with no extra packages.
// PIB, CBSE and the Supreme Court site answer 403 to any User-Agent that names a bot, so we
// send Node's default one and give our contact address in the standard From header instead.
const FROM = 'admin@kasba.co.in';

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

async function fetchOk(url, timeoutMs) {
  const res = await fetch(url, { headers: { From: FROM, Accept: '*/*' }, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res;
}

// Kasba respects robots.txt: a site that asks bots to stay away is never read.
const robotsCache = new Map();
async function allowed(url) {
  const { origin, pathname } = new URL(url);
  if (!robotsCache.has(origin)) {
    let rules = [];
    try {
      const txt = await (await fetchOk(`${origin}/robots.txt`, 10000)).text();
      let applies = false;
      for (const line of txt.split(/\r?\n/)) {
        const [k, ...rest] = line.split(':');
        const key = k.trim().toLowerCase();
        const val = rest.join(':').trim();
        if (key === 'user-agent') applies = val === '*' || /kasba/i.test(val);
        else if (applies && key === 'disallow' && val) rules.push(val);
      }
    } catch { rules = []; } // no robots.txt means no restrictions
    robotsCache.set(origin, rules);
  }
  return !robotsCache.get(origin).some((r) => pathname.startsWith(r.replace(/\*.*$/, '')));
}

export async function get(url, timeoutMs = 20000) {
  if (!(await allowed(url))) throw new Error(`robots.txt disallows ${url}`);
  return (await fetchOk(url, timeoutMs)).text();
}

// Text of an official notice: HTML pages are cleaned, PDFs go through pdftotext.
// Several sites wrap the real notice: RBI pages only link the PDF, SEBI shows it in a
// viewer iframe, PIB puts it in one content block. Scanned PDFs are read with OCR.
export async function noticeText(url) {
  if (!(await allowed(url))) throw new Error(`robots.txt disallows ${url}`);
  const res = await fetchOk(url, 30000);
  const isPdf = /\.pdf($|\?)/i.test(url) || (res.headers.get('content-type') ?? '').includes('pdf');
  if (isPdf) return pdfText(Buffer.from(await res.arrayBuffer()));
  const html = await res.text();
  const inner = innerPdf(html, res.url || url);
  if (inner) return pdfText(Buffer.from(await (await fetchOk(inner, 30000)).arrayBuffer()));
  const block = html.match(/<div[^>]*class=["'][^"']*innner-page-main-about-us-content-right-part[\s\S]*/i);
  return htmlToText(block ? block[0] : html);
}

// The PDF a wrapper page exists to show, if it is one of the known wrappers.
export function innerPdf(html, base) {
  const viewer = html.match(/<iframe[^>]*src=["'][^"']*[?&]file=([^"'&]+\.pdf)/i);
  if (viewer) return new URL(decode(decodeURIComponent(viewer[1])), base).toString();
  const rbi = html.match(/href=["'](https?:\/\/rbidocs\.rbi\.org\.in\/rdocs\/(?:PressRelease|notification)\/PDFs\/[^"']+)["']/i);
  if (rbi) return decode(rbi[1]);
  return null;
}

function pdfText(buf) {
  // Some PDF links answer with an HTML page instead (an error or a redirect page).
  if (buf.subarray(0, 5).toString() !== '%PDF-') return htmlToText(buf.toString('utf8'));
  const dir = mkdtempSync(join(tmpdir(), 'kasba-'));
  const file = join(dir, 'notice.pdf');
  writeFileSync(file, buf);
  const text = execFileSync('pdftotext', ['-l', '6', '-enc', 'UTF-8', file, '-'], { encoding: 'utf8', maxBuffer: 20e6 }).trim();
  if (text.length >= 200) return text;
  // No text layer: a scanned notice. OCR the first three pages in Hindi and English.
  try {
    execFileSync('pdftoppm', ['-r', '200', '-l', '3', '-png', file, join(dir, 'page')]);
    return readdirSync(dir).filter((f) => f.endsWith('.png')).sort()
      .map((f) => execFileSync('tesseract', [join(dir, f), '-', '-l', 'hin+eng'], { encoding: 'utf8', maxBuffer: 20e6, stdio: ['ignore', 'pipe', 'ignore'] }))
      .join('\n').trim();
  } catch { return text; } // OCR tools missing: fall back to whatever text there was
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

// Notice links on an official listing page. `pattern` picks the notice links by URL.
// Where the link text is just "Download" or "Read more", the text just before the
// link is used as the title.
export function parsePage(html, base, pattern) {
  const re = new RegExp(pattern, 'i');
  const items = [];
  const seen = new Set();
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    let link;
    try { link = new URL(decode(m[1]), base).toString(); } catch { continue; }
    if (!re.test(link) || seen.has(link)) continue;
    let title = htmlToText(m[2]).replace(/\(\s*\d+(\.\d+)?\s*[KM]B\s*\)/i, '').trim();
    if (title.length < 15) {
      const before = htmlToText(html.slice(Math.max(0, m.index - 1500), m.index)).split('\n').map((l) => l.trim()).filter((l) => l.length > 15);
      title = before.at(-1) ?? '';
    }
    if (title.length < 15) continue;
    seen.add(link);
    items.push({ title: title.slice(0, 200), link, description: '', date: null });
  }
  return items;
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

// A notice date written into its link, such as Reminder_21102026.pdf or /2026-10-21/.
export function dateFromLink(link) {
  const m = link.match(/(?<!\d)(\d{2})[-_.]?(\d{2})[-_.]?(20\d{2})(?!\d)/) ?? link.match(/(?<!\d)(20\d{2})[-_/](\d{2})[-_/](\d{2})(?!\d)/);
  if (!m) return null;
  const [y, mo, d] = m[3].length === 4 ? [m[3], m[2], m[1]] : [m[1], m[2], m[3]];
  const iso = `${y}-${mo}-${d}`;
  return Number(mo) <= 12 && Number(d) <= 31 && !Number.isNaN(Date.parse(iso)) ? iso : null;
}
