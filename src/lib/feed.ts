// RSS feed for one language: /rss.xml (Hindi) and /en/rss.xml (English).
import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';
import { storyPath, type Lang } from './i18n';

const meta = {
  hi: { title: 'कस्बा', description: 'छोटे शहरों की बड़ी ख़बरें, आधिकारिक स्रोतों से' },
  en: { title: 'Kasba (English)', description: 'Big news for small towns, from official sources' },
};

export async function feed(lang: Lang, context: APIContext) {
  const stories = (await getCollection('stories', ({ data }) => data.lang === lang))
    .sort((a, b) => b.data.published.getTime() - a.data.published.getTime())
    .slice(0, 50);
  return rss({
    ...meta[lang],
    site: context.site!,
    trailingSlash: false,
    xmlns: { media: 'http://search.yahoo.com/mrss/' },
    customData: `<language>${lang}</language>`,
    items: stories.map((s) => ({
      title: s.data.title,
      description: s.data.summary,
      pubDate: s.data.published,
      link: storyPath(lang, s.data.storyId),
      categories: [s.data.category],
      // The story picture, for feed readers and news apps that show one.
      ...(s.data.image && { customData: `<media:content url="${new URL(s.data.image.src, context.site)}" medium="image" width="1200" height="675" />` }),
    })),
  });
}
