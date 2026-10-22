import { getCollection } from 'astro:content';
import { daysUntil, type Lang } from './i18n';

// Stories with a last date that has not passed yet, soonest first.
// The site is rebuilt with every new story, so "today" is at most a few hours old.
export async function upcomingDeadlines(lang: Lang) {
  return (await getCollection('stories', ({ data }) => data.lang === lang && !!data.deadline))
    .map((s) => ({ story: s, days: daysUntil(s.data.deadline!.date) }))
    .filter((x) => x.days >= 0)
    .sort((a, b) => a.days - b.days);
}
