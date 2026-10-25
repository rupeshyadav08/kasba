// Turns one published story into a ~30-second vertical video (YouTube Shorts / Instagram Reels)
// and sends it to the editor on Telegram. Nothing is posted publicly.
// Usage: node scripts/make-short.mjs [storyId]   (default: the newest Hindi story with a deadline)
// Needs ffmpeg, edge-tts (pip) and Playwright's Chromium. DEEPSEEK_API_KEY writes the script;
// without it the story's own title and key facts are read out.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { parse } from 'yaml';
import { complete, parseJson } from '../pipeline/lib/llm.mjs';

const dir = 'src/content/stories/hi/';
const out = 'short/';
mkdirSync(out, { recursive: true });

const stories = readdirSync(dir).map((f) => parse(readFileSync(dir + f, 'utf8').split(/^---$/m)[1]));
stories.sort((a, b) => String(b.published).localeCompare(String(a.published)));
const story = process.argv[2]
  ? stories.find((s) => s.storyId === process.argv[2])
  : stories.find((s) => s.deadline?.date) ?? stories[0];
if (!story) throw new Error(`No story ${process.argv[2]}`);

const colours = { schemes: '#0b6e4f', 'jobs-exams': '#1f4e9c', farming: '#7a5200', money: '#5b2c83', weather: '#00677f', health: '#a4262c', sports: '#b3410e', nation: '#3d434a' };
const sections = { schemes: 'योजनाएँ', 'jobs-exams': 'नौकरी-परीक्षा', farming: 'खेती', money: 'पैसा', weather: 'मौसम', health: 'सेहत', sports: 'खेल', nation: 'देश' };

// Each scene is a short on-screen line plus what the voice says over it.
async function writeScript() {
  const fallback = {
    scenes: [
      { screen: story.title, voice: story.title },
      ...story.keyFacts.slice(0, 3).map((f) => ({ screen: f, voice: f })),
      { screen: 'पूरी ख़बर: kasba.co.in', voice: 'पूरी ख़बर पढ़ें कस्बा डॉट को डॉट इन पर।' },
    ],
  };
  if (!process.env.DEEPSEEK_API_KEY) return fallback;
  const config = JSON.parse(readFileSync('pipeline/config.json', 'utf8'));
  const system = `तुम कस्बा (kasba.co.in) के लिए 25-30 सेकंड का हिंदी शॉर्ट वीडियो स्क्रिप्ट लिखते हो।
नियम: सिर्फ़ ख़बर में दिए तथ्य, कोई नया तथ्य या अंदाज़ा नहीं। बोलचाल की हिंदी, जैसे कोई जानकार दोस्त
जोश से बता रहा हो: छोटे वाक्य, सीधे "आप" से बात, बीच में "ध्यान दीजिए", "याद रखिए" जैसे शब्द, सवाल और विस्मय (!)।
अंक शब्दों में नहीं, अंकों में लिखो; अंग्रेज़ी नाम (JEE, NTA) वैसे ही। पहला दृश्य एक ठोस हुक हो
(जैसे "आख़िरी तारीख़ 22 नवंबर"), फिर 3 दृश्य काम की बातें, आख़िरी दृश्य "पूरी ख़बर kasba.co.in पर"।
हर दृश्य: screen = स्क्रीन पर 4-9 शब्द, voice = बोलने के लिए 1-2 छोटे वाक्य। कुल voice 60-75 शब्द।
सिर्फ़ JSON लौटाओ: {"scenes":[{"screen":"...","voice":"..."}]}`;
  const user = JSON.stringify({ title: story.title, summary: story.summary, meaning: story.meaning, keyFacts: story.keyFacts, deadline: story.deadline });
  try {
    const { text, usage } = await complete({ provider: config.provider, model: config.models[config.provider], system, user });
    console.log('tokens', JSON.stringify(usage));
    const script = parseJson(text);
    if (script.scenes?.length >= 3) return script;
  } catch (e) {
    console.log('script fell back to the story text:', e.message);
  }
  return fallback;
}

const months = ['जनवरी', 'फ़रवरी', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर'];
const d = story.deadline?.date && new Date(story.deadline.date);
const due = d ? `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}` : '';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const page = (scene, i, n) => `<!doctype html><html lang="hi"><head><meta charset="utf-8"><style>
@font-face { font-family: NSD; src: url('${process.cwd()}/node_modules/@fontsource/noto-serif-devanagari/files/noto-serif-devanagari-devanagari-700-normal.woff2'); font-weight: 700; }
@font-face { font-family: NSD; src: url('${process.cwd()}/node_modules/@fontsource/noto-serif-devanagari/files/noto-serif-devanagari-latin-700-normal.woff2'); font-weight: 700; unicode-range: U+0000-00FF; }
@font-face { font-family: Mukta; src: url('${process.cwd()}/node_modules/@fontsource/mukta/files/mukta-devanagari-600-normal.woff2'); font-weight: 600; }
@font-face { font-family: Mukta; src: url('${process.cwd()}/node_modules/@fontsource/mukta/files/mukta-latin-600-normal.woff2'); font-weight: 600; unicode-range: U+0000-00FF; }
* { margin: 0; box-sizing: border-box; }
body { width: 1080px; height: 1920px; background: #f4f1ea; font-family: Mukta, sans-serif; display: flex; flex-direction: column; padding: 150px 90px 220px; }
.top { display: flex; justify-content: space-between; align-items: center; }
.logo { font-family: NSD; font-size: 84px; font-weight: 700; color: #111; }
.logo b { color: #c8102e; }
.tag { background: ${colours[story.category] ?? '#3d434a'}; color: #fff; font-size: 44px; font-weight: 600; padding: 10px 34px; border-radius: 999px; }
.main { flex: 1; display: flex; align-items: center; }
h1 { font-family: NSD; font-weight: 700; color: #111; font-size: ${scene.screen.length > 60 ? 84 : 104}px; line-height: 1.3; }
body.hook { background: #c8102e; }
body.hook h1, body.hook .logo, body.hook .logo b, body.hook .foot { color: #fff; }
body.hook .tag { background: #fff; color: #c8102e; }
body.hook .dots span { background: rgba(255,255,255,0.45); }
body.hook .dots span.on { background: #fff; }
.due { background: #c8102e; color: #fff; font-size: 54px; font-weight: 600; padding: 28px 40px; border-radius: 28px; margin-bottom: 60px; }
.due b { color: #fff; }
body.hook .due { background: #fff; color: #111; }
body.hook .due b { color: #c8102e; }
.foot { display: flex; justify-content: space-between; align-items: center; font-size: 46px; font-weight: 600; color: #444; }
.dots span { display: inline-block; width: 22px; height: 22px; border-radius: 50%; background: #ccc; margin-left: 12px; }
.dots span.on { background: #c8102e; }
</style></head><body class="${i === 0 ? 'hook' : ''}">
<div class="top"><div class="logo">कस्बा<b>•</b></div><div class="tag">${sections[story.category] ?? ''}</div></div>
<div class="main"><h1>${esc(scene.screen)}</h1></div>
${due ? `<div class="due">आख़िरी तारीख़: <b>${due}</b></div>` : ''}
<div class="foot"><span>kasba.co.in</span><span class="dots">${Array.from({ length: n }, (_, k) => `<span class="${k === i ? 'on' : ''}"></span>`).join('')}</span></div>
</body></html>`;

const script = await writeScript();
console.log(JSON.stringify(script, null, 2));
const scenes = script.scenes.slice(0, 6);

const browser = await chromium.launch();
const tab = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
const parts = [];
for (const [i, scene] of scenes.entries()) {
  writeFileSync(`${out}s${i}.html`, page(scene, i, scenes.length));
  await tab.goto(`file://${process.cwd()}/${out}s${i}.html`);
  await tab.evaluate(() => document.fonts.ready);
  await tab.screenshot({ path: `${out}s${i}.png` });
  const voice = process.env.SHORT_VOICE ?? 'hi-IN-SwaraNeural';
  execFileSync('edge-tts', ['--voice', voice, `--rate=${process.env.SHORT_RATE ?? '+8%'}`, `--pitch=${process.env.SHORT_PITCH ?? '+0Hz'}`, '--text', scene.voice, '--write-media', `${out}s${i}.mp3`]);
  const secs = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', `${out}s${i}.mp3`]).toString()) + 0.35;
  // A slow push-in keeps a still card from feeling frozen.
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-loop', '1', '-i', `${out}s${i}.png`, '-i', `${out}s${i}.mp3`,
    '-filter_complex', `[0:v]scale=1188:2112,zoompan=z='min(zoom+0.0006,1.06)':d=${Math.ceil(secs * 30)}:s=1080x1920:fps=30,format=yuv420p[v];[1:a]apad[a]`,
    '-map', '[v]', '-map', '[a]', '-t', secs.toFixed(2), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-c:a', 'aac', '-ar', '44100', `${out}s${i}.mp4`]);
  parts.push(`s${i}.mp4`);
}
await browser.close();
writeFileSync(`${out}list.txt`, parts.map((p) => `file '${p}'`).join('\n'));
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', `${out}list.txt`, '-c', 'copy', '-movflags', '+faststart', `${out}short.mp4`]);
console.log('made', `${out}short.mp4`);

// Send to the editor only. Posting to YouTube/Instagram is a separate, later step.
if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
  const form = new FormData();
  form.append('chat_id', process.env.TELEGRAM_CHAT_ID.trim());
  form.append('caption', `🎬 नमूना शॉर्ट (कहीं पोस्ट नहीं हुआ) ${process.env.SHORT_LABEL ?? ''}\n${story.title}\nhttps://kasba.co.in/story/${story.storyId}`);
  form.append('supports_streaming', 'true');
  form.append('video', new Blob([readFileSync(`${out}short.mp4`)], { type: 'video/mp4' }), 'short.mp4');
  const res = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendVideo`, { method: 'POST', body: form });
  console.log('telegram', res.status, (await res.text()).slice(0, 200));
}
