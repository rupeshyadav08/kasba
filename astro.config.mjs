// @ts-check
import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// District pages go in the sitemap only once some story is tagged with that
// district; empty ones are noindex (see DistrictPage.astro).
const storyDistricts = new Set();
for (const lang of ['hi', 'en']) {
  const dir = `./src/content/stories/${lang}`;
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.md'))) {
    const fm = readFileSync(`${dir}/${f}`, 'utf8').split('---')[1] ?? '';
    const block = fm.match(/^districts:(.*(?:\n\s+-.*)*)/m)?.[1] ?? '';
    for (const m of block.matchAll(/[a-z]+(?:-[a-z]+)*/g)) storyDistricts.add(m[0]);
  }
}
const keep = (page) => {
  if (page.includes('/offline')) return false;
  const d = page.match(/\/district\/([a-z-]+)/);
  return !d || storyDistricts.has(d[1]);
};

// Small copies of the story pictures for cards and lists (see src/lib/img.ts).
const thumbs = {
  name: 'kasba-thumbs',
  hooks: {
    'astro:build:done': async ({ dir, logger }) => {
      const sharp = (await import('sharp')).default;
      const from = fileURLToPath(new URL('img/s/', dir));
      const to = fileURLToPath(new URL('img/t/', dir));
      mkdirSync(to, { recursive: true });
      const files = readdirSync(from).filter((n) => n.endsWith('.webp'));
      await Promise.all(files.map((n) => sharp(from + n).resize(480, 270).webp({ quality: 60 }).toFile(to + n)));
      logger.info(`${files.length} thumbnails`);
    },
  },
};

// Story pages carry the date they were last changed, so search engines re-read updated ones.
const storyDates = new Map();
for (const lang of ['hi', 'en']) {
  const dir = `./src/content/stories/${lang}`;
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.md'))) {
    const fm = readFileSync(`${dir}/${f}`, 'utf8').split('---')[1] ?? '';
    const when = fm.match(/^updated:\s*(\S+)/m)?.[1] ?? fm.match(/^published:\s*(\S+)/m)?.[1];
    const d = when && new Date(when.replace(/^["']|["']$/g, ''));
    if (d && !Number.isNaN(d.getTime())) storyDates.set(`${lang === 'hi' ? '' : '/en'}/story/${f.slice(0, -3)}`, d.toISOString());
  }
}
const lastmod = (item) => {
  const d = storyDates.get(new URL(item.url).pathname);
  return d ? { ...item, lastmod: d } : item;
};

export default defineConfig({
  site: 'https://kasba.co.in',
  trailingSlash: 'never',
  // Inline CSS so the first paint does not wait for a stylesheet request.
  build: { format: 'file', inlineStylesheets: 'always' },
  // i18n pairs each Hindi page with its /en twin in the sitemap (hreflang), which
  // is how search engines show each reader the right language.
  integrations: [thumbs, sitemap({ filter: keep, serialize: lastmod, i18n: { defaultLocale: 'hi', locales: { hi: 'hi-IN', en: 'en-IN' } } })],
});
