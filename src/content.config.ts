import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { districtSlugs, stateCodes } from './lib/places';

// One Markdown file per story per language. The pipeline writes these files;
// every field below is required by Kasba's content rules.
const stories = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/stories' }),
  schema: z.object({
    lang: z.enum(['hi', 'en']),
    // Shared id that links the Hindi and English versions of one story.
    storyId: z.string(),
    title: z.string().max(130),
    summary: z.string().max(450),
    meaning: z.string(),
    keyFacts: z.array(z.string()).min(1),
    faq: z.array(z.object({ q: z.string(), a: z.string() })).min(2).max(5),
    source: z.object({
      name: z.string(),
      title: z.string(),
      url: z.url(),
      date: z.coerce.date(),
    }),
    // "record": a "what the record says" story from a court judgment or other official record.
    storyType: z.enum(['notice', 'record']).default('notice'),
    category: z.enum(['schemes', 'jobs-exams', 'farming', 'money', 'weather', 'health', 'sports', 'nation']),
    // A state code (up, bihar, mp, delhi); districts use the slugs in src/lib/places.ts.
    state: z.enum(stateCodes).optional(),
    districts: z.array(z.enum(districtSlugs as [string, ...string[]])).default([]),
    // Representative stock photo (Pixabay) for Discover and social cards; see pipeline/lib/image.mjs.
    image: z.object({ src: z.string(), credit: z.string() }).optional(),
    author: z.string(),
    published: z.coerce.date(),
    updated: z.coerce.date().optional(),
    correction: z.string().optional(),
    sample: z.boolean().default(false),
    // Routine notice published without waiting for the editor (reviewed after); the page says so.
    autoPublished: z.boolean().default(false),
    // A last date readers must act by (form, fee, exam, eKYC). Feeds the
    // "last dates" page and the add-to-calendar button.
    deadline: z.object({ date: z.coerce.date(), label: z.string() }).optional(),
  }),
});

// Fixed site pages (policies, about, contact), one file per language.
const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/pages' }),
  schema: z.object({
    lang: z.enum(['hi', 'en']),
    key: z.string(), // not "slug": the glob loader would use it as the entry id and merge languages
    title: z.string(),
    description: z.string(),
    updated: z.coerce.date(),
  }),
});

// Plain-language meanings of official terms (LOC, eKYC, repo rate) for the glossary.
const glossary = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/glossary' }),
  schema: z.object({
    lang: z.enum(['hi', 'en']),
    termId: z.string(), // shared by the Hindi and English entry, used as the #anchor
    term: z.string(),
    match: z.array(z.string()).default([]), // words that link a story to this entry (case-insensitive)
    short: z.string().max(200), // one-line meaning, shown in the list and in search results
  }),
});

export const collections = { stories, pages, glossary };
