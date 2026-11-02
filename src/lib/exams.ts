import { getCollection, type CollectionEntry } from 'astro:content';
import { daysUntil, type Lang } from './i18n';

export const examPath = (lang: Lang, id?: string) => `${lang === 'hi' ? '' : '/en'}/exam${id ? `/${id}` : ''}`;

const storyText = (s: CollectionEntry<'stories'>) =>
  [s.data.title, s.data.summary, ...s.data.keyFacts, s.data.source.title].join(' ').toLowerCase();

const matches = (exam: CollectionEntry<'exams'>, s: CollectionEntry<'stories'>) => {
  const text = storyText(s);
  return exam.data.match.some((w) => text.includes(w.toLowerCase()));
};

// Kasba stories about this exam, newest first, and the last dates among them still ahead.
export async function examStories(exam: CollectionEntry<'exams'>) {
  const stories = (await getCollection('stories', ({ data }) => data.lang === exam.data.lang))
    .filter((s) => matches(exam, s))
    .sort((a, b) => b.data.published.getTime() - a.data.published.getTime());
  const deadlines = stories
    .filter((s) => s.data.deadline)
    .map((s) => ({ story: s, days: daysUntil(s.data.deadline!.date) }))
    .filter((x) => x.days >= 0)
    .sort((a, b) => a.days - b.days);
  return { stories, deadlines };
}

// Exam pages a story belongs to, for the "full guide" link on the story page.
export async function examsForStory(s: CollectionEntry<'stories'>) {
  return (await getCollection('exams', ({ data }) => data.lang === s.data.lang)).filter((e) => matches(e, s));
}
