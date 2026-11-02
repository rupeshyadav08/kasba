// Kasba news pipeline. One run does two things:
//   1. applies the editor's Approve / Reject / Remove taps from Telegram (publishes approved stories)
//   2. checks the official feeds for new notices and drafts the useful ones. Routine notices from
//      sources marked "auto" are published straight away (the editor can remove them); anything
//      sensitive, scanned, a court record or from other sources goes to the editor for approval
// State (seen links, Telegram offset) and pending drafts are files in pipeline/, committed by the workflow.
// With PIPELINE_MODE=india (the runner on a machine in India) it only drafts from the sources marked
// "india" (sites that refuse GitHub's servers), keeps its own state file, and leaves Telegram taps
// to the main run.
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dateFromLink, get, noticeText, parsePage, parseRss } from './lib/feeds.mjs';
import { complete, parseJson } from './lib/llm.mjs';
import { systemPrompt, userPrompt } from './lib/prompt.mjs';
import { check, districtSlugs, publish, unpublish } from './lib/story.mjs';
import * as tg from './lib/telegram.mjs';

const here = (p) => new URL(p, import.meta.url);
const readJson = (p) => JSON.parse(readFileSync(here(p), 'utf8'));
const writeJson = (p, v) => writeFileSync(here(p), JSON.stringify(v, null, 2) + '\n');

const config = readJson('config.json');
const india = process.env.PIPELINE_MODE === 'india';
const sources = readJson('sources.json').filter((s) => Boolean(s.india) === india);
const stateFile = india ? 'state-india.json' : 'state.json';
const state = existsSync(here(stateFile)) ? readJson(stateFile) : { seen: {}, telegramOffset: 0 };
const dryRun = process.env.DRY_RUN === 'true';
// Notices readers rush to (the same words the result watcher looks for).
const URGENT = /result|admit|hall ?ticket|answer ?key|merit|cut ?off|परिणाम|रिजल्ट|प्रवेश ?पत्र|उत्तर ?कुंजी|मेरिट/i;
const summary = { telegramUpdates: 0, published: [], autoPublished: [], urgentPublished: [], removed: [], rejected: [], drafted: [], skipped: [], errors: [] };

const draftPath = (id) => here(`drafts/${id}.json`);
const draftIds = () => readdirSync(here('drafts/')).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5));
const site = 'https://kasba.co.in';
const devanagariShare = (t) => (t.match(/[\u0900-\u097F]/g)?.length ?? 0) / Math.max(1, (t.match(/\p{L}/gu)?.length ?? 0));

// Links the editor sends to the bot are drafted in this run, if they are official.
const official = /(^|\.)(gov\.in|nic\.in|rbi\.org\.in|nta\.ac\.in|upmsp\.edu\.in|allahabadhighcourt\.in|sansad\.in|ecourts\.gov\.in)$/i;
const manual = [];

// 1. Editor's decisions.
// Taps arrive two ways: saved in pipeline/inbox/ by the site's webhook (functions/api/telegram.js),
// or, until the webhook is on, polled from Telegram. Polling lost every tap from 22 to 24 Oct to
// something else reading the bot, which is why the webhook exists.
const inboxDir = here('inbox/');
async function readUpdates() {
  const inbox = existsSync(inboxDir) ? readdirSync(inboxDir).filter((f) => f.endsWith('.json')) : [];
  const saved = inbox.map((f) => JSON.parse(readFileSync(new URL(f, inboxDir), 'utf8')));
  let polled = [];
  try {
    polled = await tg.updates(state.telegramOffset);
  } catch (e) {
    // 409 means the webhook is on, so there is nothing to poll.
    if (!/conflict/i.test(e.message)) throw e;
  }
  for (const u of polled) state.telegramOffset = Math.max(state.telegramOffset, u.update_id + 1);
  summary.telegramUpdates = saved.length + polled.length;
  const seen = new Set();
  const list = [...saved, ...polled].sort((a, b) => a.update_id - b.update_id).filter((u) => !seen.has(u.update_id) && seen.add(u.update_id));
  return { list, done: () => inbox.forEach((f) => rmSync(new URL(f, inboxDir))) };
}

// Turns the webhook on once the site says it can take updates; until then polling carries on.
async function ensureWebhook() {
  try {
    const info = await tg.webhookInfo();
    if (info.url) return;
    const ready = await fetch(`${site}/api/telegram`).then((r) => r.json()).catch(() => ({}));
    if (!ready.ready) return;
    await tg.setWebhook(`${site}/api/telegram`);
    summary.webhook = 'turned on';
  } catch (e) {
    summary.errors.push(`webhook: ${e.message}`);
  }
}

async function applyDecisions() {
  const { list, done } = await readUpdates();
  for (const u of list) {
    const msg = u.message;
    // Any message from the editor in a group makes that group the home for Shorts, so the videos
    // don't get lost among the story drafts (scripts/make-short.mjs reads state.shortsChat).
    if (msg && /group/.test(msg.chat?.type) && String(msg.from?.id) === tg.editorChat()) {
      if (state.shortsChat !== msg.chat.id) {
        state.shortsChat = msg.chat.id;
        await tg.sendTo(msg.chat.id, '✅ अब नए शॉर्ट्स इसी ग्रुप में आएँगे।');
      }
      continue;
    }
    if (msg && String(msg.chat?.id) === tg.editorChat()) {
      for (const url of String(msg.text ?? '').match(/https?:\/\/\S+/g) ?? []) {
        let host = '';
        try { host = new URL(url).hostname; } catch {}
        if (official.test(host)) manual.push({ title: url, link: url, description: '', date: null, name: host, sourceId: 'editor', lang: 'hi' });
        else await tg.send(`यह लिंक सरकारी स्रोत का नहीं लगता, इसलिए छोड़ दिया: ${tg.esc(url)}`);
      }
      continue;
    }
    const cb = u.callback_query;
    if (!cb) continue;
    if (String(cb.from?.id) !== tg.editorChat()) { await tg.answer(cb.id, 'Not allowed'); continue; }
    const [action, id] = String(cb.data).split(':');
    if (action === 'u') {
      await tg.clearButtons(cb.message.chat.id, cb.message.message_id);
      const gone = unpublish(id);
      if (gone) summary.removed.push(id);
      await tg.answer(cb.id, gone ? '🗑 हटाया जा रहा है' : 'यह ख़बर पहले ही हटाई जा चुकी है');
      if (gone) await tg.send(`🗑 साइट से हटाया गया: ${tg.esc(id)}\n(साइट 2-3 मिनट में अपडेट होगी)`);
      continue;
    }
    if (!existsSync(draftPath(id))) { await tg.answer(cb.id, 'यह ड्राफ़्ट अब मौजूद नहीं है'); continue; }
    const draft = JSON.parse(readFileSync(draftPath(id), 'utf8'));
    await tg.clearButtons(cb.message.chat.id, cb.message.message_id);
    if (action === 'a') {
      const storyId = await publish(draft, config.author);
      summary.published.push(storyId);
      await tg.answer(cb.id, '✅ मंज़ूर, अगले अपडेट में साइट पर');
      await tg.send(`✅ प्रकाशित: <b>${tg.esc(draft.story.hi.title)}</b>\n${site}/story/${storyId}\n(अगले अपडेट में साइट पर)`);
    } else {
      summary.rejected.push(id);
      await tg.answer(cb.id, '❌ हटाया गया');
      await tg.send(`❌ हटाया गया: ${tg.esc(draft.story.hi.title)}`);
    }
    rmSync(draftPath(id));
  }
  done();
}

// Old drafts nobody acted on are dropped so the queue stays short.
function expireDrafts() {
  const cutoff = Date.now() - config.draftExpiryDays * 86400e3;
  for (const id of draftIds()) {
    const d = JSON.parse(readFileSync(draftPath(id), 'utf8'));
    if (Date.parse(d.createdAt) < cutoff) rmSync(draftPath(id));
  }
}

// 2. New notices.
const knownSources = new Set(); // sources whose feed has a link seen before
async function newItems() {
  const items = [];
  for (const src of sources) {
    try {
      const body = await get(src.url);
      const feed = src.type === 'page' ? parsePage(body, src.url, src.linkPattern) : parseRss(body);
      if (feed.some((it) => state.seen[it.link])) knownSources.add(src.id);
      for (const it of feed) if (!state.seen[it.link]) items.push({ ...it, name: src.name, sourceId: src.id, lang: src.lang, kind: src.kind });
    } catch (e) {
      summary.errors.push(`${src.id}: ${e.message}`);
    }
  }
  return items;
}

function draftMessage(id, d) {
  const s = d.story.hi;
  const lines = [
    `${d.story.storyType === 'record' ? '⚖️ <b>रिकॉर्ड से</b>' : '📝 <b>नया ड्राफ़्ट</b>'} · ${tg.esc(d.story.category)}${d.story.state ? ' · UP' : ''}`,
    '',
    ...(d.ocr ? ['⚠️ स्कैन किए गए PDF से पढ़ा गया: तारीख़ें और आँकड़े मूल सूचना से ज़रूर मिलाएँ।', ''] : []),
    `<b>${tg.esc(s.title)}</b>`,
    tg.esc(s.summary),
    '',
    `<b>आपके लिए:</b> ${tg.esc(s.meaning)}`,
    '',
    ...s.keyFacts.map((f) => `• ${tg.esc(f)}`),
    ...(d.story.deadline ? ['', `⏰ आख़िरी तारीख़: ${tg.esc(d.story.deadline.date)}`] : []),
    '', `📏 पूरी ख़बर: ${s.body.trim().split(/\s+/).length} शब्द, ${s.faq.length} सवाल-जवाब`,
    '',
    `EN: ${tg.esc(d.story.en.title)}`,
    `स्रोत: ${tg.esc(d.source.name)}, <a href="${tg.esc(d.source.link)}">मूल सूचना</a>`,
  ];
  return lines.join('\n').slice(0, 4000);
}

async function draftNew() {
  let items = await newItems();
  // A source's first run: everything in its feed is already old news. Remember it all and
  // check only its newest few notices, so a new source never floods the desk with its archive.
  // (Older states have no list of started sources: a source counts as started if any of its
  // current links was seen before.)
  const started = (state.sources ??= [...knownSources]);
  const fresh = new Set(sources.map((s) => s.id).filter((id) => !started.includes(id) && items.some((i) => i.sourceId === id)));
  if (fresh.size) {
    const newest = [...fresh].flatMap((id) => items.filter((i) => i.sourceId === id).slice(0, config.firstRunPerSource));
    for (const i of items) if (fresh.has(i.sourceId) && !newest.includes(i)) state.seen[i.link] = new Date().toISOString().slice(0, 10);
    items = items.filter((i) => !fresh.has(i.sourceId) || newest.includes(i));
    started.push(...fresh);
  }
  // Links the editor sent come first; they skip the "seen" check because the editor asked.
  items = [...manual, ...items].slice(0, config.maxItemsCheckedPerRun);
  const provider = config.provider;
  const model = config.models[provider];
  const system = systemPrompt(districtSlugs());
  let drafted = 0;
  for (const it of items) {
    if (drafted >= config.maxDraftsPerRun) break;
    state.seen[it.link] = new Date().toISOString().slice(0, 10);
    try {
      let text = it.description;
      let ocr = false;
      try {
        const notice = await noticeText(it.link);
        // RBI answers foreign servers with a CAPTCHA page; the feed's own description is then the better text.
        if (!/captcha/i.test(notice.text) || notice.text.length > 5 * text.length) ({ text, ocr } = notice);
        text = text.slice(0, 12000);
      } catch (e) { summary.errors.push(`notice ${it.link}: ${e.message}`); }
      // Too little to write from, or a Hindi PDF in an old non-Unicode font that extracts as gibberish:
      // hold it back rather than let the model guess.
      if (!text || text.length < 200 || (it.lang === 'hi' && it.sourceId !== 'editor' && devanagariShare(text) < 0.3)) {
        summary.skipped.push(`${it.sourceId}: ${!text || text.length < 200 ? `only ${text?.length ?? 0} characters of text` : 'Hindi text not readable (old font)'} (${it.link})`);
        if (it.sourceId === 'editor' && !dryRun) await tg.send(`इस लिंक से सूचना का पाठ नहीं पढ़ पाया: ${tg.esc(it.link)}`);
        continue;
      }
      const { text: reply } = await complete({ provider, model, system, user: userPrompt({ ...it, text }) });
      const story = parseJson(reply);
      if (!story.relevant && it.sourceId !== 'editor') { summary.skipped.push(`${it.sourceId}: not relevant, ${story.reason ?? 'no reason given'} (${it.link})`); continue; }
      if (!story.relevant) { await tg.send(`AI के हिसाब से यह आम पाठकों के काम की सूचना नहीं है: ${tg.esc(story.reason ?? '')}`); continue; }
      // Listing pages also link to old, undated documents; only recent notices are news.
      // A date in the file name (Reminder_21102026.pdf) is more reliable than one read by OCR.
      if (ocr && dateFromLink(it.link)) story.sourceDate = dateFromLink(it.link);
      story.sourceDate ??= dateFromLink(it.link);
      const ageDays = story.sourceDate ? (Date.now() - Date.parse(story.sourceDate)) / 86400e3 : NaN;
      if (it.sourceId !== 'editor' && !(ageDays <= config.maxNoticeAgeDays)) {
        summary.skipped.push(`${it.sourceId}: ${story.sourceDate ? `notice is from ${story.sourceDate}` : 'notice has no date'} (${it.link})`);
        continue;
      }
      if (story.deadline?.date && story.deadline.date < new Date().toISOString().slice(0, 10)) {
        summary.skipped.push(`${it.sourceId}: deadline ${story.deadline.date} has passed (${it.link})`);
        continue;
      }
      const problems = check(story);
      if (problems.length) { summary.errors.push(`draft for ${it.link} failed checks: ${problems.join(', ')}`); continue; }
      const id = createHash('sha1').update(it.link).digest('hex').slice(0, 10);
      const draft = { id, createdAt: new Date().toISOString(), provider, model, ocr, source: { name: it.name, title: it.title, link: it.link }, story };
      if (dryRun) { console.log(JSON.stringify(draft, null, 2)); drafted++; continue; }
      // Routine notices from trusted text sources go live at once; the editor gets a Remove button.
      const auto = sources.find((s) => s.id === it.sourceId)?.auto && story.sensitive === false && !ocr && story.storyType !== 'record';
      if (auto) {
        const storyId = await publish(draft, config.author, { auto: true });
        summary.published.push(storyId);
        summary.autoPublished.push(storyId);
        if (URGENT.test(`${it.title} ${story.en?.title ?? ''}`)) summary.urgentPublished.push(storyId);
        await tg.send(`🤖 <b>अपने-आप प्रकाशित</b> (अगले अपडेट में साइट पर)\n${site}/story/${storyId}\n\n${draftMessage(id, draft)}`, [
          { text: '🗑 साइट से हटाएँ', callback_data: `u:${storyId}` },
        ]);
        drafted++;
        continue;
      }
      writeJson(`drafts/${id}.json`, draft);
      await tg.send(draftMessage(id, draft), [
        { text: '✅ Approve', callback_data: `a:${id}` },
        { text: '❌ Reject', callback_data: `r:${id}` },
      ]);
      summary.drafted.push(id);
      drafted++;
    } catch (e) {
      summary.errors.push(`${it.link}: ${e.message}`);
      // A provider error (no balance, bad key) would repeat for every item; stop and tell the editor once.
      if (/DeepSeek|Anthropic|GLM|Sarvam/.test(e.message)) {
        delete state.seen[it.link];
        if (!dryRun) await tg.send(`⚠️ AI ड्राफ़्टिंग रुकी: ${tg.esc(e.message.slice(0, 200))}`);
        break;
      }
    }
  }
}

// Cloudflare's free plan allows 500 builds a month, and 20+ stories a day each building the site
// would pass that. So stories are committed without a build and go live together: at most one
// build every config.deployEveryMinutes, but a removal goes out at once.
function deployDue() {
  const d = (state.deploy ??= { last: null, pending: [] });
  d.pending = [...new Set([...d.pending, ...summary.published])].filter((id) => !summary.removed.includes(id));
  const waited = d.last ? (Date.now() - Date.parse(d.last)) / 60e3 : Infinity;
  // A run started by the result watcher (workers/watcher) puts its stories live at once: results
  // and admit cards are read most in their first hour.
  const urgent = process.env.URGENT === 'true' && summary.published.length;
  if (!summary.removed.length && !urgent && !(d.pending.length && waited >= config.deployEveryMinutes)) return [];
  const ids = d.pending;
  d.pending = [];
  d.last = new Date().toISOString();
  return ids;
}

// Seen links older than 60 days are forgotten; feeds never go back that far.
function pruneSeen() {
  const cutoff = new Date(Date.now() - 60 * 86400e3).toISOString().slice(0, 10);
  for (const [k, v] of Object.entries(state.seen)) if (v < cutoff) delete state.seen[k];
}

try {
  if (!dryRun && !india) await applyDecisions();
  if (!dryRun && !india) await ensureWebhook();
  if (!india) expireDrafts();
  await draftNew();
  pruneSeen();
} finally {
  // The India runner queues its stories for the main pipeline's next deploy, except results,
  // admit cards and answer keys, which go live at once (readers search for them in the first hour).
  const live = dryRun ? [] : india ? summary.urgentPublished : deployDue();
  const deploy = live.length > 0 || summary.removed.length > 0;
  if (!dryRun) writeJson(stateFile, state);
  console.log(JSON.stringify(summary, null, 2));
  if (process.env.GITHUB_OUTPUT) writeFileSync(process.env.GITHUB_OUTPUT, `published=${summary.published.length + summary.removed.length}\ndeploy=${deploy}\nlive=${live.length}\nids=${live.join(' ')}\n`, { flag: 'a' });
}
