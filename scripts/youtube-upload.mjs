// Uploads a Short (short.mp4 + meta.json in SHORT_DIR) to the Kasba YouTube channel, then tells
// the editor on Telegram. Run by .github/workflows/short.yml after the editor taps Post.
// Secrets: YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN (one-time Google sign-in for the channel).
// YouTube keeps uploads from an app it has not audited yet private, whatever we ask for here.
import { existsSync, readFileSync, statSync } from 'node:fs';

// SHORT_DIR: which of the run's videos (short/1/, short/2/, ...); older runs kept one in short/.
const dir = process.env.SHORT_DIR ?? 'short/';
const meta = JSON.parse(readFileSync(`${dir}meta.json`, 'utf8'));
const file = `${dir}short.mp4`;

// Replies go where the video was sent: the Shorts group if there is one, else the editor's chat.
const state = existsSync('pipeline/state.json') ? JSON.parse(readFileSync('pipeline/state.json', 'utf8')) : {};
async function tell(text) {
  if (!process.env.TELEGRAM_BOT_TOKEN) return;
  await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: String(state.shortsChat ?? process.env.TELEGRAM_CHAT_ID).trim(), text, disable_web_page_preview: true }),
  });
}

if (!process.env.YT_REFRESH_TOKEN) {
  await tell(`⚠️ YouTube अभी जुड़ा नहीं है, इसलिए यह शॉर्ट पोस्ट नहीं हुआ:\n${meta.title}`);
  process.exit(0);
}

const token = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  body: new URLSearchParams({
    client_id: process.env.YT_CLIENT_ID, client_secret: process.env.YT_CLIENT_SECRET,
    refresh_token: process.env.YT_REFRESH_TOKEN, grant_type: 'refresh_token',
  }),
}).then((r) => r.json());
if (!token.access_token) {
  await tell('⚠️ YouTube ने लॉगिन नहीं माना (टोकन दोबारा बनाना होगा)। शॉर्ट पोस्ट नहीं हुआ।');
  throw new Error(`token: ${JSON.stringify(token)}`);
}

// Resumable upload: first the video's details, then the file to the URL YouTube hands back.
const publishAt = process.env.YT_PUBLISH_AT || '';
const size = statSync(file).size;
const start = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json; charset=UTF-8',
    'X-Upload-Content-Type': 'video/mp4', 'X-Upload-Content-Length': String(size),
  },
  body: JSON.stringify({
    snippet: {
      title: meta.title, description: meta.description, tags: meta.tags,
      categoryId: meta.categoryId ?? '25', defaultLanguage: meta.lang ?? 'hi', defaultAudioLanguage: meta.lang ?? 'hi',
    },
    // The voice is AI-made, which YouTube asks channels to declare. YT_PUBLISH_AT (ISO time) uploads
    // it private and lets YouTube make it public at that moment.
    status: {
      privacyStatus: publishAt ? 'private' : process.env.YT_PRIVACY ?? 'public',
      ...(publishAt && { publishAt }),
      selfDeclaredMadeForKids: false, containsSyntheticMedia: true,
    },
  }),
});
if (!start.ok) {
  await tell(`⚠️ YouTube upload शुरू नहीं हुआ (${start.status})।`);
  throw new Error(`start ${start.status}: ${await start.text()}`);
}
const put = await fetch(start.headers.get('location'), {
  method: 'PUT', headers: { 'Content-Type': 'video/mp4', 'Content-Length': String(size) }, body: readFileSync(file),
});
const video = await put.json();
if (!put.ok) {
  await tell(`⚠️ YouTube upload अधूरा रहा (${put.status})।`);
  throw new Error(`upload ${put.status}: ${JSON.stringify(video)}`);
}
console.log('youtube', video.id, video.status?.privacyStatus);
const locked = !publishAt && video.status?.privacyStatus === 'private' && (process.env.YT_PRIVACY ?? 'public') !== 'private';
const when = publishAt ? `\n🕒 Public at ${new Date(publishAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })} IST` : '';
await tell(`▶️ YouTube पर पहुँच गया: https://youtube.com/shorts/${video.id}${when}${locked
  ? '\nअभी Private है (YouTube की मंज़ूरी बाकी)। YouTube Studio में Public कर दें।' : ''}`);
