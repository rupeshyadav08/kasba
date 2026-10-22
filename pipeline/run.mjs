// Kasba news pipeline. One run does two things:
//   1. applies the editor's Approve / Reject taps from Telegram (publishes approved stories)
//   2. checks the official feeds for new notices, drafts the useful ones and sends them for approval
// State (seen links, Telegram offset) and pending drafts are files in pipeline/, committed by the workflow.
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { get, htmlToText, parseRss } from './lib/feeds.mjs';
import { complete, parseJson } from './lib/llm.mjs';
import { systemPrompt, userPrompt } from './lib/prompt.mjs';
import { check, districtSlugs, publish } from './lib/story.mjs';
import * as tg from './lib/telegram.mjs';

const here = (p) => new URL(p, import.meta.url);
const readJson = (p) => JSON.parse(readFileSync(here(p), 'utf8'));
const writeJson = (p, v) => writeFileSync(here(p), JSON.stringify(v, null, 2) + '\n');

const config = readJson('config.json');
const sources = readJson('sources.json');
const state = readJson('state.json');
const dryRun = process.env.DRY_RUN === 'true';
const summary = { published: [], rejected: [], drafted: [], skipped: 0, errors: [] };

const draftPath = (id) => here(`drafts/${id}.json`);
const draftIds = () => readdirSync(here('drafts/')).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5));
const site = 'https://kasba.pages.dev';

// 1. Editor's decisions.
async function applyDecisions() {
  const list = await tg.updates(state.telegramOffset);
  for (const u of list) {
    state.telegramOffset = u.update_id + 1;
    const cb = u.callback_query;
    if (!cb) continue;
    if (String(cb.from?.id) !== tg.editorChat()) { await tg.answer(cb.id, 'Not allowed'); continue; }
    const [action, id] = String(cb.data).split(':');
    if (!existsSync(draftPath(id))) { await tg.answer(cb.id, 'यह ड्राफ़्ट अब मौजूद नहीं है'); continue; }
    const draft = JSON.parse(readFileSync(draftPath(id), 'utf8'));
    await tg.clearButtons(cb.message.chat.id, cb.message.message_id);
    if (action === 'a') {
      const storyId = publish(draft, config.author);
      summary.published.push(storyId);
      await tg.answer(cb.id, '✅ प्रकाशित हो रहा है');
      await tg.send(`✅ प्रकाशित: <b>${tg.esc(draft.story.hi.title)}</b>\n${site}/story/${storyId}\n(साइट 2-3 मिनट में अपडेट होगी)`);
    } else {
      summary.rejected.push(id);
      await tg.answer(cb.id, '❌ हटाया गया');
    }
    rmSync(draftPath(id));
  }
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
async function newItems() {
  const items = [];
  for (const src of sources) {
    try {
      const feed = parseRss(await get(src.url));
      for (const it of feed) if (!state.seen[it.link]) items.push({ ...it, name: src.name, sourceId: src.id });
    } catch (e) {
      summary.errors.push(`${src.id}: ${e.message}`);
    }
  }
  return items;
}

function draftMessage(id, d) {
  const s = d.story.hi;
  const lines = [
    `📝 <b>नया ड्राफ़्ट</b> · ${tg.esc(d.story.category)}${d.story.state ? ' · UP' : ''}`,
    '',
    `<b>${tg.esc(s.title)}</b>`,
    tg.esc(s.summary),
    '',
    `<b>आपके लिए:</b> ${tg.esc(s.meaning)}`,
    '',
    ...s.keyFacts.map((f) => `• ${tg.esc(f)}`),
    ...(d.story.deadline ? ['', `⏰ आख़िरी तारीख़: ${tg.esc(d.story.deadline.date)}`] : []),
    '',
    `EN: ${tg.esc(d.story.en.title)}`,
    `स्रोत: ${tg.esc(d.source.name)}, <a href="${tg.esc(d.source.link)}">मूल सूचना</a>`,
  ];
  return lines.join('\n').slice(0, 4000);
}

async function draftNew() {
  let items = await newItems();
  // First run: everything in the feeds is already old news. Remember it all and
  // draft only the newest notice from each source, so the editor sees a few samples.
  if (Object.keys(state.seen).length === 0) {
    const newest = sources.map((s) => items.find((i) => i.sourceId === s.id)).filter(Boolean);
    for (const i of items) if (!newest.includes(i)) state.seen[i.link] = new Date().toISOString().slice(0, 10);
    items = newest;
  }
  items = items.slice(0, config.maxItemsCheckedPerRun);
  const provider = config.provider;
  const model = config.models[provider];
  const system = systemPrompt(districtSlugs());
  let drafted = 0;
  for (const it of items) {
    if (drafted >= config.maxDraftsPerRun) break;
    state.seen[it.link] = new Date().toISOString().slice(0, 10);
    try {
      let text = it.description;
      try { text = htmlToText(await get(it.link)).slice(0, 8000); } catch (e) { summary.errors.push(`page ${it.link}: ${e.message}`); }
      if (!text || text.length < 200) { summary.skipped++; continue; } // too little to write from: hold back rather than guess
      const { text: reply } = await complete({ provider, model, system, user: userPrompt({ ...it, text }) });
      const story = parseJson(reply);
      if (!story.relevant) { summary.skipped++; continue; }
      const problems = check(story);
      if (problems.length) { summary.errors.push(`draft for ${it.link} failed checks: ${problems.join(', ')}`); continue; }
      const id = createHash('sha1').update(it.link).digest('hex').slice(0, 10);
      const draft = { id, createdAt: new Date().toISOString(), provider, model, source: { name: it.name, title: it.title, link: it.link }, story };
      if (dryRun) { console.log(JSON.stringify(draft, null, 2)); drafted++; continue; }
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
      if (/DeepSeek|Anthropic/.test(e.message)) {
        delete state.seen[it.link];
        if (!dryRun) await tg.send(`⚠️ AI ड्राफ़्टिंग रुकी: ${tg.esc(e.message.slice(0, 200))}`);
        break;
      }
    }
  }
}

// Seen links older than 60 days are forgotten; feeds never go back that far.
function pruneSeen() {
  const cutoff = new Date(Date.now() - 60 * 86400e3).toISOString().slice(0, 10);
  for (const [k, v] of Object.entries(state.seen)) if (v < cutoff) delete state.seen[k];
}

try {
  if (!dryRun) await applyDecisions();
  expireDrafts();
  await draftNew();
  pruneSeen();
} finally {
  if (!dryRun) writeJson('state.json', state);
  console.log(JSON.stringify(summary, null, 2));
  if (process.env.GITHUB_OUTPUT) writeFileSync(process.env.GITHUB_OUTPUT, `published=${summary.published.length}\n`, { flag: 'a' });
}
