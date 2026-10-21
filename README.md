# Kasba

Hindi-first news for small-town India: official updates explained simply, with "what this means for you".

- Site: Astro static site on Cloudflare Pages (coming in week 2)
- Content: Markdown files in `src/content/` (one file per story)
- Pipeline: scheduled GitHub Actions job that fetches official sources, drafts with Claude Haiku, and waits for editor approval on Telegram (coming in week 3)

Secrets (API keys, bot tokens) live only in GitHub Actions secrets, never in this repo.
