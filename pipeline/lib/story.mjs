// Checks a model draft against Kasba's story schema and writes the Markdown files.
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { categories } from './prompt.mjs';

const root = new URL('../../', import.meta.url);

export const districtSlugs = () =>
  [...readFileSync(new URL('src/lib/places.ts', root), 'utf8').matchAll(/\['([a-z-]+)', '/g)].map((m) => m[1]);

const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

// Returns a list of problems; an empty list means the draft can go to the editor.
export function check(d) {
  const p = [];
  if (!categories.includes(d.category)) p.push(`category "${d.category}"`);
  if (d.storyType != null && !['notice', 'record'].includes(d.storyType)) p.push(`storyType "${d.storyType}"`);
  if (d.state != null && d.state !== 'up') p.push(`state "${d.state}"`);
  const slugs = districtSlugs();
  for (const s of d.districts ?? []) if (!slugs.includes(s)) p.push(`district "${s}"`);
  if (d.deadline && !(isDate(d.deadline.date) && d.deadline.label_hi && d.deadline.label_en)) p.push('deadline');
  for (const lang of ['hi', 'en']) {
    const s = d[lang];
    if (!s) { p.push(`missing ${lang}`); continue; }
    // The prompt asks for 100 and 280 characters; the limits leave room so a slightly long draft
    // still reaches the editor instead of being dropped.
    if (!s.title || s.title.length > 130) p.push(`${lang} title length`);
    if (!s.summary || s.summary.length > 450) p.push(`${lang} summary length`);
    if (!s.meaning) p.push(`${lang} meaning`);
    if (!Array.isArray(s.keyFacts) || s.keyFacts.length < 1) p.push(`${lang} keyFacts`);
    if (!Array.isArray(s.faq) || s.faq.length < 2 || s.faq.length > 5 || s.faq.some((f) => !f.q || !f.a)) p.push(`${lang} faq`);
    if (!s.body) p.push(`${lang} body`);
  }
  return p;
}

export const slugify = (s) =>
  s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').slice(0, 60).replace(/^-+|-+$/g, '') || 'story';

export function uniqueId(base) {
  let id = base;
  for (let n = 2; existsSync(new URL(`src/content/stories/hi/${id}.md`, root)); n++) id = `${base}-${n}`;
  return id;
}

// India time as an ISO string with +05:30, so the site shows the right day.
export const istNow = (d = new Date()) => new Date(d.getTime() + 5.5 * 3600e3).toISOString().replace(/\.\d+Z$/, '+05:30');

const q = (s) => JSON.stringify(String(s)); // a JSON string is a valid YAML double-quoted scalar

export function toMarkdown(draft, lang, { storyId, author, published, auto = false }) {
  const s = draft.story[lang];
  const lines = [
    '---',
    `lang: ${lang}`,
    `storyId: ${storyId}`,
    `title: ${q(s.title)}`,
    `summary: ${q(s.summary)}`,
    `meaning: ${q(s.meaning)}`,
    'keyFacts:', ...s.keyFacts.map((f) => `  - ${q(f)}`),
    'faq:', ...s.faq.flatMap((f) => [`  - q: ${q(f.q)}`, `    a: ${q(f.a)}`]),
    'source:',
    `  name: ${q(draft.source.name)}`,
    `  title: ${q(draft.story.sourceTitle || draft.source.title)}`,
    `  url: ${q(draft.source.link)}`,
    `  date: ${draft.story.sourceDate && isDate(draft.story.sourceDate) ? draft.story.sourceDate : published.slice(0, 10)}`,
    `category: ${draft.story.category}`,
    ...(draft.story.storyType === 'record' ? ['storyType: record'] : []),
    ...(draft.story.state ? [`state: ${draft.story.state}`] : []),
    ...(draft.story.districts?.length ? ['districts:', ...draft.story.districts.map((x) => `  - ${x}`)] : []),
    ...(draft.story.deadline ? ['deadline:', `  date: ${draft.story.deadline.date}`, `  label: ${q(draft.story.deadline[`label_${lang}`])}`] : []),
    `author: ${q(author[lang])}`,
    ...(auto ? ['autoPublished: true'] : []),
    `published: ${published}`,
    '---',
    '',
    s.body.trim(),
    '',
  ];
  return lines.join('\n');
}

export function publish(draft, author, { auto = false } = {}) {
  const storyId = uniqueId(slugify(draft.story.en.title));
  const published = istNow();
  for (const lang of ['hi', 'en']) {
    writeFileSync(new URL(`src/content/stories/${lang}/${storyId}.md`, root), toMarkdown(draft, lang, { storyId, author, published, auto }));
  }
  return storyId;
}

// Takes a published story off the site (both languages). Returns false if it was already gone.
export function unpublish(storyId) {
  if (!/^[a-z0-9-]+$/.test(storyId)) return false;
  let gone = false;
  for (const lang of ['hi', 'en']) {
    const f = new URL(`src/content/stories/${lang}/${storyId}.md`, root);
    if (existsSync(f)) { rmSync(f); gone = true; }
  }
  return gone;
}
