import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';
import { storyPath } from '../lib/i18n';

export async function GET(context: APIContext) {
  const stories = (await getCollection('stories', ({ data }) => data.lang === 'hi'))
    .sort((a, b) => b.data.published.getTime() - a.data.published.getTime())
    .slice(0, 50);
  return rss({
    title: 'कस्बा',
    description: 'छोटे शहरों की बड़ी ख़बरें, आधिकारिक स्रोतों से',
    site: context.site!,
    trailingSlash: false,
    customData: '<language>hi</language>',
    items: stories.map((s) => ({
      title: s.data.title,
      description: s.data.summary,
      pubDate: s.data.published,
      link: storyPath('hi', s.data.storyId),
    })),
  });
}
