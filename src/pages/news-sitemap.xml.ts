// Google News sitemap: stories from the last 48 hours only, as Google requires.
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';
import { storyPath } from '../lib/i18n';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export async function GET(context: APIContext) {
  const cutoff = Date.now() - 48 * 3600 * 1000;
  const recent = (await getCollection('stories', ({ data }) => !data.sample && data.published.getTime() >= cutoff));
  const urls = recent.map((s) => `  <url>
    <loc>${new URL(storyPath(s.data.lang, s.data.storyId), context.site)}</loc>
    <news:news>
      <news:publication><news:name>Kasba</news:name><news:language>${s.data.lang}</news:language></news:publication>
      <news:publication_date>${s.data.published.toISOString()}</news:publication_date>
      <news:title>${esc(s.data.title)}</news:title>
    </news:news>
  </url>`).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${urls}
</urlset>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
