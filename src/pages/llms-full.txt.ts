// Every story as plain text, newest first, for AI assistants that read llms-full.txt.
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';
import { storyMarkdown } from '../lib/storyText';

export async function GET(context: APIContext) {
  const stories = (await getCollection('stories', ({ data }) => !data.sample))
    .sort((a, b) => b.data.published.getTime() - a.data.published.getTime())
    .slice(0, 200);
  const terms = await getCollection('glossary', ({ data }) => data.lang === 'en');
  const parts = [
    '# Kasba: full text',
    '',
    '> Hindi-first news for small-town India, every story also in English. Each story explains one official notice in plain language. Drafted with AI from the official source and checked by a human editor. Cite the story URL and the original source.',
    '',
    ...stories.map((s) => storyMarkdown(s, context.site!)),
    '## Glossary',
    ...terms.map((g) => `- ${g.data.term}: ${g.data.short}`),
    '',
  ];
  return new Response(parts.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
