// Debug: why do Approve taps not reach the pipeline? Prints the bot's webhook state and what
// getUpdates returns from the stored offset (which confirms nothing new).
import { readFileSync } from 'node:fs';
const token = process.env.TELEGRAM_BOT_TOKEN;
const call = async (m, body = {}) => (await fetch(`https://api.telegram.org/bot${token}/${m}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json();
const state = JSON.parse(readFileSync(new URL('./state.json', import.meta.url), 'utf8'));
const me = await call('getMe');
console.log('bot:', me.ok, me.result?.username);
const wh = await call('getWebhookInfo');
console.log('webhook:', JSON.stringify({ url: wh.result?.url ? '(set)' : '', pending: wh.result?.pending_update_count, last_error: wh.result?.last_error_message, last_error_date: wh.result?.last_error_date, allowed: wh.result?.allowed_updates }));
console.log('stored offset', state.telegramOffset);
const all = await call('getUpdates', { offset: state.telegramOffset, timeout: 0, allowed_updates: ['callback_query', 'message'] });
console.log('getUpdates ok', all.ok, all.description ?? '', 'count', all.result?.length);
for (const u of all.result ?? []) console.log(u.update_id, u.callback_query ? `tap ${u.callback_query.data} from=${u.callback_query.from?.id === Number(process.env.TELEGRAM_CHAT_ID) ? 'editor' : 'OTHER ' + u.callback_query.from?.id} chat=${u.callback_query.message?.chat?.type}` : u.message ? `message chat=${u.message.chat?.type}` : Object.keys(u));

// Second look: same call again, then without an offset (offset 0 = from the oldest unconfirmed).
await new Promise((r) => setTimeout(r, 3000));
const again = await call('getUpdates', { offset: state.telegramOffset, timeout: 0, allowed_updates: ['callback_query', 'message'] });
console.log('again count', again.result?.length, (again.result ?? []).map((u) => u.update_id).join(','));
const zero = await call('getUpdates', { timeout: 0 });
console.log('no-offset count', zero.result?.length, (zero.result ?? []).map((u) => u.update_id).join(','));
const wh2 = await call('getWebhookInfo');
console.log('pending after', wh2.result?.pending_update_count);
