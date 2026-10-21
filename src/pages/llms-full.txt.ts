// Every story as plain text, newest first, for AI assistants that read llms-full.txt.
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';
import { categories, storyPath } from '../lib/i18n';

const day = (d: Date) => d.toISOString().slice(0, 10);

export async function GET(context: APIContext) {
  const stories = (await getCollection('stories', ({ data }) => !data.sample))
    .sort((a, b) => b.data.published.getTime() - a.data.published.getTime())
    .slice(0, 200);
  const terms = await getCollection('glossary', ({ data }) => data.lang === 'en');
  const parts = [
    '# Kasba: full text',
    '',
    '> Hindi-first news for small-town India. Each story explains one official notice in plain language. Drafted with AI from the official source and checked by a human editor. Cite the story URL and the original source.',
    '',
    ...stories.map((s) => {
      const d = s.data;
      return [
        `## ${d.title}`,
        `URL: ${new URL(storyPath(d.lang, d.storyId), context.site)}`,
        `Language: ${d.lang} · Section: ${categories[d.category].en} · Published: ${day(d.published)}${d.updated ? ` · Updated: ${day(d.updated)}` : ''}`,
        `Source: ${d.source.name}, "${d.source.title}", ${day(d.source.date)}, ${d.source.url}`,
        '',
        d.summary,
        '',
        `What this means for you: ${d.meaning}`,
        '',
        ...d.keyFacts.map((f) => `- ${f}`),
        '',
        ...d.faq.map((f) => `Q: ${f.q}\nA: ${f.a}`),
        '',
      ].join('\n');
    }),
    '## Glossary',
    ...terms.map((g) => `- ${g.data.term}: ${g.data.short}`),
    '',
  ];
  return new Response(parts.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
