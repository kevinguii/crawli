# Fashion Resale Price Aggregator — Consolidated Handoff

**Last updated:** 2026-05-15 (afternoon)
**Status:** Firecrawl scraping fully replaced by in-house crawl4ai sidecar. 6 of 8 platforms working end-to-end. Two known gaps (eBay bot-blocked, Vestiaire URL discovery) — see "Open Problems" below.

**Latest change (2026-05-15 PM):** Scraping pipeline gained a **structured-data tier** that reads Schema.org JSON-LD (Depop/Grailed/Poshmark) and specific `data-testid` attributes (StockX) directly from the rendered HTML. LLM is now a fallback, not the primary signal. This fixed a class of wrong-price bugs where the LLM picked "More from seller" / strikethrough / related-product prices. See §6.5 and §11 (gotchas 11–17).

This document supersedes the older `HANDOFF.md` and `HANDOFF_FULL.md`. It folds in all prior context plus the work done in May 2026 to migrate scraping off Firecrawl.

---

## 1. Project Overview

A personal-use web app that searches multiple fashion resale platforms simultaneously and aggregates live listings (price, image, condition, sold status, currency) across them. Single query → results from up to 8 platforms in one view, with min/max/avg price stats.

**Target platforms:** Grailed, Depop, StockX, Poshmark, Mercari, Vinted, eBay, Vestiaire Collective.

**Business value:** Price transparency across a fragmented resale market without manually checking each site.

---

## 2. Tech Stack

**Frontend / API**
- Next.js 16.2.6 (App Router) + React 19.2.4
- TypeScript 5.x, Tailwind v4
- Client-side state via React hooks; no auth yet
- Zod for API request validation; nanoid for listing IDs

**Backend services**
- Next.js API routes (`/api/search`) orchestrate the pipeline
- **Python sidecar** (`crawl4ai-service/`) — FastAPI + crawl4ai 0.8.6 + Playwright 1.59.0 + litellm
- Firecrawl (`@mendable/firecrawl-js` v4.23.0) — used **only for search**, not for scraping
- Supabase — configured (env vars present), unused in Phase 1

**LLM**
- OpenAI `gpt-4o-mini` is the default extraction model (via litellm, configured in `.env`)
- Gemini `gemini-2.0-flash` is the backup; rate-limits hard so used only on opt-in
- Do **not** default to Anthropic/Groq/Mistral/local — no card on file for those

---

## 3. Architecture (current — as of 2026-05-15)

```
User → SearchForm
       │
       ▼
POST /api/search ─────────────────────────────────────────────┐
       │                                                       │
       │  for each platform (parallel):                        │
       │    1. Firecrawl search:  site:<domain> <query>        │  Firecrawl
       │       → returns 15 candidate URLs                     │  (2 credits/
       │    2. filterListingUrls() — regex per platform        │   platform)
       │    3. dedupe                                          │
       │                                                       │
       │  for each URL (concurrency 2 per platform):           │
       │    4. scrapeListing(url, platform)                    │
       │       ↓                                               │
       │       scrapeViaSidecar() in lib/scraper.ts            │
       │       ↓                                               │
       │       POST http://localhost:8000/scrape ──────────────┼─→ Python sidecar
       │                                                       │   (crawl4ai +
       │  5. parseScrapedListings() — drop sold, map fields    │    OpenAI)
       │  6. aggregate prices, return SearchResponse           │
       ▼                                                       │
   UI: tabbed results + min/max/avg price summary              │
                                                               ▼
```

**Key change vs. the original Firecrawl-only design:** the **scrape** step used to cost 9–10 Firecrawl credits per page. It now goes through a local Playwright + LLM pipeline, costing ~$0.0005–$0.002 per page in OpenAI tokens. Firecrawl is retained only for the **search** step (2 credits per platform per query), where it's still the cheapest option.

---

## 4. File Structure

```
fashion-crawler-crawl4ai/
├── .env                              ← LLM_PROVIDER, OPENAI_API_KEY, FIRECRAWL_API_KEY, Supabase
├── HANDOFF.md                        ← this file
├── package.json                      ← scripts: dev, dev:sidecar, dev:all, build
│
├── app/
│   ├── api/search/route.ts           ← orchestrator (POST /api/search)
│   ├── components/
│   │   ├── SearchForm.tsx            ← query + platform checkboxes
│   │   ├── SearchSection.tsx         ← client state container
│   │   ├── ResultsDisplay.tsx        ← tabbed results grid (All + per-platform)
│   │   ├── ListingCard.tsx           ← single listing card (image, price, badge)
│   │   └── PriceSummary.tsx          ← min/max/avg stats bar
│   ├── layout.tsx                    ← root layout (suppressHydrationWarning for Grammarly)
│   ├── page.tsx                      ← homepage
│   └── globals.css                   ← Tailwind v4 + CSS vars
│
├── lib/
│   ├── types.ts                      ← PLATFORM_DOMAINS, PLATFORM_NAMES, Listing, SearchResponse
│   ├── firecrawl.ts                  ← searchPlatform() (Firecrawl); scrapeListing() delegates to sidecar
│   ├── scraper.ts                    ← HTTP client for the Python sidecar
│   └── parse.ts                      ← filterListingUrls(), parseScrapedListings()
│
├── crawl4ai-service/                 ← Python sidecar (replaces Firecrawl scrape)
│   ├── main.py                       ← FastAPI app, /scrape + /health endpoints; structured-first → LLM fallback
│   ├── extractors.py                 ← LISTING_SCHEMA + PLATFORM_PROMPTS + per-platform options (LLM fallback tier)
│   ├── structured_extractors.py     ← NEW (2026-05-15 PM): JSON-LD + testid extractors (primary tier)
│   ├── debug_probe.py                ← NEW: dumps OG/JSON-LD/__NEXT_DATA__/visible-$ from a URL; for future debugging
│   ├── debug_dumps/                  ← saved raw HTML from probe runs (gitignored)
│   ├── requirements.txt
│   ├── venv/                         ← already provisioned; crawl4ai, playwright, fastapi, beautifulsoup4 installed
│   └── README.md
│
└── scripts/
    ├── test-all-platforms.mjs        ← NEW: smoke-tests sidecar across all 8 platforms (~16 Firecrawl credits, search only)
    ├── diagnose-counts.mjs           ← URL-filter pass rates (3 search credits)
    ├── diagnose-scrape.mjs           ← 3 URLs per platform (sequential, used to test Firecrawl — still works as a baseline)
    ├── diagnose-parallel.mjs         ← reproduces old timeout issue at full parallel load
    ├── diagnose-grailed.mjs          ← measures Grailed sold rate
    └── test-scrape*.mjs              ← legacy Firecrawl scrape tests
```

---

## 5. The Sidecar (`crawl4ai-service/`)

This is where the Firecrawl-replacement lives. Treat it as a separate process that the Next.js API talks to over HTTP on `localhost:8000`.

### Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Returns `{status, llm_mode: "active"\|"stub", provider}`. Use to verify the API key is loaded. |
| `POST` | `/scrape` | Body: `{url, platform}`. Returns `{result: ScrapedListing \| null}`. Mirrors the original Firecrawl-shaped output exactly. |

### How it works
1. `main.py` boots a long-lived `AsyncWebCrawler` (Playwright Chromium) with `enable_stealth=True` and `user_agent_mode="random"`.
2. On each `/scrape` request, it renders the page (`wait_until="domcontentloaded"`, `delay_before_return_html=5s`; Poshmark gets 6s; retries get 7s).
3. **Tier 1 — structured extraction** (`structured_extractors.py`): for Grailed/Depop/Poshmark/StockX, read deterministic signals directly from the raw HTML:
   - **Depop/Grailed/Poshmark**: Schema.org `<script type="application/ld+json">` with `@type: "Product"`. Read `offers.price`, `offers.priceCurrency`, `offers.availability`, `offers.itemCondition`, `name`, `image`.
   - **StockX**: `<h2 data-testid="trade-box-buy-amount">` for Lowest Ask. If missing but title present → listing has no Ask → return `price=None` (valid result, don't fall back). If both missing → return None → fall back to LLM.
   - No LLM call, deterministic, costs nothing.
4. **Tier 2 — LLM fallback**: if tier 1 returns None, run the original `LLMExtractionStrategy` flow:
   - converts rendered markdown via `target_elements` scope (limits LLM to the main product container — drops "Similar Items", "Last Sale", footer, etc.)
   - sends scoped markdown + schema + platform prompt to OpenAI via litellm
   - parses the LLM's JSON response back into the `ScrapedListing` shape
5. If `LLM_PROVIDER` is empty or its API key is missing, the sidecar runs in **stub mode** — it still fetches pages and runs tier 1, falling through to title-only output when tier 1 misses. `/health` will report `llm_mode: "stub"`.

### Schema & prompts (in `extractors.py`)
- `LISTING_SCHEMA` — the canonical JSON shape (title, price, currency, isSold, condition, imageUrl). **Do not change without updating `lib/parse.ts` and the UI in lockstep.**
- `PLATFORM_PROMPTS` — per-platform extraction instructions for the LLM fallback (StockX: "Lowest Ask, not Last Sale/Highest Bid"; Grailed: detect sold badge; Depop: capture discounted not strikethrough price; Poshmark: ignore related listings).
- `PLATFORM_CRAWLER_OPTIONS` — per-platform crawler tweaks:
  - `word_count_threshold: 0` for Depop/eBay (keeps short price chips that the default filter strips).
  - `target_elements: [...]` for Grailed/Depop/StockX/Poshmark — scopes the LLM-fallback view to the main product container. **Gated to the LLM tier only** (`scope_to_target=True` in `main.py`); tier 1 reads raw HTML so `<head>` meta + `<script>` JSON-LD survive.
- `PLATFORM_EXTRACTION_OPTIONS` — per-platform LLM-strategy tweaks. eBay sets `apply_chunking: True` because its listing pages render to ~50K chars of markdown.

### Structured extractors (in `structured_extractors.py`)
- `extract_depop`, `extract_grailed`, `extract_poshmark` — share `_extract_from_jsonld`, which walks JSON-LD nodes, finds `@type: "Product"` (or nested under `@graph`), and pulls `offers.price`, `priceCurrency`, `availability`, `itemCondition`, `name`, `image`.
- `extract_stockx` — direct CSS via BeautifulSoup. Selector `[data-testid="trade-box-buy-amount"]` for Lowest Ask, `[data-testid="product-detail-product-title"]` (or `h1`) for title, `<meta property="og:image">` for image.
- Schema.org availability tokens (`outofstock`, `soldout`, `discontinued`) map to `isSold: true`.
- Schema.org `itemCondition` (`NewCondition`, `UsedCondition`, `RefurbishedCondition`, `DamagedCondition`) maps to `"New"`/`"Used"`/`"Refurbished"`/`"Damaged"`.

### Critical config gotchas (don't undo these)
- `BrowserConfig(headless=True, verbose=False, enable_stealth=True, user_agent_mode="random")` in `main.py`. Stealth is required for StockX and was attempted for eBay (still insufficient — see below).
- **Do not enable** `light_mode`, `text_mode`, or `memory_saving_mode` on `BrowserConfig`. They break extraction on React/Vue SPA sites (Grailed, Depop, StockX) by disrupting JS rendering. Comment in `main.py` documents this.
- `apply_chunking=False` is the default; only eBay overrides it to True.

---

## 6. Status by Platform (verified 2026-05-15)

Test was a single live run via `scripts/test-all-platforms.mjs` with query "Nike Air Jordan 1" against the live sidecar (`llm_mode: active`, provider `openai/gpt-4o-mini`).

| Platform | Scrape works? | Notes |
|---|:-:|---|
| **Grailed** | ✅ | JSON-LD Product → reliable. LLM fallback if JSON-LD missing. |
| **Depop** | ✅ | JSON-LD Product → reliable. **Fixed 2026-05-15 PM**: was returning related-item prices ($39.55 instead of $45). Root cause was 1.5s render delay + LLM seeing "More from seller" rail. |
| **StockX** | ✅ | `[data-testid="trade-box-buy-amount"]` → reliable. **Fixed 2026-05-15 PM**: was returning related-product asks or hallucinated numbers. Listings with no Lowest Ask now correctly return `price=null` (not a wrong number). |
| **Poshmark** | ✅ | JSON-LD Product → reliable. Navigation-retry (added 2026-05-15 AM) lets more URLs survive Poshmark's mid-load redirects. |
| **Mercari** | ✅ | Tested with a sold listing — correctly reported `isSold: true`. Still LLM-only (no structured extractor written). |
| **Vinted** | ✅ | Returns price and condition (e.g. "Very good"). Still LLM-only. |
| **eBay** | ❌ | Edge proxy (`ebay-proxy-server`) returns 307 → `/splashui/challenge` even with stealth + random UA. Playwright successfully fetches the **challenge page**, but the LLM finds no extractable content. Needs heavier solution. |
| **Vestiaire** | ❌ | Scrape side works; **URL discovery is the blocker**. Firecrawl's `site:vestiaire.com <query>` search returns 0 results — has been a known gap for a while. |

### 6.5 What we tried (2026-05-15 PM debug iteration) — what worked, what didn't

User reported wrong Depop prices (e.g. listing was $45, we returned $39.55) and StockX prices appearing where the page had no Ask. This section captures the iterations so future-you doesn't re-walk the same path.

**Attempt 1 (failed): Open Graph product meta tags (`og:price:amount`, `product:price:amount`).**
- Assumption was these would be in `<head>` for all four sites.
- Reality (verified via `debug_probe.py`): **Depop and StockX emit NO product OG meta tags** on listing pages. The OG approach extracted 0 fields → fell through to LLM every time. Removed. See git history for `OG_PRODUCT_SCHEMA`.

**Attempt 2 (failed): bump `delay_before_return_html` from 1.5s → 3s, keep LLM extraction.**
- Improvement, but the LLM still occasionally grabbed prices from "More from seller" / "Similar items" rails because the markdown contained both the listing AND those sections.

**Attempt 3 (succeeded): structured-data extraction tier (`structured_extractors.py`).**
- Probed raw HTML with `debug_probe.py` to discover:
  - **Depop**: emits Schema.org JSON-LD `<script type="application/ld+json">` with `@type: "Product"` and `offers.price = "45.00"` for jeff250 — the actual listing price.
  - **StockX**: does NOT emit listing-level JSON-LD with the Ask. `__NEXT_DATA__` only contains i18n strings (market data is loaded client-side via React Query post-hydration). The Lowest Ask lives in `<h2 data-testid="trade-box-buy-amount">$74</h2>`. Related-product carousel asks use `data-testid="product-tile-lowest-ask-amount"` — must be ignored.
- **Critical realization**: StockX's "There are no Asks at this time" string is in the i18n bundle ALWAYS, regardless of whether the listing actually has an Ask. Don't use the string as a signal — use whether `trade-box-buy-amount` actually contains a value.
- Bumped `delay_before_return_html` to 5s (Depop's JSON-LD wasn't even in the HTML before this — page hadn't painted).
- End-to-end verification (live, against the running sidecar, 2026-05-15 PM):
  - Depop jeff250 → **$45.00** ✓ (was $39.55)
  - Depop finnbra → **$40.00** ✓ (was $32.20)
  - StockX FW24 → **$74** ✓ (was correct in dump but raced; structured-tier still right)
  - StockX SS25 → **price=null** ✓ (correctly reflects "no Asks"; was a hallucinated number before)

**Gotchas discovered during this iteration**:
1. `cleaned_html` from crawl4ai strips `<script>` tags. **For structured extraction, read `result.html` (raw), not `result.cleaned_html`**, or JSON-LD blocks vanish.
2. `target_elements` in `CrawlerRunConfig` scopes the markdown to that element and drops `<head>`. **Gate it to the LLM-fallback tier only** (`scope_to_target=True`); tier 1 needs full HTML.
3. `wait_until="networkidle"` times out on Depop/StockX (~45s) because they hold long-lived telemetry connections. Use `wait_until="domcontentloaded"` + a longer `delay_before_return_html` instead.
4. StockX's main listing Ask is rendered client-side; if the page didn't fully paint, the testid will be missing. `extract_stockx` returns None when **both** title and price are missing (page didn't render) but a valid dict with `price=None` when only the Ask is missing (genuinely no Ask).
5. StockX prices change in real time — a $74 ask scraped now can be $87 by the time the user clicks. That's not a scraper bug.

### Search-side platform: Phase 1 fixes still apply
The original timeout-fix work (May 13–14, 2026) is intact:
- Concurrency cap: 2 concurrent scrapes per platform (was 5+, then 45 in parallel across platforms, which caused mass timeouts)
- URL dedupe before scraping
- Search limit: 15 per platform (was 10)
- Scrape timeout: 40s
- `Promise.allSettled` so one platform's failure doesn't crash the response

These survived the migration; `app/api/search/route.ts` is unchanged from the Firecrawl era except for what `scrapeListing` now does under the hood.

---

## 7. Open Problems & Recommended Next Steps

### A. eBay — blocked at the edge

**Symptom:** every `/scrape` against `ebay.com/itm/<id>` returns `null`. Logs show the page fetches (HTTP 200) but the LLM gets no extractable content.

**Root cause:** eBay's edge proxy redirects to `/splashui/challenge?...`. The challenge gate uses signals beyond Playwright fingerprint (IP reputation, cookie history, request cadence). `enable_stealth=True` + `user_agent_mode="random"` cover Chrome fingerprint but don't beat it.

**Options (none implemented yet):**
1. Residential proxy pool — most reliable, real monthly cost.
2. `undetected-chromedriver` or a custom Playwright launch with full fingerprint patching.
3. eBay's official Browse API — requires developer account + OAuth, but cheap/legitimate.
4. Drop eBay from the platform list for now.

### B. Vestiaire — URL discovery gap

**Symptom:** `site:vestiaire.com <query>` via Firecrawl returns 0 web results, so the pipeline never has any vestiaire URLs to scrape. (Memory entry `project_vestiaire_search_gap.md` documents this.)

**Important:** the **scrape side works fine** — given a vestiaire URL directly, the sidecar extracts price/title/etc. correctly. The gap is purely in URL discovery.

**Proposed fix (to be implemented next session):**
- **Option 1 (recommended):** Crawl `vestiaire.com/search/?q=<query>` with the sidecar itself and extract listing URLs from the rendered results page. One extra render per search; no new dependency; keeps everything in-house.
- **Option 2:** Use a different search backend just for vestiaire (DuckDuckGo HTML, Bing Search API, SerpAPI).
- **Option 3:** Drop vestiaire.

User has agreed to **option 1** but has chosen to defer implementation. Next steps when picking this up: inspect `vestiaire.com/search/` HTML to determine if listing URLs are present in server-rendered HTML or require waiting for client-side hydration, then either parse with a regex/selector or add a second LLM-extraction prompt for "extract listing URLs from this search results page."

### C. Grailed — occasional first-call null

LLM extraction occasionally returns malformed JSON on the first request after a cold sidecar start. Retry succeeds. Not worth fixing yet — UI would already retry as part of the normal search loop. Worth a retry-once-on-null wrapper in `lib/scraper.ts` if it becomes a user-visible problem.

### D. Carryover from Phase 1 (still open)

- **Grailed ~83% sold rate** — Google indexes lots of sold Grailed listings; nothing to do without paying for more search results or finding a different discovery method.
- **Depop GBP/EUR listings** — currency badge handles UI flagging; FX conversion would be a nice-to-have.
- **No pagination** — 15 search results per platform, no "load more."
- **No seller info, no price history, no auth, no watchlist** — all Phase 2.

---

## 8. Environment Setup

`.env` at repo root (`/Users/kevingui/Documents/Work/me/fashion-crawler-crawl4ai/.env`) must contain:

```
# Firecrawl — search only, no scraping
FIRECRAWL_API_KEY=fc-...

# LLM provider for the sidecar (litellm format: <provider>/<model>)
LLM_PROVIDER=openai/gpt-4o-mini
OPENAI_API_KEY=sk-proj-...

# Backup provider — switch LLM_PROVIDER above if needed; do not use as default
GEMINI_API_KEY=...

# Optional
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
PORT=8000
```

**Provider rules:**
- Default: OpenAI. Card on file, no rate-limit pain.
- Backup: Gemini. Rate-limits aggressively; only use when OpenAI is unavailable.
- Do **not** silently default to Groq/Anthropic/Mistral/Ollama. No card on those, or local-only.

### Python venv (already provisioned)
- `crawl4ai-service/venv/` — Python 3.11, crawl4ai 0.8.6, playwright 1.59.0, playwright_stealth 2.0.3, fastapi, uvicorn, litellm
- Playwright Chromium binaries at `~/Library/Caches/ms-playwright/chromium-1217` (already installed)
- No reinstall needed unless requirements change

### Running the stack

```bash
# Sidecar only (for testing extraction in isolation)
npm run dev:sidecar
# → uvicorn on :8000

# Full stack (Next.js + sidecar in parallel)
npm run dev:all
# → Next.js on :3000, sidecar on :8000
```

If port 8000 is already taken, `lsof -ti:8000 | xargs kill -9` and retry. The sidecar logs to `/tmp/sidecar.log` when started via the background pattern used during this session.

### Health check

```bash
curl http://localhost:8000/health
# {"status":"ok","llm_mode":"active","provider":"openai/gpt-4o-mini"}
```

If `llm_mode` is `stub`, the API key isn't being read — check `.env` and that `LLM_PROVIDER` matches a known prefix in `main.py`'s `_PROVIDER_KEY_ENV`.

---

## 9. Cost Model

| Operation | Cost |
|---|---|
| Firecrawl search (per platform per query) | 2 credits |
| Firecrawl scrape (deprecated, no longer used) | ~9–10 credits |
| Sidecar scrape | ~$0.0005–$0.002 in OpenAI tokens |
| Full search across 6 working platforms | ~12 Firecrawl credits + ~$0.02 OpenAI |

**Before the migration:** a full search burned ~400–450 Firecrawl credits and ate the $16/mo Hobby plan's 3,000 credits in ~7 sessions.
**After the migration:** ~12–16 Firecrawl credits per search. The same plan now affords hundreds of sessions per month.

### Be conservative with diagnostic scripts

| Script | Cost |
|---|---|
| `diagnose-counts.mjs` | 3 Firecrawl credits (search only) |
| `test-all-platforms.mjs` | ~16 Firecrawl credits (search) + ~$0.02 OpenAI |
| `diagnose-scrape.mjs` | 9 Firecrawl scrape credits — **legacy, uses old Firecrawl scraping; avoid** |
| `diagnose-parallel.mjs` | 25+ Firecrawl scrape credits — **legacy; avoid** |

The diagnose-scrape and diagnose-parallel scripts were written before the migration and still call Firecrawl's scrape endpoint directly. They're useful as a baseline comparison but cost real credits. Prefer `test-all-platforms.mjs` for end-to-end validation now.

---

## 10. Testing Checklist

When picking this up in a future session, verify in this order before making changes:

1. `curl http://localhost:8000/health` → `llm_mode: active`
2. Single-listing smoke test, e.g.
   ```bash
   curl -X POST http://localhost:8000/scrape -H 'Content-Type: application/json' \
     -d '{"url":"https://www.grailed.com/listings/<active-listing>","platform":"grailed"}'
   ```
   Expect non-null `result` with price + image.
3. Full sweep: `node --env-file=.env scripts/test-all-platforms.mjs`
   Expect ~6/8 platforms to extract. eBay and Vestiaire failures are known.
4. Full UI test (only if needed — costs real Firecrawl credits): `npm run dev:all`, search via UI.

---

## 11. Key Gotchas & Learnings

1. **Sidecar must be running before `/api/search` works.** Use `npm run dev:all` during development, not `npm run dev`.
2. **`enable_stealth=True` is non-negotiable** — StockX returns garbage without it. eBay still beats it.
3. **`word_count_threshold: 0` for Depop and eBay** — without it, the LLM gets the sidebar's "similar items" instead of the actual listing.
4. **Do not enable `light_mode`/`text_mode`/`memory_saving_mode`** on the crawl4ai BrowserConfig — they break SPA rendering on Grailed/Depop/StockX.
5. **First LLM call after a cold sidecar can produce malformed JSON.** Retry usually works. Mostly affects Grailed in observation.
6. **Firecrawl's `site:vestiaire.com` returns zero results.** Known platform-specific search-index gap; vestiaire needs its own discovery path.
7. **Concurrency cap of 2 per platform** — going higher caused mass timeouts in the original Firecrawl architecture. Hasn't been re-tested under the sidecar; raise only with care since the sidecar shares one Playwright browser.
8. **`onlyMainContent` was the Firecrawl name; the crawl4ai equivalent is `word_count_threshold`** (lower = keep more short blocks). Same intent, different knob.
9. **The schema in `extractors.py` must match the TypeScript `ScrapedListing` shape in `lib/firecrawl.ts` and `lib/scraper.ts`.** They're independently defined and silent drift will null-out fields.
10. **Image URLs expire on some platforms.** Frontend has `onError` handlers; don't try to validate URLs at scrape time.
11. **Structured extraction (JSON-LD / testid CSS) is now the primary tier.** LLM is only a fallback. If you're debugging a wrong price, check `structured_extractors.py` first — most listings won't even reach the LLM.
12. **Read `result.html` for structured extraction, NOT `result.cleaned_html`.** The latter strips `<script>` tags and JSON-LD with it.
13. **`target_elements` is gated to the LLM tier** (`scope_to_target=True`). Don't apply it to the structured tier — it drops `<head>` meta and JSON-LD.
14. **`wait_until="networkidle"` is unreliable on Depop/StockX** (times out). Use `domcontentloaded` + `delay_before_return_html=5s` (6s Poshmark; 7s on retry). The Depop JSON-LD doesn't paint until ~3–5s in.
15. **StockX's "There are no Asks at this time" string is ALWAYS present** in the i18n bundle — don't use the string as a signal. Use whether `[data-testid="trade-box-buy-amount"]` has text.
16. **Related-product carousels on StockX use `data-testid="product-tile-lowest-ask-amount"`** (with `tile`). The main listing uses `trade-box-buy-amount`. Don't confuse them.
17. **`debug_probe.py` exists** for future debugging — it dumps OG meta, JSON-LD, `__NEXT_DATA__`, inline script JSON, and visible `$`-adjacent text from any URL. Saves raw HTML to `crawl4ai-service/debug_dumps/` for offline grepping.

---

## 12. What's Next (proposed order)

1. **Implement Vestiaire URL discovery** via sidecar (option 1 above). This is the highest-value gap to close and is already scoped.
2. **Decide on eBay** — either invest in proxy/API solution, or formally drop eBay from `PLATFORM_DOMAINS` so the UI stops surfacing the empty tab.
3. **Add retry-once-on-null wrapper** in `lib/scraper.ts` for the flaky first-call problem (cheap, ~10 lines).
4. **Phase 2 work** — saved searches, price history, watchlist, auth. Supabase env vars already in place.

---

## 13. Code Reference Card

```typescript
// lib/firecrawl.ts — entry points
export async function searchPlatform(platform: string, query: string): Promise<RawSearchResult[]>
export async function scrapeListing(url: string, platform: string): Promise<ScrapedListing | null>
// scrapeListing delegates to scrapeViaSidecar() in lib/scraper.ts

// ScrapedListing shape (must match crawl4ai-service/extractors.py:LISTING_SCHEMA)
interface ScrapedListing {
  url: string;
  title: string | null;
  price: number | null;
  currency: string;       // defaults "USD"
  isSold: boolean;
  condition: string | null;
  imageUrl: string | null;
}
```

```python
# crawl4ai-service/extractors.py — sources of truth for prompts/options
LISTING_SCHEMA         # JSON schema, mirrors ScrapedListing
PLATFORM_PROMPTS       # per-platform extraction instructions
PLATFORM_CRAWLER_OPTIONS    # crawl4ai BrowserConfig tweaks (word_count_threshold etc.)
PLATFORM_EXTRACTION_OPTIONS # LLMExtractionStrategy tweaks (apply_chunking etc.)
```
