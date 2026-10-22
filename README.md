# Kasba

Hindi-first news for small-town India: official updates explained simply, with "what this means for you".

- Site: Astro static site on Cloudflare Pages (coming in week 2)
- Content: Markdown files in `src/content/` (one file per story)
- Pipeline: scheduled GitHub Actions job (`pipeline/`) that fetches official sources, drafts with an AI model (DeepSeek for now, set in `pipeline/config.json`), and waits for editor approval on Telegram

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

## News pipeline

`.github/workflows/pipeline.yml` runs `node pipeline/run.mjs` every hour from 6:00 to 22:00 India time (and on demand from the Actions tab, with a "draft only" option).

Each run:
1. Reads the editor's ✅ Approve / ❌ Reject taps from Telegram. Approved drafts become story files in `src/content/stories/` and are committed, which makes Cloudflare rebuild the site.
2. Reads the feeds in `pipeline/sources.json`, skips links already in `pipeline/state.json`, opens each new notice, and asks the model (rules in `pipeline/lib/prompt.mjs`) for a Hindi and English draft. Drafts that fail the story checks are dropped; useful ones are saved in `pipeline/drafts/` and sent to Telegram.

The job runs on GitHub's servers. PIB, CBSE and the Supreme Court site refuse any request whose User-Agent names a bot, so the pipeline sends Node's default User-Agent with a `From: admin@kasba.co.in` header. Scanned PDFs are read with OCR (tesseract, Hindi + English). RBI shows GitHub's servers a CAPTCHA, so sources marked `"india": true` are read by `.github/workflows/pipeline-india.yml` (every 3 hours) on a self-hosted runner in India labelled `kasba-india`, for now Rupesh's Mac; it keeps its own `pipeline/state-india.json`, and the main run handles the Telegram taps. `probe_urls` prints what the pipeline sees on given pages (`pipeline/probe.mjs`).

Sources: PIB (Hindi), RBI press releases and notifications, SEBI, CBSE, NTA, UP Board, the UP Information Department and Supreme Court press releases (`pipeline/sources.json`; RSS feeds or listing pages with a link pattern; PDFs are read with `pdftotext`). Sites whose robots.txt asks bots to stay away (UPSC, UPPSC, UPSSSC, NDMA Sachet) are not read. The editor can also send any official (gov.in, nic.in and similar) link to the bot, and the next run drafts it.

Secrets it needs (GitHub Actions secrets): `DEEPSEEK_API_KEY` (or `ANTHROPIC_API_KEY` if `provider` is switched to `anthropic`), `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`. Only taps from `TELEGRAM_CHAT_ID` count.
