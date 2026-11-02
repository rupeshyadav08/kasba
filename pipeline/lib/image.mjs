// A large picture for each story, which Google Discover and social cards need (at least
// 1200px wide). It is a Pixabay stock photo (free for commercial use) chosen from the model's
// scene words, so the page labels it "सांकेतिक तस्वीर" (representative image): it sets the scene
// and never claims to show the event or a real person. Saved as public/img/s/<storyId>.webp.
import { mkdirSync } from 'node:fs';

const root = new URL('../../', import.meta.url);
const topics = {
  schemes: 'indian village women', 'jobs-exams': 'students exam hall', farming: 'farmer field india',
  money: 'indian rupee notes', weather: 'monsoon clouds', health: 'hospital doctor india',
  sports: 'cricket stadium', nation: 'india gate delhi',
};

export async function storyImage(draft, storyId) {
  const key = process.env.PIXABAY_API_KEY;
  if (!key) return null;
  // Loaded here, not at the top, so a missing sharp only costs the picture, never the whole run.
  let sharp;
  try { sharp = (await import('sharp')).default; } catch { return null; }
  const queries = [draft.story.imageQuery, topics[draft.story.category]].filter(Boolean);
  for (const q of queries) {
    const url = `https://pixabay.com/api/?key=${key}&q=${encodeURIComponent(q)}&image_type=photo&orientation=horizontal`
      + '&min_width=1200&safesearch=true&per_page=20';
    const res = await fetch(url);
    if (!res.ok) { console.log('pixabay', res.status); continue; }
    const hits = (await res.json()).hits ?? [];
    if (!hits.length) continue;
    // The same query gives different stories different pictures.
    const pick = hits[[...storyId].reduce((a, c) => a + c.charCodeAt(0), 0) % Math.min(hits.length, 10)];
    const img = Buffer.from(await (await fetch(pick.largeImageURL)).arrayBuffer());
    mkdirSync(new URL('public/img/s/', root), { recursive: true });
    await sharp(img).resize(1200, 675, { fit: 'cover', position: 'attention' }).webp({ quality: 72 })
      .toFile(new URL(`public/img/s/${storyId}.webp`, root).pathname);
    console.log('image', q, pick.pageURL);
    return { src: `/img/s/${storyId}.webp`, credit: `Pixabay (${pick.user})` };
  }
  return null;
}
