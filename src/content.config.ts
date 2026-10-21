import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// One Markdown file per story per language. The pipeline writes these files;
// every field below is required by Kasba's content rules.
const stories = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/stories' }),
  schema: z.object({
    lang: z.enum(['hi', 'en']),
    // Shared id that links the Hindi and English versions of one story.
    storyId: z.string(),
    title: z.string().max(110),
    summary: z.string().max(300),
    meaning: z.string(),
    keyFacts: z.array(z.string()).min(1),
    faq: z.array(z.object({ q: z.string(), a: z.string() })).min(2).max(3),
    source: z.object({
      name: z.string(),
      title: z.string(),
      url: z.url(),
      date: z.coerce.date(),
    }),
    category: z.enum(['schemes', 'jobs-exams', 'farming', 'money', 'weather', 'health', 'nation']),
    state: z.string().optional(),
    districts: z.array(z.string()).default([]),
    author: z.string(),
    published: z.coerce.date(),
    updated: z.coerce.date().optional(),
    correction: z.string().optional(),
    sample: z.boolean().default(false),
  }),
});

export const collections = { stories };
