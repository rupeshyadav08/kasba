// Tells Bing, Yandex and other IndexNow search engines about newly published
// stories, so they (and the AI answers built on Bing) pick them up within hours
// instead of days. Does nothing while the site is in prelaunch mode.
// Usage: node pipeline/indexnow.mjs <storyId> [storyId ...]
import { readFileSync } from 'node:fs';

const KEY = '559c9135e6a126754493f0402ac7ac9c'; // public by design: public/559c9135e6a126754493f0402ac7ac9c.txt proves we own the site
const site = 'https://kasba.co.in';
const ids = process.argv.slice(2);
const prelaunch = /prelaunch\s*=\s*true/.test(readFileSync(new URL('../src/lib/site.ts', import.meta.url), 'utf8'));

if (prelaunch || !ids.length) {
  console.log(prelaunch ? 'IndexNow: prelaunch, skipped' : 'IndexNow: nothing to send');
} else {
  const urlList = ids.flatMap((id) => [`${site}/story/${id}`, `${site}/en/story/${id}`]);
  const res = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: 'kasba.co.in', key: KEY, keyLocation: `${site}/${KEY}.txt`, urlList }),
  });
  // A failed ping only means search engines find the story a little later; never fail the run for it.
  console.log(`IndexNow: ${res.status} for ${urlList.length} URLs`);
}
