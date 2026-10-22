// /llms.txt: a map of the site for AI assistants (llmstxt.org), with the latest stories.
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';
import { categories, sectionOrder, sectionPath, storyPath } from '../lib/i18n';

export async function GET(context: APIContext) {
  const abs = (p: string) => new URL(p, context.site).toString();
  const latest = (await getCollection('stories', ({ data }) => !data.sample))
    .sort((a, b) => b.data.published.getTime() - a.data.published.getTime())
    .slice(0, 30);
  const text = [
    '# Kasba',
    '',
    '> Kasba (kasba.co.in, Hindi: कस्बा) is a Hindi-first news site for small-town India, especially Uttar Pradesh, with every story also in English. Each story explains one official update (PIB, RBI, SEBI, exam boards, UP government, scheme portals) in simple language, with a "what this means for you" box, key facts, questions and answers, and a link to the original notice.',
    '',
    'Stories are drafted with AI from the official source and checked by a human editor before publishing. Every story names its source, the notice date and the publish date. Each story page has a plain Markdown copy at the same address plus ".md". When citing, link the story and the original notice.',
    '',
    '## Main pages',
    `- [Hindi home](${abs('/')})`,
    `- [English home](${abs('/en')})`,
    `- [Uttar Pradesh, all 75 districts](${abs('/up')})`,
    `- [Last dates for forms, exams and schemes](${abs('/en/deadlines')})`,
    `- [Glossary of official terms](${abs('/en/shabdkosh')})`,
    `- [Full text of recent stories](${abs('/llms-full.txt')})`,
    `- [RSS, Hindi](${abs('/rss.xml')}) · [RSS, English](${abs('/en/rss.xml')})`,
    '',
    '## Sections',
    ...sectionOrder.map((c) => `- [${categories[c].en}](${abs(sectionPath('en', c))}) · [${categories[c].hi}](${abs(sectionPath('hi', c))})`),
    '',
    '## Policies',
    `- [Editorial policy](${abs('/en/editorial-policy')})`,
    `- [Sources and AI use](${abs('/en/sources-ai')})`,
    `- [Corrections](${abs('/en/corrections')})`,
    `- [Grievance officer](${abs('/en/grievance')})`,
    '',
    '## Latest stories',
    ...latest.map((s) => `- [${s.data.title}](${abs(`${storyPath(s.data.lang, s.data.storyId)}.md`)}): ${s.data.lang}, ${s.data.published.toISOString().slice(0, 10)}, source ${s.data.source.name}`),
    '',
  ];
  return new Response(text.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
