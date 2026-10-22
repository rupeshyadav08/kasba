// A story as plain Markdown, for AI assistants and answer engines: the same
// facts as the page, with the source and dates stated next to them.
import type { CollectionEntry } from 'astro:content';
import { categories, storyPath, t } from './i18n';
import { districtBySlug, state } from './places';

const day = (d: Date) => d.toISOString().slice(0, 10);

export function storyMarkdown(story: CollectionEntry<'stories'>, site: URL) {
  const d = story.data;
  const L = t[d.lang];
  const places = [d.state ? state[d.lang] : '', ...d.districts.map((s) => districtBySlug(s)![d.lang])].filter(Boolean);
  return [
    `# ${d.title}`,
    '',
    `URL: ${new URL(storyPath(d.lang, d.storyId), site)}`,
    `Language: ${d.lang} · Section: ${categories[d.category].en} · Published: ${day(d.published)}${d.updated ? ` · Updated: ${day(d.updated)}` : ''}`,
    ...(places.length ? [`Places: ${places.join(', ')}`] : []),
    ...(d.deadline ? [`Last date: ${day(d.deadline.date)} (${d.deadline.label})`] : []),
    `Source: ${d.source.name}, "${d.source.title}", ${day(d.source.date)}, ${d.source.url}`,
    '',
    d.summary,
    '',
    `## ${L.meaning}`,
    '',
    d.meaning,
    '',
    `## ${L.keyFacts}`,
    '',
    ...d.keyFacts.map((f) => `- ${f}`),
    '',
    (story.body ?? '').trim(),
    '',
    `## ${L.faq}`,
    '',
    ...d.faq.flatMap((f) => [`**${f.q}**`, f.a, '']),
    ...(d.correction ? [`${L.correction}: ${d.correction}`, ''] : []),
    `${d.author}, Kasba. ${L.aiNote}`,
    '',
  ].join('\n');
}
