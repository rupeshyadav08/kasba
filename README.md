# Kasba

Hindi-first news for small-town India: official updates explained simply, with "what this means for you".

- Site: Astro static site on Cloudflare Pages (coming in week 2)
- Content: Markdown files in `src/content/` (one file per story)
- Pipeline: scheduled GitHub Actions job that fetches official sources, drafts with Claude Haiku, and waits for editor approval on Telegram (coming in week 3)

Secrets (API keys, bot tokens) live only in GitHub Actions secrets, never in this repo.

## Run locally

Needs Node 22.23.4 or newer (`.node-version` pins 24 for Cloudflare Pages).

```sh
npm install
npm run dev      # http://localhost:4321
npm run build    # static site in dist/
```

## Story files

Each story is one Markdown file per language: `src/content/stories/hi/<id>.md` and `src/content/stories/en/<id>.md`, sharing the same `storyId`. The front matter fields (title, summary, meaning, keyFacts, faq, source, category, author, published) are checked at build time in `src/content.config.ts`, so a story missing its source or "what this means for you" box fails the build instead of going live.

Files marked `sample: true` exist only to show the layout and will be deleted before launch.
