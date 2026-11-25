// The one story a browser notification shows right now (public/sw.js reads it when a push
// arrives; workers/watcher/push.js reads it to decide whether to send). Only stories readers act
// on: jobs and exams, schemes, money, farming, weather, or anything with a last date, from the
// last 36 hours. Built with the site, so it changes only when new stories go live.
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';
import { storyPath } from '../lib/i18n';

const ACT = new Set(['jobs-exams', 'schemes', 'money', 'farming', 'weather']);
const URGENT = /result|admit|answer key|last date|परिणाम|रिजल्ट|एडमिट|प्रवेश पत्र|आख़िरी तारीख|अंतिम तिथि/i;

export async function GET(context: APIContext) {
  const cutoff = Date.now() - 36 * 3600 * 1000;
  const recent = (await getCollection('stories', ({ data }) => data.lang === 'hi' && !data.sample && data.published.getTime() >= cutoff))
    .sort((a, b) => b.data.published.getTime() - a.data.published.getTime());
  // A result, admit card or last date first; else the newest story readers can act on.
  const pick = recent.find((s) => URGENT.test(s.data.title) || s.data.deadline) ?? recent.find((s) => ACT.has(s.data.category));
  const alert = pick && {
    id: pick.data.storyId,
    title: pick.data.title,
    body: pick.data.summary.split(/(?<=[।.!?])\s/)[0].slice(0, 160),
    url: new URL(storyPath('hi', pick.data.storyId), context.site).toString(),
    image: pick.data.image ? new URL(pick.data.image.src, context.site).toString() : undefined,
  };
  return new Response(JSON.stringify({ alert: alert ?? null }), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}
