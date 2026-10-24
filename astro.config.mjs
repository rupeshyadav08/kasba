// @ts-check
import { readdirSync, readFileSync } from 'node:fs';
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

export default defineConfig({
  site: 'https://kasba.co.in',
  trailingSlash: 'never',
  // Inline CSS so the first paint does not wait for a stylesheet request.
  build: { format: 'file', inlineStylesheets: 'always' },
  // i18n pairs each Hindi page with its /en twin in the sitemap (hreflang), which
  // is how search engines show each reader the right language.
  integrations: [sitemap({ filter: keep, i18n: { defaultLocale: 'hi', locales: { hi: 'hi-IN', en: 'en-IN' } } })],
});
