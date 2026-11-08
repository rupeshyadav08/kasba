// Channel housekeeping for the Kasba YouTube channel, run by .github/workflows/youtube-tools.yml.
// ACTION=check   : which permissions the saved sign-in has, the channel's details, and every upload
//                  with its visibility and views. Changes nothing.
// ACTION=archive : sets every public or unlisted upload to private (reversible in YouTube Studio).
// ACTION=channel : sets the channel's title/description/keywords from CH_TITLE, CH_DESCRIPTION,
//                  CH_KEYWORDS (blank ones are left as they are).
// Secrets: YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN (same sign-in youtube-upload.mjs uses).
const action = process.env.ACTION ?? 'check';
const api = 'https://www.googleapis.com/youtube/v3';

const token = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  body: new URLSearchParams({
    client_id: process.env.YT_CLIENT_ID, client_secret: process.env.YT_CLIENT_SECRET,
    refresh_token: process.env.YT_REFRESH_TOKEN, grant_type: 'refresh_token',
  }),
}).then((r) => r.json());
if (!token.access_token) throw new Error(`token: ${JSON.stringify(token)}`);
const auth = { Authorization: `Bearer ${token.access_token}` };
console.log('scopes:', token.scope);

async function yt(path, init = {}) {
  const res = await fetch(`${api}/${path}`, { ...init, headers: { ...auth, 'Content-Type': 'application/json', ...init.headers } });
  const body = await res.json();
  if (!res.ok) throw new Error(`${path}: ${res.status} ${JSON.stringify(body.error?.message ?? body)}`);
  return body;
}

const channel = (await yt('channels?part=snippet,brandingSettings,contentDetails,statistics&mine=true')).items[0];
console.log('channel:', channel.id, JSON.stringify(channel.snippet.title), channel.snippet.customUrl, JSON.stringify(channel.statistics));
console.log('description:', JSON.stringify(channel.brandingSettings?.channel?.description ?? ''));
console.log('keywords:', JSON.stringify(channel.brandingSettings?.channel?.keywords ?? ''));

// Every upload, newest first.
const ids = [];
let page = '';
do {
  const list = await yt(`playlistItems?part=contentDetails&maxResults=50&playlistId=${channel.contentDetails.relatedPlaylists.uploads}${page && `&pageToken=${page}`}`);
  ids.push(...list.items.map((i) => i.contentDetails.videoId));
  page = list.nextPageToken ?? '';
} while (page);
const videos = [];
for (let i = 0; i < ids.length; i += 50) {
  videos.push(...(await yt(`videos?part=snippet,status,statistics,contentDetails&id=${ids.slice(i, i + 50).join(',')}`)).items);
}
let total = 0;
for (const v of videos) {
  total += Number(v.statistics.viewCount ?? 0);
  console.log([v.id, v.snippet.publishedAt, v.status.privacyStatus, v.statistics.viewCount ?? 0, v.statistics.likeCount ?? 0, v.contentDetails.duration, v.snippet.title].join('\t'));
}
console.log(`uploads: ${videos.length}, total views: ${total}`);

if (action === 'archive') {
  let done = 0;
  for (const v of videos.filter((x) => x.status.privacyStatus !== 'private')) {
    await yt('videos?part=status', { method: 'PUT', body: JSON.stringify({ id: v.id, status: { ...v.status, privacyStatus: 'private' } }) });
    done += 1;
  }
  console.log(`archived (set to private): ${done}`);
}

if (action === 'channel') {
  const ch = { ...channel.brandingSettings.channel };
  if (process.env.CH_TITLE) ch.title = process.env.CH_TITLE;
  if (process.env.CH_DESCRIPTION) ch.description = process.env.CH_DESCRIPTION;
  if (process.env.CH_KEYWORDS) ch.keywords = process.env.CH_KEYWORDS;
  await yt('channels?part=brandingSettings', { method: 'PUT', body: JSON.stringify({ id: channel.id, brandingSettings: { channel: ch } }) });
  console.log('channel updated:', JSON.stringify(ch.title));
}
