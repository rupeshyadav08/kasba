// Evergreen guide pages (src/content/exams): one page per exam, scheme or recurring topic that
// people search all year. The site adds every matching story to its guide at build time; this
// file keeps the guide's own "where things stand now" box fresh. After a run publishes stories,
// each guide they match gets its `now` text and `nowFacts` rewritten from the newest story and
// its `updated` date moved, so the page itself changes when the news does.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { complete, parseJson } from './llm.mjs';

const root = new URL('../../', import.meta.url);
const dir = (lang) => new URL(`src/content/exams/${lang}/`, root);

// Guide front matter is one `key: <JSON>` line per field (see the existing files).
export function readGuide(lang, id) {
  const text = readFileSync(new URL(`${id}.md`, dir(lang)), 'utf8');
  const [, head, body] = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  const data = {};
  for (const line of head.split('\n')) {
    const m = line.match(/^(\w+): (.*)$/);
    if (m) data[m[1]] = JSON.parse(m[2]);
  }
  return { data, body };
}

// Only changed fields are rewritten, so a file keeps its own layout and its diff stays small.
export function writeGuide(lang, id, { data, body }) {
  const file = new URL(`${id}.md`, dir(lang));
  const [, head] = readFileSync(file, 'utf8').match(/^---\n([\s\S]*?)\n---/);
  const lines = head.split('\n');
  for (const [k, v] of Object.entries(data)) {
    const i = lines.findIndex((l) => l.startsWith(`${k}: `));
    if (i >= 0 && JSON.stringify(JSON.parse(lines[i].slice(k.length + 2))) === JSON.stringify(v)) continue;
    if (i >= 0) lines[i] = `${k}: ${JSON.stringify(v)}`;
    else lines.push(`${k}: ${JSON.stringify(v)}`);
  }
  writeFileSync(file, `---\n${lines.join('\n')}\n---\n${body.startsWith('\n') ? body : `\n${body}`}`);
}

export const guideIds = () => readdirSync(dir('hi')).filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3));

// Same rule as the site (src/lib/exams.ts): a story belongs to a guide if any of the guide's
// match words is in its title, summary, key facts or source title.
const storyText = (s, source) => [s.title, s.summary, ...(s.keyFacts ?? []), source?.title ?? ''].join(' ').toLowerCase();
export function guidesFor(draft) {
  const text = ['hi', 'en'].map((l) => storyText(draft.story[l] ?? {}, draft.source)).join(' ');
  return guideIds().filter((id) => readGuide('hi', id).data.match.some((w) => text.includes(w.toLowerCase())));
}

const PROMPT = `You keep an always-updated guide page of Kasba, a Hindi-first news site for small-town India, current.
You get the guide's name, what its "now" box says today, and new stories that just went live about it.
Return only this JSON:
{"changed": true or false,
 "hi": {"now": "2-3 short sentences in plain Hindi (Devanagari, everyday English words like form, result, last date are fine): where things stand today for the reader, newest first, with the dates", "nowFacts": ["up to 5 short lines: dates, amounts, links to act on"]},
 "en": {"now": "the same in plain English", "nowFacts": ["the same lines in English"]}}
Rules: use only facts from the stories and the old box. Keep an old fact only if the new story does not replace it and it is still ahead or still true; drop dates that have passed. Never guess a future date. If the new story adds nothing a reader of this guide needs, return {"changed": false}.`;

// published: [{ storyId, draft }]. Returns the guide ids it rewrote.
export async function refreshGuides(published, { provider, model }) {
  const byGuide = new Map();
  for (const p of published) for (const id of guidesFor(p.draft)) byGuide.set(id, [...(byGuide.get(id) ?? []), p]);
  const done = [];
  for (const [id, items] of byGuide) {
    const hi = readGuide('hi', id);
    const en = readGuide('en', id);
    const user = JSON.stringify({
      guide: en.data.name,
      now: { hi: hi.data.now ?? '', hiFacts: hi.data.nowFacts ?? [], en: en.data.now ?? '', enFacts: en.data.nowFacts ?? [] },
      today: new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10),
      stories: items.map(({ storyId, draft }) => ({
        storyId, hi: { title: draft.story.hi.title, summary: draft.story.hi.summary, keyFacts: draft.story.hi.keyFacts },
        en: { title: draft.story.en.title, summary: draft.story.en.summary, keyFacts: draft.story.en.keyFacts },
      })),
    });
    try {
      const out = parseJson((await complete({ provider, model, system: PROMPT, user })).text);
      if (!out?.changed || !out.hi?.now || !out.en?.now) continue;
      const today = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
      for (const [lang, g] of [['hi', hi], ['en', en]]) {
        g.data.now = String(out[lang].now).slice(0, 600);
        g.data.nowFacts = (out[lang].nowFacts ?? []).map(String).filter(Boolean).slice(0, 5);
        g.data.nowStory = items.at(-1).storyId;
        g.data.updated = today;
        writeGuide(lang, id, g);
      }
      done.push(id);
    } catch (e) {
      console.log('guide', id, e.message);
    }
  }
  return done;
}
