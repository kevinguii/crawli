# Restoring this project from the archive

This repo was stripped for archival on **2026-09-15**. All source, docs, content,
migrations, workflows and git history are intact — only regenerable dependencies
and build output were removed (about 1.85 GB).

Nothing below needs the running service, the Hetzner box, or any account access.
It only needs Node, Python and a network connection.

---

## What was removed, and why it is safe

| Removed | Size | Restored by |
|---|---|---|
| `node_modules/` | 485 MB | `npm install` — exact versions pinned in `package-lock.json` |
| `crawl4ai-service/venv/` | 785 MB | `pip install -r crawl4ai-service/requirements.txt` |
| `.next/` | 224 MB | `npm run build` |
| `reddit-service/venv/` | 26 MB | `pip install -r reddit-service/requirements.txt` |
| `docs/marketing/dated-marketing-folders.zip` | 324 MB | Redundant — it was the low-res export of the identical 545 files in `dated-marketing-folders 2.zip`, which is kept |
| `docs/marketing/audience/raw/*.ndjson` | 5.5 MB | `node scripts/reddit-harvest.mjs` (the derived `language-file.md` is kept) |
| `.playwright-mcp/` | 136 KB | Session artifacts, not regenerated or needed |
| `docs/superpowers/` | 64 KB | Condensed into `docs/ARCHIVED_SPECS.md`; originals in git history |
| `__pycache__/`, `*.pyc`, `tsconfig.tsbuildinfo` | 664 KB | Regenerate automatically |

**Verified before stripping:** `npx tsc --noEmit` exited 0 with no output.

---

## Full restore

```bash
# 1. Node dependencies
npm install
```

> Requires `unzip` on the machine — Puppeteer's postinstall downloads a Chrome
> binary and needs it to extract. If `npm install` fails with
> *"The browser folder exists but the executable is missing"*, a prior partial
> extraction left a stale folder: `rm -rf ~/.cache/puppeteer && npm install`.

```bash
# 2. Python sidecar (the scraping engine)
cd crawl4ai-service
python3 -m venv venv
venv/bin/pip install --upgrade pip
venv/bin/pip install -r requirements.txt
venv/bin/python -m playwright install chromium
cd ..
```

> `npm run dev:sidecar` hardcodes `venv/bin/python`, so the venv must live at
> `crawl4ai-service/venv` with exactly that name.
> The `playwright install chromium` step is the one people forget — without it
> crawl4ai starts but every render fails.

```bash
# 3. Reddit sidecar — OPTIONAL, only for the n8n reddit-monitor workflow
cd reddit-service
python3 -m venv venv
venv/bin/pip install -r requirements.txt
cd ..

# 4. Run it
npm run dev:all          # Next.js :3000 + sidecar :8000
curl http://localhost:8000/health
```

If port 8000 is stuck: `lsof -ti:8000 | xargs kill -9`

---

## Before it will actually work

You need a `.env` before anything works. Note:

- **Secrets are not in this repo.** Every credential that ever leaked into a
  commit was revoked and then scrubbed from git history on 2026-11-22. A
  restore needs your own `.env` (start from `.env.example`). The original
  local `.env` was never committed.
- Search will not return results unless the Supabase project is active. If it
  has been paused, restore it at
  `supabase.com/dashboard/project/peyqxfijdrziqfjkxjsn`.
- Stripe, Resend, Firecrawl and OpenAI keys go dead when those accounts are
  closed. Search still runs without Firecrawl/OpenAI — all 9 platforms have
  Tier 1 structured extractors and only eBay ever falls back.

---

## Reading this project cold

Start with **`docs/CRAWLI_TEARDOWN.html`** — open it in any browser. It is a
self-contained walkthrough of the whole system: architecture, the search engine,
relevance filtering, caching, hosting, monitoring, payments, and what the numbers
ended up saying. Everything else is reference:

| File | What it holds |
|---|---|
| `docs/HANDOFF.md` | Current state at shutdown, open issues |
| `docs/core/SYSTEM_DESIGN.md` | Architecture and search internals, long form |
| `docs/core/PITFALLS.md` | Every gotcha, with the reasoning |
| `docs/core/PLATFORM_STATUS.md` | Per-platform scraping method and status |
| `docs/reference/SERVER_REFERENCE.md` | SSH, nginx, cron, n8n, deployment |
| `docs/ARCHIVED_SPECS.md` | Condensed design specs + rejected alternatives |
| `docs/CHANGELOG.md` | Full session history |
| `docs/SCALING.md` | Tier playbook for hosting and throughput |
