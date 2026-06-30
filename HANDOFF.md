# Crawli — Handoff

**Last updated:** 2026-06-30

## How to use this file

**HANDOFF.md is the current-state hub** — what is true right now, what is broken, what is open. It is NOT a changelog.

- Architecture and search internals → [`docs/SYSTEM_DESIGN.md`](docs/SYSTEM_DESIGN.md)
- Per-platform scraping status → [`docs/PLATFORM_STATUS.md`](docs/PLATFORM_STATUS.md)
- Gotchas and lessons learned → [`docs/PITFALLS.md`](docs/PITFALLS.md)
- Server SSH, n8n, deployment → [`docs/SERVER_REFERENCE.md`](docs/SERVER_REFERENCE.md)
- B2B feature scope and truth → [`docs/B2B_FEATURE_TRUTH.md`](docs/B2B_FEATURE_TRUTH.md)
- Cost model → [`docs/FIRECRAWL_PRICING.md`](docs/FIRECRAWL_PRICING.md) + `node scripts/cogs-per-search.mjs`
- Marketing/carousel operation → [`docs/marketing/POSTS_README.md`](docs/marketing/POSTS_README.md)

**Maintenance rule for every session:**
1. Update the "Current state" section below if you change anything structural
2. Update the relevant doc file (PLATFORM_STATUS, PITFALLS, etc.) — not this file — for the details
3. Add one bullet under "Recent changes" (last 3–5 sessions only; delete older ones)
4. If you fix an open issue below, remove it from the list

---

## Current state (2026-06-30)

**Platforms: 9 total, 8 native (Avenue A), 1 Firecrawl-only (Avenue B)**
Note: Mercari and Depop are both native-first with a Firecrawl fallback — they raw-HTTP-403 the datacenter IP but real Chromium renders most searches, so they're free most of the time and only pay a Firecrawl credit on an actual render miss. (Mercari's misclassifying hard-block probe was removed 2026-06-29.) The other 6 native platforms are free always. eBay has no native path at all.

| Platform | Avenue | Status |
|---|---|---|
| Grailed | A | ✅ |
| Depop | A | ✅ (native-first, Firecrawl fallback on intermittent fingerprint block — never pre-probed) |
| Mercari | A | ✅ (native-first, Firecrawl fallback on intermittent render miss — like Depop; probe removed 2026-06-29) |
| ThredUp | A | ✅ |
| Vestiaire | A | ✅ |
| Vinted | A | ✅ |
| Poshmark | A | ✅ |
| StockX | A | ✅ |
| eBay | B | ✅ (intermittent Akamai blocks) |
| RealReal | — | ❌ disabled (PerimeterX) |

Full per-platform details, selectors, and open issues: [`docs/PLATFORM_STATUS.md`](docs/PLATFORM_STATUS.md)

**Tier caps (lib/stripe.ts — single source of truth; revised 2026-06-29 to pass through Avenue A cost savings):**
- Free: 5 searches/wk, 2 alerts, 50 tracked listings, 15 native results/search
- Pro: 40 searches/wk, 8 alerts, 500 tracked listings, 60 native results/search
- Max: 120 searches/wk, 20 alerts, unlimited tracked listings, 100 native results/search
- Caps are stored on `profiles` columns (`max_searches_per_period`, `max_saved_searches`, `max_tracked_listings`, `native_results_cap`) AND derived in `TIER_CAPS`. Enforcement reads DB-first, so a TIER_CAPS change needs a `profiles` backfill for existing users (done 2026-06-29 for the 19 current free users). `nativeResultsCap` is the exception — always read live from TIER_CAPS.
- Overage: prepaid credit packs (`lib/creditPacks.ts`): 100/$10, 300/$25, 1000/$60. `priceUsd` is display-only — owner must provision matching Stripe one-time prices ($10/$25/$60) or charged ≠ displayed. Drawn from `profiles.search_credits` after the period cap.

**Margin calculator (lib/marketplaceFees.ts):** covers 7 sell-on platforms (eBay, Poshmark, Mercari, Grailed, Depop, Vinted, StockX). ThredUp is source-from only — not in the fee calc. All rates verified 2026-06-28.

**Brand alias matching (lib/queryExpansion.ts):** live. Static map covers bape/a bathing ape, cdg, fog/fear of god, tnf, assc, stussy, polo ralph lauren, new balance. LLM enrichment (gpt-4o-mini via sidecar `/expand-query`) cached 7d. `primeExpansion(query)` awaited in `searchWorker.ts` before dispatch.

**Alert cache (lib/searchCache.ts):** `withListingsCache` wraps `runSearchJob` in `alertRunner.ts`. 50 users watching same query = 1 scrape fanned out.

**Alerts pipeline (recurrence is server cron, NOT Vercel):** the app is self-hosted on Hetzner via systemd — there is no Vercel Cron. `/api/cron/run-alerts` (Bearer `CRON_SECRET`) is driven by a crontab line on `5.78.187.97` (`*/15 * * * *`, logs `/var/log/crawli-alerts.log`). It selects `saved_searches` where `next_run_at <= now()` and `paused=false` (all users, ≤20/tick), runs each via `runAlert`, reschedules `next_run_at` to next 9 AM in the owner's tz. Each non-first run inserts a `notifications` row (daily, even 0 new) + `alert_matches` rows when new; email only when new. **Without that crontab line nothing recurs** — this was the 28-day silent-alerts bug (next_run_at frozen in the past).

**Supabase tables (must exist in prod):**
- `search_listings_cache(key text pk, listings jsonb, expires_at timestamptz)`
- `query_expansion_cache(query_norm text pk, payload jsonb, expires_at timestamptz)`
- `notifications(id, user_id, alert_id, new_count, seen, created_at)` — one row per alert run; drives the nav bell badge (count of `seen=false`). In the `supabase_realtime` publication.
- `alert_matches(id, user_id, alert_id, notification_id, url, title, price, currency, image, platform, seller, size, condition, color, seen, found_at)` — the new listings per run; powers "click alert → view matches". Pruned to ~100/alert.
- All need `GRANT SELECT/INSERT/UPDATE/DELETE TO authenticated, service_role` (see `docs/migrations/alert-notifications.sql`)

**Landing page:** 9 platforms (all updated 2026-06-29). Margin calculator copy says "7 platforms" — correct, intentional.

---

## Open issues

**eBay Akamai blocks (intermittent)**
~1 in 5 eBay listing scrapes returns HTTP 403. Structured extractor logs `[structured] crawl failed`, LLM fallback runs on partial content. Not worth fixing now. Options if it worsens: residential proxy, eBay Browse API (OAuth required), paid unlocker.

**`_DRIVER_DEAD_PATTERNS` missing one error string**
`"Target page, context or browser has been closed"` is not in `main.py`'s `_DRIVER_DEAD_PATTERNS`. If Playwright context dies from antibot, the pool member stays broken instead of auto-recovering. Fix: add that string to the tuple. Small, safe change.

**StockX SSR vs live price drift**
Possible that `trade-box-buy-amount` in SSR HTML differs from live hydrated DOM. User decision: leave as-is. Add "scraped at" timestamp if user complaints arrive.

**Supabase cache tables may not exist in prod yet**
`search_listings_cache` and `query_expansion_cache` were designed in Session 4 but may not have been applied to the live project. Check via `docs/PLATFORM_STATUS.md` or Supabase MCP `list_tables`. Apply via `apply_migration` with GRANTs.

---

## Recent changes

**2026-06-30 — Poshmark/StockX grid images fixed (lazy-load scroll)**
Cards below the fold on both grids were missing/wrong images (Poshmark: "No image"; StockX: gray-X placeholder graphic) because both lazy-swap images via IntersectionObserver and the scraper captured HTML before scrolling. Added a scroll script (`js_code`, runs after `wait_for`) in `main.py` for both platforms; extractors also fall back to `data-src` (Poshmark) and null out the StockX placeholder URL if it's still unswapped. See `docs/PITFALLS.md` → "Poshmark/StockX grid cards lazy-load images".

**2026-06-30 — Mobile overflow fixes (settings, profile, alerts)**
- Three real horizontal-overflow culprits on protected pages at ≤375px (all public pages were already clean): settings `Row` didn't stack so the long email + fixed `w-48` quota bars pushed off-screen; profile `RecentSearches` platform list collided with the timestamp; alerts `SavedSearchCard` squeezed the title/platforms into a sliver beside 3 fixed action buttons.
- Fixes: settings `Row` now `flex-col … sm:flex-row` (value wraps under label on mobile) + email `break-all`; `RecentSearches` platform list `hidden sm:inline` + `truncate max-w-[45%]`; `SavedSearchCard` actions drop to their own row on mobile (`flex-col … sm:flex-row`, actions `flex-wrap`). Desktop layout unchanged. Verified at 360/375px and 1280px via a throwaway harness rendering the real components with worst-case data (long email, all 9 platforms). See `docs/PITFALLS.md` → "Mobile horizontal overflow".
- Also: search-history row actions ("Search again" / delete) were hover-only (`opacity-0 group-hover:opacity-100`) and thus invisible on touch devices — now always visible at every width (dropped the now-dead `group` + opacity classes).

**2026-06-30 — Alerts recurrence fixed + edit + in-app notifications**
- **Root cause of "alerts stuck on a past date":** `/api/cron/run-alerts` was never triggered in prod (no Vercel Cron — app is systemd-hosted; crontab had only smoke + credits jobs). Added `*/15 * * * *` crontab line on `5.78.187.97` hitting the endpoint with `CRON_SECRET`. Verified: first tick processed the 1 due alert, 70 backlog matches.
- **Edit alerts:** `PATCH /api/saved-searches/[id]` now supports editing query/platforms/criteria — baseline-invalidating edits reset `last_seen_urls`/`unread_match_count`, drop stale `alert_matches`, charge 1 search, and re-run immediately (mirrors creation). Pause/no-op edits stay free. `CreateAlertModal` reused via `editingAlert` prop; Edit button on `SavedSearchCard`.
- **In-app notifications:** new `notifications` + `alert_matches` tables (migration `docs/migrations/alert-notifications.sql`). Each non-first run inserts a notification (daily regardless of new matches) → nav bell badge = unseen notification count (repointed from summing `unread_match_count`); email only when new. Click an alert → `AlertMatchesModal` renders stored matches via `ListingCard`. Visiting /alerts marks notifications seen; opening matches marks that alert's matches seen.
- **Security check (no change needed):** verified all `(protected)` pages 307→/login and all sensitive APIs 401 when logged out (three layers: layout `getUser()`, per-route checks, RLS).

**2026-06-29 — Mercari reclaimed as native-first (probe removed)**
- Verified on the prod Hetzner IP: Mercari raw-HTTP-403s but real Chromium renders ~3/4 of searches (`patagonia vest`, `carhartt jacket`, `levis 501`, `north face fleece` all hit `[mercari-grid]`; `nike windbreaker` fell back to Firecrawl). The "hard-block" probe was misclassifying it.
- Removed Mercari from `FIRECRAWL_PROBE_PLATFORMS` (server `/opt/crawli/.env` set empty + repo `main.py` default changed `"mercari"`→`""` with corrected comments). Now native-first + Firecrawl fallback, like Depop — most searches free instead of paying Firecrawl every time.
- **Deploy note:** the live server is already correct via `.env`; `git pull` + restart will ship the matching code default. Mercari is the only platform that was effectively non-native (besides eBay); nothing else to convert.

**2026-06-29 — Tier caps raised (Avenue A savings passed to users)**
- `TIER_CAPS` (lib/stripe.ts): searches 3/20/70→5/40/120, alerts 1/3/10→2/8/20, tracked 50/200/1000→50/500/unlimited (1,000,000 sentinel), native results 10/40/80→15/60/100. Credit packs: 50/$20·150/$50·500/$150 → 100/$10·300/$25·1000/$60.
- Backfilled all 19 existing `profiles` rows to the new caps (all free tier). Enforcement fallbacks bumped (search DEFAULT_FREE_CAP, saved-searches route, SearchProgress). Aligned the alert-creation route's divergent quota model (was hardcoded 10/100 + 30-day period) to the DB column + weekly reset.
- Frontend copy synced: PricingCards, landing SearchMock + faqData, SearchAlertsTab (now reads real caps from billing API). Native-platform tooltip corrected to 8 native / eBay-only "other".
- **Owner action:** provision Stripe one-time pack prices ($10/$25/$60). Subscription prices unchanged ($10 Pro / $30 Max) — see note below if you want the $12/$29 from the cost analysis.

**2026-06-29 — Cost model corrected for Mercari native-first**
- SYSTEM_DESIGN §6, FIRECRAWL_PRICING (current model), and `scripts/cogs-per-search.mjs` corrected: per-search ~$0.006 (Firecrawl Standard) / ~$0.019 (Hobby), down from the stale ~$0.021 (which priced Mercari as always-Firecrawl). eBay is now the only material per-search cost.
- cogs script rewritten to the Avenue A model (eBay 4-credit discovery + ~1-in-4 fallback on Depop/Mercari; OpenAI residual $0.001); it was still modelling 8 Firecrawl platforms + $0.019 LLM.
- FIRECRAWL_PRICING.md Brave/hybrid section remains historical.

**2026-06-29 — Deploy fix: `unzip` required on server + npm install/build order corrected**
- Fixed deploy order in `docs/SERVER_REFERENCE.md`: `npm install` must run before `npm run build` (was reversed)
- Server was missing `unzip`, breaking Puppeteer's Chrome download during `npm install`; installed via apt
- See `docs/PITFALLS.md` Infrastructure section for the stale-cache symptom and fix

**2026-06-29 — Session 4: Avenue A migration + alias matching**
- All 8 native platforms now on Avenue A (vestiaire, vinted, poshmark, stockx extractors added to `search_page_extractors.py`)
- `lib/queryExpansion.ts` + alias-aware `parse.ts` anchoring (bape→A Bathing Ape etc.)
- `primeExpansion(query)` wired in `searchWorker.ts`; `withListingsCache` wired in `alertRunner.ts`
- `'tshirt'` added to RELEVANCE_STOPWORDS (was an anchor that never matched "t-shirt" in titles)
- Landing pages updated to 9 platforms; vestiaire re-added everywhere

**2026-06-29 — B2B Session 3: landing page reseller revamp**
- HowItWorks, BentoFeatures, Hero, faqData, PricingCards rewritten for reseller audience
- Positioning: sourcing intelligence (comp pricing, flip margin, alerts) — NOT cross-listing
- Source of truth for feature claims: `docs/B2B_FEATURE_TRUTH.md`

**2026-06-29 — n8n content brief pivot**
- `moMVEnr5L6kGgJTC` (DeepSeek brief) patched with reseller framing + obfuscate-commercial-intent rule
- gpt-4o duplicate (`FMf2nyTQIZNCRa2L`) deactivated
- TikTok-only now (IG dropped). Default export 4:5 (1080×1350).

**2026-06-28 — B2B Session 1: margin calculator + boolean alerts + credit packs**
- `lib/marketplaceFees.ts` (7 sell-on platforms, all rates verified)
- `applyCriteria()` in `alertRunner.ts` (brand AND size AND price AND-only post-filter)
- Prepaid credit pack overage path (`profiles.search_credits`, Stripe one-time checkout)

---

## Environment setup

`.env` required keys:
```
FIRECRAWL_API_KEY=fc-...
LLM_PROVIDER=openai/gpt-4o-mini
OPENAI_API_KEY=sk-proj-...
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
# + STRIPE_PRICE_ID_* for each tier/cycle (see .env.example)
```

LLM fallback: Gemini (`GEMINI_API_KEY`). Do NOT use Anthropic/Groq/Mistral/Ollama — no card on file.

**Dev commands:**
```bash
npm run dev:all      # Next.js :3000 + sidecar :8000
npm run dev          # Next.js only
npm run dev:sidecar  # sidecar only
curl http://localhost:8000/health  # check sidecar
```

**If port 8000 is stuck:** `lsof -ti:8000 | xargs kill -9`
