// A large picture for each story, which Google Discover and social cards need (at least
// 1200px wide). It is a Pixabay stock photo (free for commercial use) chosen from the model's
// scene words, so the page labels it "सांकेतिक तस्वीर" (representative image): it sets the scene
// and never claims to show the event or a real person. Saved as public/img/s/<storyId>.webp.
import { mkdirSync } from 'node:fs';

const root = new URL('../../', import.meta.url);
// Fallback scenes per section, used only if the model's words find nothing that fits.
const topics = {
  schemes: 'indian village women', 'jobs-exams': 'indian students exam', farming: 'indian farmer field',
  money: 'indian rupee notes', weather: 'monsoon clouds india', health: 'indian hospital doctor',
  sports: 'india sports stadium', nation: 'india gate delhi',
};
const generic = new Set(['india', 'indian', 'the', 'of', 'and', 'in', 'a', 'for', 'with', 'on', 'at', 'to']);
const indiaTags = /\b(india|indian|delhi|mumbai|kolkata|varanasi|rajasthan|kerala|hindu|hindi|bihar|uttar pradesh|lucknow|agra|jaipur|sari|saree|rupee)\b/i;
// Words a sport or subject story must carry in the photo's tags, so a cricket story never gets a
// football or a flower (25 Nov 2026: Pixabay's loose matching did exactly that).
const subjects = ['cricket', 'football', 'hockey', 'kabaddi', 'wrestling', 'badminton', 'tennis', 'chess', 'boxing', 'athletics', 'train', 'railway', 'fog', 'cyclone', 'flood', 'zoo'];
const has = (tags, w) => {
  const stem = w.length > 4 && w.endsWith('s') ? w.slice(0, -1) : w;
  return tags.includes(stem);
};

// Scores a Pixabay hit against the query: every content word must be in its tags, a required
// subject must be there too, and a photo tagged with an Indian place or thing ranks first.
export function fit(hit, query, must) {
  const tags = String(hit.tags ?? '').toLowerCase();
  const words = query.toLowerCase().split(/\s+/).filter((w) => w && !generic.has(w));
  if (!words.length || !words.every((w) => has(tags, w))) return -1;
  if (must && !has(tags, must)) return -1;
  return words.length + (indiaTags.test(tags) ? 2 : 0);
}

export async function storyImage(draft, storyId) {
  const key = process.env.PIXABAY_API_KEY;
  if (!key) return null;
  // Loaded here, not at the top, so a missing sharp only costs the picture, never the whole run.
  let sharp;
  try { sharp = (await import('sharp')).default; } catch { return null; }
  const text = `${draft.story.en?.title ?? ''} ${draft.story.en?.summary ?? ''}`.toLowerCase();
  const must = subjects.find((s) => new RegExp(`\\b${s}\\b`).test(text));
  // The model's words, then the same words cut to the first two, then the section's scene.
  const q0 = String(draft.story.imageQuery ?? '').trim();
  const queries = [...new Set([q0, q0.split(/\s+/).slice(0, 2).join(' '), must && `${must} india`, topics[draft.story.category]].filter(Boolean))];
  for (const q of queries) {
    const url = `https://pixabay.com/api/?key=${key}&q=${encodeURIComponent(q)}&image_type=photo&orientation=horizontal`
      + '&min_width=1200&safesearch=true&per_page=50';
    const res = await fetch(url);
    if (!res.ok) { console.log('pixabay', res.status); continue; }
    const hits = ((await res.json()).hits ?? [])
      .map((h, i) => ({ h, score: fit(h, q, must), i }))
      .filter((x) => x.score >= 0)
      .sort((a, b) => b.score - a.score || a.i - b.i);
    if (!hits.length) continue;
    // Among the best-fitting few, the same query gives different stories different pictures.
    const top = hits.filter((x) => x.score === hits[0].score).slice(0, 5);
    const pick = top[[...storyId].reduce((a, c) => a + c.charCodeAt(0), 0) % top.length].h;
    const img = Buffer.from(await (await fetch(pick.largeImageURL)).arrayBuffer());
    mkdirSync(new URL('public/img/s/', root), { recursive: true });
    await sharp(img).resize(1200, 675, { fit: 'cover', position: 'attention' }).webp({ quality: 72 })
      .toFile(new URL(`public/img/s/${storyId}.webp`, root).pathname);
    console.log('image', q, pick.tags, pick.pageURL);
    return { src: `/img/s/${storyId}.webp`, credit: `Pixabay (${pick.user})` };
  }
  // No photo that fits: the story uses its section's picture instead of a wrong one.
  console.log('image: nothing fits', queries.join(' | '));
  return null;
}
