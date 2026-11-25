// A headline card for a story that has no fitting photo: Google Discover only shows stories with
// a large picture, and a card with the story's own headline can never be the wrong picture.
// Light design (cream, section-colour stripe, dark headline), 1200x675, saved where a photo
// would go: public/img/s/<storyId>.webp. Fonts: Mukta (SIL Open Font License, pipeline/fonts).
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

const root = new URL('../../', import.meta.url);
const fontDir = new URL('pipeline/fonts/', root).pathname;
// sharp renders SVG text with the system's fontconfig; point it at the bundled fonts before
// sharp loads, so the card looks the same on GitHub's runner, the India runner and a laptop.
const conf = `${tmpdir()}/kasba-fonts.conf`;
writeFileSync(conf, `<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig><dir>${fontDir}</dir><cachedir>${tmpdir()}/kasba-fc-cache</cachedir></fontconfig>`);
process.env.FONTCONFIG_FILE = conf;

const sections = {
  schemes: ['योजनाएँ', '#0b6e4f'], 'jobs-exams': ['नौकरी-परीक्षा', '#1f4e9c'], farming: ['खेती', '#7a5200'],
  money: ['पैसा', '#5b2c83'], weather: ['मौसम', '#00677f'], health: ['सेहत', '#a4262c'],
  sports: ['खेल', '#b3410e'], nation: ['देश', '#3d434a'],
};
const states = { up: 'उत्तर प्रदेश', bihar: 'बिहार', mp: 'मध्य प्रदेश', delhi: 'दिल्ली' };
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Rough width of text in Mukta ExtraBold, in units of the font size. Devanagari vowel signs and
// marks take no width of their own.
const mark = /[ऀ-ःऺ-ॏ॑-ॗॢॣ]/;
export function textWidth(s, size) {
  let w = 0;
  for (const ch of s) {
    if (mark.test(ch)) continue;
    if (/[ऀ-ॿ]/.test(ch)) w += 0.7;
    else if (ch === ' ') w += 0.24;
    else if (/[A-Z0-9₹%]/.test(ch)) w += 0.66;
    else if (/[a-z]/.test(ch)) w += 0.54;
    else w += 0.35;
  }
  return w * size;
}

export function wrap(text, size, maxWidth, maxLines) {
  const lines = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (textWidth(next, size) <= maxWidth || !line) line = next;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = `${kept[maxLines - 1].replace(/[\s,:;-]+$/, '')}…`;
  return kept;
}

export function cardSvg({ title, category, state }) {
  const [label, colour] = sections[category] ?? sections.nation;
  const maxWidth = 1200 - 80 - 90;
  // The biggest size at which the whole headline fits in 4 lines; else 5 lines at the smallest.
  let size = 52;
  let lines = wrap(title, 52, maxWidth, 5);
  for (const s of [72, 66, 60]) {
    const l = wrap(title, s, maxWidth, 99);
    if (l.length <= 4) { size = s; lines = l; break; }
  }
  const step = Math.round(size * 1.28);
  const top = 150 + Math.round((420 - step * lines.length) / 2) + size;
  const where = states[state] ? ` · ${states[state]}` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675">
  <rect width="1200" height="675" fill="#faf7f2"/>
  <rect width="22" height="675" fill="${colour}"/>
  <text x="80" y="105" font-family="Mukta" font-weight="800" font-size="38" fill="${colour}">${esc(label + where)}</text>
  ${lines.map((l, i) => `<text x="80" y="${top + i * step}" font-family="Mukta" font-weight="800" font-size="${size}" fill="#1b1b1b">${esc(l)}</text>`).join('\n  ')}
  <rect x="80" y="585" width="1050" height="2" fill="#e4ddd2"/>
  <text x="80" y="640" font-family="Mukta" font-weight="800" font-size="40" fill="#c8102e">कस्बा</text>
  <text x="1130" y="640" text-anchor="end" font-family="Mukta" font-weight="700" font-size="30" fill="#6b6359">kasba.co.in</text>
</svg>`;
}

// Writes the card and returns the story's image field, or null if sharp is missing.
export async function storyCard(draft, storyId) {
  let sharp;
  try { sharp = (await import('sharp')).default; } catch { return null; }
  const svg = cardSvg({ title: draft.story.hi.title, category: draft.story.category, state: draft.story.state });
  mkdirSync(new URL('public/img/s/', root), { recursive: true });
  await sharp(Buffer.from(svg)).webp({ quality: 82 }).toFile(new URL(`public/img/s/${storyId}.webp`, root).pathname);
  return { src: `/img/s/${storyId}.webp`, credit: 'Kasba' };
}
