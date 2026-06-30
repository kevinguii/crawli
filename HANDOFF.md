# Crawli — Handoff

**Last updated:** 2026-06-30

## How to use this file

**HANDOFF.md is the current-state hub** — what is true right now, what is broken, what is open. It is NOT a changelog.

- Architecture and search internals → [`docs/SYSTEM_DESIGN.md`](docs/SYSTEM_DESIGN.md)
- Per-platform scraping status → [`docs/PLATFORM_STATUS.md`](docs/PLATFORM_STATUS.md)
- Gotchas and lessons learned → [`docs/PITFALLS.md`](docs/PITFALLS.md)
- Server SSH, n8n, deployment → [`docs/SERVER_REFERENCE.md`](docs/SERVER_REFERENCE.md)
- B2B feature scope and truth → [`docs/B2B_FEATURE_TRUTH.md`](docs/B2B_FEATURE_TRUTH.md)
- **Growth/marketing gameplan (distribution + conversion roadmap)** → [`docs/GROWTH_PLAN.md`](docs/GROWTH_PLAN.md)
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

**Alerts pipeline (recurrence is server cron, NOT Vercel):** the app is self-hosted on Hetzner via systemd — there is no Vercel Cron. `/api/cron/run-alerts` (Bearer `CRON_SECRET`) is driven by a crontab line on `5.78.187.97` (`*/15 * * * *`, logs `/var/log/crawli-alerts.log`). It selects `saved_searches` where `next_run_at <= now()` and `paused=false` (all users, ≤20/tick), runs each via `runAlert`, reschedules `next_run_at` to the next 9 AM in the owner's tz, `cadence_hours` days out (24=daily, 168=weekly — `lib/alertSchedule.ts`). Each non-first run inserts a `notifications` row (regardless of cadence, even 0 new) + `alert_matches` rows when new; email only when new. **Without that crontab line nothing recurs** — this was the 28-day silent-alerts bug (next_run_at frozen in the past).

**Supabase tables (must exist in prod):**
- `search_listings_cache(key text pk, listings jsonb, expires_at timestamptz)`
- `query_expansion_cache(query_norm text pk, payload jsonb, expires_at timestamptz)`
- `notifications(id, user_id, alert_id, new_count, seen, created_at)` — one row per alert run; drives the nav bell badge (count of `seen=false`). In the `supabase_realtime` publication. Never pruned — also powers the per-alert run-history view (`GET /api/saved-searches/[id]/history`).
- `alert_matches(id, user_id, alert_id, notification_id, url, title, price, currency, image, platform, seller, size, condition, color, seen, found_at)` — the new listings per run; powers "click alert → view matches", grouped by `notification_id` into per-day sections. Pruned to ~100/alert, so older days may show a run-history entry with no cards.
- `stripe_webhook_events(event_id text pk, type text, processed_at timestamptz)` — idempotency ledger; webhook claims each `event.id` before processing, skips duplicates, deletes the claim on failure so retries re-run. service_role-only. (migration `docs/migrations/stripe-webhook-idempotency.sql`)
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

**2026-06-30 — Phase 2 compare pages + GEO fixes**
- 15 public `/compare/[slug]` pages (ISR, cached daily, no auth required) — `app/compare/[slug]/page.tsx`. Scrape cron: `POST /api/compare/refresh` (CRON_SECRET bearer) — add crontab line `0 6 * * *` on server before pages will show data. DB tables: `compare_items` (slug registry) + `compare_snapshots` (cached stats + listings). Both applied to prod.
- GEO: `public/.well-known/ai.txt`, `public/ai/summary.json`, `/ai/faq.json`, `/ai/service.json`. RSS feed at `/feed.xml` + `<link rel="alternate">` in layout `<head>`.
- Footer: brand-gradient top border, bigger padding + icons (22px), platform brand-color hover glow, Blog link removed.
- Stripe idempotency migration applied to prod (previous session).

**2026-06-30 — Growth gameplan doc + SEO/AEO entity signals**
Wrote `docs/GROWTH_PLAN.md` — the full distribution/conversion roadmap (data diagnosis, phased plan, owner checklist) so any session can continue the marketing push. Shipped Phase 1 SEO code: `public/llms.txt`, Organization `sameAs`/`alternateName`/`foundingDate` in `StructuredData.tsx`, and social links in landing `Footer.tsx`. Next planned: Phase 2 public `/compare/[slug]` page (not built). On-page SEO was already strong; brand-rank gap is off-page (age/backlinks/entity).

**2026-06-30 — Stripe webhook idempotency + local billing test**
Added `stripe_webhook_events` ledger so a re-delivered `checkout.session.completed` can't double-grant credits (claim-with-rollback in `app/api/webhooks/stripe/route.ts`). Confirmed the credit-grant path is correct end-to-end via new `scripts/test-credit-webhook.mjs` (0→100 on grant, duplicate skipped, no double-grant). Root cause of "credits never granted in dev" was just that Stripe can't reach localhost without `stripe listen` — code was fine. See `docs/PITFALLS.md` → Payments.

**2026-06-30 — Weekly cadence option for search alerts**
Alerts could only check daily (`cadence_hours` hardcoded to `24` end-to-end). Added `168` (weekly) as a second valid value — floating 7-day interval, still anchored to 9 AM in the owner's timezone, no day-of-week picker. Fixed `nextAnchoredRunAt` in `lib/alertSchedule.ts`, which previously ignored `cadenceHours` entirely (always found "next 9 AM," which only worked for daily by coincidence) — see `docs/PITFALLS.md`. `CreateAlertModal` now has a real Daily/Weekly toggle and the edit flow actually persists cadence changes (it silently dropped `cadence_hours` from the PATCH body before). No schema migration, no cron change.

**2026-06-30 — Landing page reorder: proof before CTA, redundancy cut**
- Removed `HowItWorks` (fully redundant with `BentoFeatures` hero cards); anchor `#how-it-works` now lives on `BentoFeatures`
- New section order: Hero → SearchMock → PlatformLogos → BentoFeatures → AlertsMock → AboutSection → SavesMock → FounderNote → CTASection → FAQ → Footer
- `FounderNote` (trust) now precedes `CTASection` (was reversed); `SavesMock` de-emphasized vs `AlertsMock`; gradient-text signature reserved for Hero headline only

**2026-06-30 — Alert matches grouped by run date in UI**
`AlertMatchesModal` now fetches `GET /api/saved-searches/[id]/history` (one row per `notifications` entry, up to 365) alongside the existing `/matches` query and groups matches by `notification_id` under a date header (e.g. "Jun 30, 2026 · 11 new"). Days whose `new_count > 0` but whose matches have since been pruned (beyond the 100/alert cap) show "No longer available" instead of silently disappearing. The 100-match cap itself is unchanged — this only adds visibility into run history, which was already being recorded but never surfaced.

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
