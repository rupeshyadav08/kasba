import { createHash } from 'node:crypto';
// Minimal Telegram Bot API client. Only the editor's chat may approve anything.
const token = () => process.env.TELEGRAM_BOT_TOKEN;
export const editorChat = () => String(process.env.TELEGRAM_CHAT_ID ?? '').trim();

async function call(method, body) {
  const res = await fetch(`https://api.telegram.org/bot${token()}/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`Telegram ${method}: ${data.description}`);
  return data.result;
}

export const send = (text, buttons) => call('sendMessage', {
  chat_id: editorChat(), text, parse_mode: 'HTML', disable_web_page_preview: true,
  ...(buttons ? { reply_markup: { inline_keyboard: [buttons] } } : {}),
});
export const sendTo = (chat, text) => call('sendMessage', { chat_id: chat, text, disable_web_page_preview: true });
export const updates = (offset) => call('getUpdates', { offset, timeout: 0, allowed_updates: ['callback_query', 'message'] });
export const webhookInfo = () => call('getWebhookInfo', {});
// Same derivation as functions/api/telegram.js, so the site can check that a request came from Telegram.
export const webhookSecret = () => createHash('sha256').update(`kasba-webhook:${token()}`).digest('hex').slice(0, 48);
export const setWebhook = (url) => call('setWebhook', { url, secret_token: webhookSecret(), allowed_updates: ['callback_query', 'message'] });
// Telegram only accepts an answer to a tap within seconds, and the pipeline reads taps up to an hour
// later, so the answer is best-effort; the follow-up message is what the editor sees.
export const answer = (id, text) => call('answerCallbackQuery', { callback_query_id: id, text }).catch(() => {});
export const clearButtons = (chatId, messageId) => call('editMessageReplyMarkup', { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [] } }).catch(() => {});
export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
