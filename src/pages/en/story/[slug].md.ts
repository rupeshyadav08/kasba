// /en/story/<id>.md: the story as plain Markdown (see lib/storyText.ts).
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';
import { storyMarkdown } from '../../../lib/storyText';

export async function getStaticPaths() {
  return (await getCollection('stories', ({ data }) => data.lang === 'en'))
    .map((story) => ({ params: { slug: story.data.storyId }, props: { story } }));
}

export function GET({ props, site }: APIContext) {
  return new Response(storyMarkdown(props.story, site!), { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });
}
