// Telegram webhook. Telegram sends each tap and message to the editor's bot here the moment it
// happens, so nothing else polling the bot can take them (pollers get "409 Conflict" while a
// webhook is set). Each update is saved as pipeline/inbox/<update_id>.json in the repo and the
// pipeline is started; the pipeline acts on the inbox exactly as it did on polled updates.
//
// Cloudflare Pages settings → Variables and secrets (encrypted):
//   TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID  same values as the GitHub secrets
//   GITHUB_TOKEN                          fine-grained token for rupeshyadav08/kasba with
//                                         Contents: read and write, Actions: read and write
// The pipeline turns the webhook on by itself once GET /api/telegram reports ready.
const repo = 'rupeshyadav08/kasba';

// Telegram proves a request is genuine with this secret; it is derived from the bot token so
// there is no extra secret to manage. pipeline/lib/telegram.mjs computes the same value.
async function webhookSecret(token) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`kasba-webhook:${token}`));
  return [...new Uint8Array(hash)].slice(0, 24).map((b) => b.toString(16).padStart(2, '0')).join('');
}

const gh = (env, path, method, body) => fetch(`https://api.github.com/repos/${repo}/${path}`, {
  method,
  headers: {
    Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json',
    'User-Agent': 'kasba-telegram-webhook', 'Content-Type': 'application/json',
  },
  body: JSON.stringify(body),
});

const tg = (env, method, body) => fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

export async function onRequestGet({ env }) {
  const ready = Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID && env.GITHUB_TOKEN);
  return Response.json({ ready });
}

export async function onRequestPost({ request, env }) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.GITHUB_TOKEN) return new Response('not configured', { status: 503 });
  if (request.headers.get('X-Telegram-Bot-Api-Secret-Token') !== await webhookSecret(env.TELEGRAM_BOT_TOKEN)) {
    return new Response('forbidden', { status: 403 });
  }
  const update = await request.json();
  const from = String(update.callback_query?.from?.id ?? update.message?.chat?.id ?? '');
  // Only the editor's taps and messages matter; anything else is acknowledged and dropped.
  if (from !== String(env.TELEGRAM_CHAT_ID).trim()) {
    if (update.callback_query) await tg(env, 'answerCallbackQuery', { callback_query_id: update.callback_query.id, text: 'Not allowed' });
    return new Response('ok');
  }
  // Post/Skip on a Short (y:<run id> / n:<run id>) goes straight to the Shorts workflow, not the
  // news pipeline. The buttons are removed first so a second tap cannot upload the video twice.
  const shortTap = update.callback_query?.data?.match(/^([yn]):(\d+)$/);
  if (shortTap) {
    const { id, message } = update.callback_query;
    await tg(env, 'editMessageReplyMarkup', { chat_id: message.chat.id, message_id: message.message_id, reply_markup: { inline_keyboard: [] } });
    if (shortTap[1] === 'n') {
      await tg(env, 'answerCallbackQuery', { callback_query_id: id, text: 'छोड़ दिया' });
      return new Response('ok');
    }
    const started = await gh(env, 'actions/workflows/short.yml/dispatches', 'POST', { ref: 'main', inputs: { upload: shortTap[2] } });
    await tg(env, 'answerCallbackQuery', { callback_query_id: id, text: started.ok ? '⏳ YouTube पर डाल रहे हैं' : '⚠️ शुरू नहीं हो पाया' });
    return new Response('ok');
  }
  const content = btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(update))));
  const saved = await gh(env, `contents/pipeline/inbox/${update.update_id}.json`, 'PUT', {
    // [skip ci] stops Cloudflare building the site for this commit.
    message: `[skip ci] Telegram update ${update.update_id}`, content, branch: 'main',
  });
  // 422 means this update was saved already (Telegram retried); anything else failing makes
  // Telegram retry later, which is what we want.
  if (!saved.ok && saved.status !== 422) return new Response('could not save', { status: 502 });
  if (update.callback_query) {
    await tg(env, 'answerCallbackQuery', { callback_query_id: update.callback_query.id, text: '⏳ मिल गया' });
  }
  // A run already waiting will read this file too, so a refused start is fine.
  await gh(env, 'actions/workflows/pipeline.yml/dispatches', 'POST', { ref: 'main' });
  return new Response('ok');
}
