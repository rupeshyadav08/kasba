// Turns one published story into a ~30-second vertical video (YouTube Shorts / Instagram Reels)
// and sends it to the editor on Telegram. scripts/youtube-upload.mjs posts it after the editor's OK.
// Usage: node scripts/make-short.mjs [storyId]   (default: a recent story without a Short yet)
// Needs ffmpeg, edge-tts (pip) and Playwright's Chromium. DEEPSEEK_API_KEY writes the script;
// without it the story's own title and key facts are read out.
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { parse } from 'yaml';
import { complete, parseJson } from '../pipeline/lib/llm.mjs';

const dir = 'src/content/stories/hi/';
// SHORT_OUT lets one run make several videos side by side (short/1/, short/2/, ...).
const out = process.env.SHORT_OUT ?? 'short/';
mkdirSync(out, { recursive: true });

const stories = readdirSync(dir).map((f) => parse(readFileSync(dir + f, 'utf8').split(/^---$/m)[1]));
stories.sort((a, b) => String(b.published).localeCompare(String(a.published)));
// Without an id: a story from the last 3 days that has not had a Short yet, those with an open
// deadline first (they are the ones people act on), then jobs and exams. pipeline/shorts.json remembers what was used.
const logFile = 'pipeline/shorts.json';
const used = new Set(existsSync(logFile) ? JSON.parse(readFileSync(logFile, 'utf8')).map((e) => e.storyId) : []);
const today = new Date().toISOString().slice(0, 10);
const fresh = stories.filter((s) => !used.has(s.storyId) && Date.now() - new Date(s.published) < 3 * 864e5);
// Only practical topics: on YouTube and Google, jobs, exams, deadlines and schemes are what
// people watch; ministry reviews and diplomatic news get no views (Kasba channel, Oct 2026).
const practical = fresh.filter((s) => ['jobs-exams', 'schemes', 'farming', 'money'].includes(s.category));
// Festival timing: in the 3 days before a festival (pipeline/festivals.json, 2027 dates approximate),
// a story that mentions it (holiday, special trains, ...) goes first. Reels that ride a festival get
// the most shares (seen on big Instagram channels, Nov 2026).
const festivals = existsSync('pipeline/festivals.json') ? JSON.parse(readFileSync('pipeline/festivals.json', 'utf8')) : [];
const festival = festivals.find((f) => f.date >= today && (Date.parse(f.date) - Date.parse(today)) / 864e5 <= 3);
const mentions = (s) => festival && festival.words.some((w) => `${s.title} ${s.summary}`.toLowerCase().includes(w.toLowerCase()));
const story = process.argv[2]
  ? stories.find((s) => s.storyId === process.argv[2])
  : fresh.find(mentions) ?? practical.find((s) => String(s.deadline?.date ?? '') >= today) ?? practical.find((s) => s.category === 'jobs-exams') ?? practical[0];
const festivalLine = festival && story && mentions(story) ? festival.name : '';
if (!story) {
  console.log(process.argv[2] ? `No story ${process.argv[2]}` : 'No new story for a Short');
  process.exit(process.argv[2] ? 1 : 0);
}
writeFileSync(logFile, JSON.stringify([...(existsSync(logFile) ? JSON.parse(readFileSync(logFile, 'utf8')) : []), { storyId: story.storyId, made: new Date().toISOString() }].slice(-200), null, 1) + '\n');

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
नियम: सिर्फ़ ख़बर में दिए तथ्य, कोई नया तथ्य या अंदाज़ा नहीं। ${process.env.SHORT_TONE === 'hinglish'
    ? 'रोज़ की Hinglish, जैसे भारत में आम लोग बोलते हैं: हिंदी शब्द देवनागरी में, और आम English शब्द Latin अक्षरों में (form, apply, last date, exam, session, fees, online, website, result, update)। भारी शुद्ध हिंदी शब्द बिल्कुल नहीं (आवेदन, सत्र, शुल्क, अंतिम तिथि, उपरोक्त, हेतु)। अंदाज़ आत्मविश्वास भरे एंकर का: छोटे, साफ़, सीधे वाक्य, "आप" से बात, शुरुआत एक तीखी लाइन से, बीच में पूर्ण विराम से ठहराव। screen पर भी यही Hinglish।'
    : process.env.SHORT_TONE === 'anchor'
    ? 'आत्मविश्वास भरे टीवी न्यूज़ एंकर की तरह: तेज़, साफ़, दमदार वाक्य। शुरुआत एक तीखे सवाल या दावे से ("22 नवंबर. याद रखिए यह तारीख़."), फिर सीधी बात। हर वाक्य छोटा और ठोस, बीच में पूर्ण विराम से ठहराव, आख़िर में एक मज़बूत लाइन।'
    : process.env.SHORT_TONE === 'calm'
    ? 'शांत, अपनापन भरी बोलचाल की हिंदी, जैसे कोई बड़ा भाई या दीदी प्यार से समझा रहे हों: छोटे वाक्य, "आप" से बात, कोई हड़बड़ी या शोर नहीं, विस्मय चिह्न नहीं। वाक्यों के बीच ठहराव के लिए "..." लगाओ।'
    : 'बोलचाल की हिंदी, जैसे कोई जानकार दोस्त जोश से बता रहा हो: छोटे वाक्य, सीधे "आप" से बात, बीच में "ध्यान दीजिए", "याद रखिए" जैसे शब्द, सवाल और विस्मय (!)।'}
अंक शब्दों में नहीं, अंकों में लिखो; अंग्रेज़ी नाम (JEE, NTA) वैसे ही।
हुक सबसे ज़रूरी है: लोग पहले 2 सेकंड में तय करते हैं कि रुकें या आगे बढ़ें। पहला दृश्य सीधे सबसे बड़ी बात से शुरू हो:
voice ज़्यादा से ज़्यादा 7 शब्द, screen 2-5 शब्द, कोई अंक/तारीख़/रकम हो तो वही (जैसे "22 नवंबर. आख़िरी मौक़ा." या "1,265 पोस्ट. Railway में भर्ती.")।
पहले दृश्य में "नमस्कार", चैनल का नाम, "आज की ख़बर", "जानिए" जैसी भूमिका बिल्कुल नहीं।${festivalLine ? ` यह ख़बर ${festivalLine} से जुड़ी है; हुक में ${festivalLine} का ज़िक्र करो, पर सिर्फ़ ख़बर के तथ्यों के साथ।` : ''}
फिर 2-3 दृश्य काम की बातें, आख़िरी दृश्य "पूरी ख़बर kasba.co.in पर"।
हर दृश्य: screen = स्क्रीन पर 3-8 शब्द, voice = 1-2 छोटे वाक्य। कुल voice 45-60 शब्द, ताकि वीडियो 30 सेकंड से छोटा रहे।
bg = स्टॉक वीडियो खोजने के लिए 2-3 English शब्द जो ख़बर के माहौल से मेल खाएँ (जैसे "students exam hall", "farmer field", "train railway"); किसी असली व्यक्ति का नाम नहीं।
सिर्फ़ JSON लौटाओ: {"bg":"...","scenes":[{"screen":"...","voice":"..."}]}`;
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
// Each scene is an animated page: words pop in one by one, numbers get a marker sweep, the
// deadline badge springs up, a progress bar runs along the top. Frames are captured by setting
// every CSS animation's clock, so the video is smooth whatever the machine's speed.
const fps = 30;
const font = (fam, file, w, range = '') => `@font-face { font-family: ${fam}; src: url('${process.cwd()}/node_modules/@fontsource/${file}'); font-weight: ${w}; ${range} }`;
const page = (scene, i, n, secs, start, total) => {
  const hook = i === 0;
  const last = i === n - 1;
  const words = scene.screen.split(/\s+/);
  // The hook has to read within 2 seconds: its words land almost together, the rest pop in one by one.
  const stagger = hook ? 0.06 : Math.min(0.22, (secs * 0.45) / words.length);
  const lead = hook ? 0 : 0.25;
  let marks = 0; // highlight at most two numbers, or the card turns yellow
  const h1 = words.map((w, k) => {
    const t = (lead + k * stagger).toFixed(2);
    const word = /\d/.test(w) && marks++ < 2 ? `<mark style="animation-delay:${(lead + words.length * stagger + 0.1).toFixed(2)}s">${esc(w)}</mark>` : esc(w);
    return `<span class="w" style="animation-delay:${t}s">${word}</span>`;
  }).join(' ');
  return `<!doctype html><html lang="hi"><head><meta charset="utf-8"><style>
${font('NSD', 'noto-serif-devanagari/files/noto-serif-devanagari-devanagari-700-normal.woff2', 700)}
${font('NSD', 'noto-serif-devanagari/files/noto-serif-devanagari-latin-700-normal.woff2', 700, 'unicode-range: U+0000-00FF;')}
${font('Mukta', 'mukta/files/mukta-devanagari-600-normal.woff2', 600)}
${font('Mukta', 'mukta/files/mukta-latin-600-normal.woff2', 600, 'unicode-range: U+0000-00FF;')}
* { margin: 0; box-sizing: border-box; }
body { width: 1080px; height: 1920px; overflow: hidden; font-family: Mukta, sans-serif; position: relative;
  background: ${footage ? (hook ? 'linear-gradient(180deg, rgba(200,16,46,0.55), rgba(120,8,26,0.85))' : 'linear-gradient(180deg, rgba(0,0,0,0.15), rgba(0,0,0,0.45))') : hook ? 'linear-gradient(160deg, #e0193a, #a50d26)' : 'linear-gradient(170deg, #fbf8f2, #efe9dc)'};
  color: ${hook || footage ? '#fff' : '#111'}; }
${footage ? '.blob { display: none; } .logo, .foot { color: #fff; text-shadow: 0 2px 12px rgba(0,0,0,0.5); } .cap { color: #fff !important; background: rgba(0,0,0,0.55) !important; }' + (hook ? '' : ' .card { color: #111; }') : ''}
.blob { position: absolute; width: 900px; height: 900px; border-radius: 50%; right: -380px; top: -260px;
  background: ${hook ? 'rgba(255,255,255,0.08)' : colours[story.category] ?? '#3d434a'}; opacity: ${hook ? 1 : 0.07};
  animation: drift ${secs}s linear both; }
.blob.b2 { width: 600px; height: 600px; left: -300px; top: auto; bottom: -200px; right: auto; animation-direction: reverse; }
@keyframes drift { from { transform: translate(0, 0) scale(1); } to { transform: translate(-60px, 80px) scale(1.12); } }
.bar { position: absolute; left: 0; top: 0; height: 12px; background: ${hook ? '#fff' : '#c8102e'}; width: 1080px; transform-origin: left;
  animation: bar ${secs}s linear both; }
@keyframes bar { from { transform: scaleX(${(start / total).toFixed(4)}); } to { transform: scaleX(${((start + secs) / total).toFixed(4)}); } }
.wrap { position: absolute; inset: 0; padding: 150px 90px 200px; display: flex; flex-direction: column; }
.top { display: flex; justify-content: space-between; align-items: center; animation: fade 0.5s ease-out both; }
.logo { font-family: NSD; font-size: 84px; font-weight: 700; }
.logo b { color: ${hook ? '#fff' : '#c8102e'}; display: inline-block; animation: drop 0.7s cubic-bezier(.3,1.6,.5,1) 0.2s both; }
@keyframes drop { from { transform: translateY(-120px); opacity: 0; } to { transform: none; opacity: 1; } }
.tag { background: ${hook ? '#fff' : colours[story.category] ?? '#3d434a'}; color: ${hook ? '#c8102e' : '#fff'}; font-size: 44px; font-weight: 600;
  padding: 10px 34px; border-radius: 999px; animation: slideL 0.6s cubic-bezier(.2,1.3,.4,1) 0.1s both; }
@keyframes slideL { from { transform: translateX(300px); opacity: 0; } to { transform: none; opacity: 1; } }
.main { flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 48px; }
.cap { font-size: 46px; line-height: 1.45; font-weight: 600; color: ${hook ? '#fff' : '#333'}; background: ${hook ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.7)'};
  padding: 24px 32px; border-radius: 24px; animation: fade 0.4s ease-out 0.5s both; }
.card { ${hook ? '' : 'background: #fff; border-radius: 40px; padding: 70px 64px; box-shadow: 0 30px 80px rgba(0,0,0,0.10); border-left: 16px solid ' + (colours[story.category] ?? '#3d434a') + ';'}
  animation: cardIn 0.6s cubic-bezier(.2,1.2,.4,1) both; width: 100%; }
@keyframes cardIn { from { transform: translateX(${hook ? 0 : 140}px) scale(${hook ? 0.92 : 1}); opacity: 0; } to { transform: none; opacity: 1; } }
h1 { font-family: NSD; font-weight: 700; font-size: ${scene.screen.length > 60 ? 84 : hook ? 132 : 96}px; line-height: 1.3; }
${hook ? `.top { visibility: hidden; } .card { animation: punch 0.35s cubic-bezier(.2,1.4,.4,1) both, zoom ${secs}s linear 0.35s both; }
@keyframes punch { from { transform: scale(1.35); opacity: 0.2; } to { transform: none; opacity: 1; } }
@keyframes zoom { to { transform: scale(1.06); } }` : ''}
.w { display: inline-block; animation: pop 0.45s cubic-bezier(.2,1.6,.4,1) both; }
@keyframes pop { from { transform: translateY(40px) scale(0.6); opacity: 0; } to { transform: none; opacity: 1; } }
mark { color: inherit; padding: 0 10px; border-radius: 10px; background-image: linear-gradient(${hook ? '#ffd23f, #ffd23f' : '#ffe27a, #ffe27a'}); background-repeat: no-repeat; background-position: left center;
  ${hook ? 'color: #111;' : ''} animation: sweep 0.5s ease-out both; }
@keyframes sweep { from { background-size: 0% 100%; } to { background-size: 100% 100%; } }
.due { align-self: flex-start; background: ${hook ? '#fff' : '#c8102e'}; color: ${hook ? '#111' : '#fff'}; font-size: 54px; font-weight: 600; padding: 26px 40px;
  border-radius: 28px; margin-bottom: 50px; animation: rise 0.7s cubic-bezier(.2,1.5,.4,1) ${Math.min(1.2, secs * 0.4).toFixed(2)}s both, pulse 1.6s ease-in-out ${(Math.min(1.2, secs * 0.4) + 0.8).toFixed(2)}s infinite; }
.due b { color: ${hook ? '#c8102e' : '#fff'}; }
@keyframes rise { from { transform: translateY(160px); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes pulse { 50% { transform: scale(1.04); } }
.foot { display: flex; justify-content: space-between; align-items: center; font-size: 46px; font-weight: 600; opacity: 0.85; }
.follow { font-size: 60px; font-weight: 600; background: #c8102e; color: #fff; padding: 22px 46px; border-radius: 999px; align-self: center; margin-bottom: 60px;
  animation: rise 0.7s cubic-bezier(.2,1.5,.4,1) 0.6s both, pulse 1.2s ease-in-out 1.4s infinite; }
@keyframes fade { from { opacity: 0; } to { opacity: 1; } }
</style></head><body>
<div class="blob"></div><div class="blob b2"></div><div class="bar"></div>
<div class="wrap">
<div class="top"><div class="logo">कस्बा<b>•</b></div><div class="tag">${sections[story.category] ?? ''}</div></div>
<div class="main"><div class="card"><h1>${h1}</h1></div><div class="cap">${esc(scene.voice.replace(/\.\.\./g, ','))}</div></div>
${last ? '<div class="follow">🔔 फ़ॉलो करें</div>' : due ? `<div class="due">📅 ${process.env.SHORT_TONE === 'hinglish' ? 'Last date' : 'आख़िरी तारीख़'}: <b>${due}</b></div>` : ''}
<div class="foot"><span>kasba.co.in</span><span>${i + 1}/${n}</span></div>
</div></body></html>`;
};

const script = await writeScript();
console.log(JSON.stringify(script, null, 2));
const scenes = script.scenes.slice(0, 5);

// Voice first: each scene lasts as long as its narration plus a short breath.
// Sarvam's Bulbul voices (made for Indian languages and Hinglish) when SARVAM_API_KEY is set,
// otherwise Microsoft's free Edge voice.
const voice = process.env.SHORT_VOICE ?? 'hi-IN-SwaraNeural';
async function speak(text, file) {
  if (process.env.SARVAM_API_KEY) {
    const res = await fetch('https://api.sarvam.ai/text-to-speech', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-subscription-key': process.env.SARVAM_API_KEY },
      body: JSON.stringify({
        text: text.replace(/\.\.\./g, ','), language_code: 'hi-IN', model: process.env.SARVAM_MODEL ?? 'bulbul:v4-flash',
        speaker: process.env.SARVAM_SPEAKER ?? 'simran_hi_news', pace: Number(process.env.SARVAM_PACE ?? 1.05), speech_sample_rate: 24000,
      }),
    });
    if (res.ok) {
      writeFileSync(file.replace(/\.mp3$/, '.wav'), Buffer.from((await res.json()).audios[0], 'base64'));
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', file.replace(/\.mp3$/, '.wav'), file]);
      return;
    }
    console.log('sarvam', res.status, (await res.text()).slice(0, 300), '- using the Edge voice');
  }
  execFileSync('edge-tts', ['--voice', voice, `--rate=${process.env.SHORT_RATE ?? '+8%'}`, `--pitch=${process.env.SHORT_PITCH ?? '+0Hz'}`, '--text', text, '--write-media', file]);
}
const durations = [];
for (const [i, scene] of scenes.entries()) {
  await speak(scene.voice, `${out}s${i}.mp3`);
  durations.push(Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', `${out}s${i}.mp3`]).toString()) + 0.45);
}
// 15-30 seconds: past 30 s, drop middle scenes (never the hook or the closing line).
while (durations.reduce((a, b) => a + b, 0) > 30 && scenes.length > 3) {
  const k = scenes.length - 2;
  scenes.splice(k, 1);
  durations.splice(k, 1);
  for (let j = k; j < scenes.length; j++) execFileSync('mv', [`${out}s${j + 1}.mp3`, `${out}s${j}.mp3`]);
}
const total = durations.reduce((a, b) => a + b, 0);

// Background footage from Pixabay (free for commercial use, no credit needed). Real stock clips
// set the mood only; they never pretend to show the event itself.
const topics = { schemes: 'india village', 'jobs-exams': 'students exam', farming: 'farmer field', money: 'money coins', weather: 'rain clouds', health: 'hospital doctor', sports: 'stadium sport', nation: 'india city' };
async function findFootage() {
  if (!process.env.PIXABAY_API_KEY) return null;
  for (const q of [script.bg, topics[story.category]].filter(Boolean)) {
    const res = await fetch(`https://pixabay.com/api/videos/?key=${process.env.PIXABAY_API_KEY}&q=${encodeURIComponent(q)}&video_type=film&safesearch=true&per_page=20`);
    if (!res.ok) { console.log('pixabay', res.status); continue; }
    const hits = (await res.json()).hits.filter((h) => h.duration >= 6);
    if (!hits.length) continue;
    const pick = hits[[...story.storyId].reduce((a, c) => a + c.charCodeAt(0), 0) % Math.min(hits.length, 8)];
    const v = pick.videos.large?.url ? pick.videos.large : pick.videos.medium;
    writeFileSync(`${out}bg.mp4`, Buffer.from(await (await fetch(v.url)).arrayBuffer()));
    console.log('footage', q, pick.pageURL);
    return `${out}bg.mp4`;
  }
  return null;
}
const footage = process.env.SHORT_FOOTAGE || await findFootage(); // SHORT_FOOTAGE: use a local clip instead

const browser = await chromium.launch();
const tab = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
const parts = [];
let start = 0;
for (const [i, scene] of scenes.entries()) {
  const secs = durations[i];
  writeFileSync(`${out}s${i}.html`, page(scene, i, scenes.length, secs, start, total));
  await tab.goto(`file://${process.cwd()}/${out}s${i}.html`);
  await tab.evaluate(() => document.fonts.ready);
  await tab.evaluate(() => document.getAnimations().forEach((a) => a.pause()));
  const frames = Math.ceil(secs * fps);
  // With footage, frames are transparent PNGs laid over the clip (cropped to 9:16, looped).
  const inputs = ['-f', 'image2pipe', '-framerate', String(fps), '-i', '-',
    ...(footage ? ['-stream_loop', '-1', '-ss', (start % 5).toFixed(2), '-i', footage] : []), '-i', `${out}s${i}.mp3`];
  const graph = footage
    ? `[1:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=${fps}[bg];[bg][0:v]overlay=0:0[v];[2:a]apad[a]`
    : '[0:v]null[v];[1:a]apad[a]';
  const enc = spawn('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', graph, '-map', '[v]', '-map', '[a]',
    '-t', secs.toFixed(3), '-pix_fmt', 'yuv420p', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-c:a', 'aac', '-ar', '44100', `${out}s${i}.mp4`], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((ok, fail) => enc.on('close', (c) => (c ? fail(new Error(`ffmpeg ${c}`)) : ok())));
  for (let f = 0; f < frames; f++) {
    await tab.evaluate((ms) => document.getAnimations().forEach((a) => { a.currentTime = ms; }), (f * 1000) / fps);
    const jpg = footage ? await tab.screenshot({ type: 'png', omitBackground: true }) : await tab.screenshot({ type: 'jpeg', quality: 88 });
    if (!enc.stdin.write(jpg)) await new Promise((r) => enc.stdin.once('drain', r));
  }
  enc.stdin.end();
  await done;
  parts.push(`s${i}.mp4`);
  start += secs;
}
await browser.close();
writeFileSync(`${out}list.txt`, parts.map((p) => `file '${p}'`).join('\n'));
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', `${out}list.txt`, '-c', 'copy', '-movflags', '+faststart', `${out}short.mp4`]);
console.log('made', `${out}short.mp4`, total.toFixed(1), 's');

// YouTube/Instagram text, kept with the video so the upload job can use it after the editor's OK.
const link = `https://kasba.co.in/story/${story.storyId}`;
const title = story.title.length > 88 ? `${story.title.slice(0, 86)}…` : story.title;
writeFileSync(`${out}meta.json`, JSON.stringify({
  storyId: story.storyId,
  title: `${title} #Shorts`,
  description: [story.summary, '', `पूरी ख़बर: ${link}`, `स्रोत: ${story.source.name} ${story.source.url}`, '',
    'आवाज़ AI से बनी है; पीछे के दृश्य स्टॉक वीडियो (Pixabay) हैं, घटना के असली दृश्य नहीं।',
    `#Shorts #कस्बा #${sections[story.category]?.replace(/[^\p{L}\p{M}]/gu, '') ?? 'ख़बर'}`].join('\n'),
  tags: ['Kasba', 'कस्बा', 'Hindi news', sections[story.category]].filter(Boolean),
}, null, 1));

// Goes to the editor first, in the Shorts group once there is one (pipeline/state.json).
function shortsChat() {
  const state = existsSync('pipeline/state.json') ? JSON.parse(readFileSync('pipeline/state.json', 'utf8')) : {};
  return state.shortsChat ?? process.env.TELEGRAM_CHAT_ID.trim();
}
// With SHORT_ASK (the run id) the video carries Post/Skip buttons; a Post
// tap makes the site's Telegram webhook start the upload job for this run.
if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
  const ask = process.env.SHORT_ASK;
  const form = new FormData();
  form.append('chat_id', String(shortsChat()));
  form.append('caption', `${ask ? '🎬 नया शॉर्ट: YouTube पर डालें?' : `🎬 नमूना शॉर्ट (कहीं पोस्ट नहीं हुआ) ${process.env.SHORT_LABEL ?? ''}`}\n${story.title}\n${link}`);
  form.append('supports_streaming', 'true');
  if (ask) form.append('reply_markup', JSON.stringify({ inline_keyboard: [[{ text: '✅ पोस्ट करें', callback_data: `y:${ask}` }, { text: '❌ छोड़ें', callback_data: `n:${ask}` }]] }));
  form.append('video', new Blob([readFileSync(`${out}short.mp4`)], { type: 'video/mp4' }), 'short.mp4');
  const res = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendVideo`, { method: 'POST', body: form });
  console.log('telegram', res.status, (await res.text()).slice(0, 200));
}
