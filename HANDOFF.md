# Crawli — Handoff

**Last updated:** 2026-06-29

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

## Current state (2026-06-29)

**Platforms: 9 total, 8 native (Avenue A), 1 Firecrawl (Avenue B)**

| Platform | Avenue | Status |
|---|---|---|
| Grailed | A | ✅ |
| Depop | A | ✅ (Firecrawl fallback if IP-blocked) |
| Mercari | A | ✅ (always Firecrawl, hard datacenter block) |
| ThredUp | A | ✅ |
| Vestiaire | A | ✅ |
| Vinted | A | ✅ |
| Poshmark | A | ✅ |
| StockX | A | ✅ |
| eBay | B | ✅ (intermittent Akamai blocks) |
| RealReal | — | ❌ disabled (PerimeterX) |

Full per-platform details, selectors, and open issues: [`docs/PLATFORM_STATUS.md`](docs/PLATFORM_STATUS.md)

**Tier caps (lib/stripe.ts — single source of truth):**
- Free: 3 searches/wk, 1 alert, 10 native results/search
- Pro: 30 searches/wk, 5 alerts, 30 native results/search
- Max: 100 searches/wk, 20 alerts, 60 native results/search
- Overage: prepaid credit packs (`profiles.search_credits`), drawn down after period cap. Prices in Stripe, owner provisions. Pack config in `lib/creditPacks.ts`.

**Margin calculator (lib/marketplaceFees.ts):** covers 7 sell-on platforms (eBay, Poshmark, Mercari, Grailed, Depop, Vinted, StockX). ThredUp is source-from only — not in the fee calc. All rates verified 2026-06-28.

**Brand alias matching (lib/queryExpansion.ts):** live. Static map covers bape/a bathing ape, cdg, fog/fear of god, tnf, assc, stussy, polo ralph lauren, new balance. LLM enrichment (gpt-4o-mini via sidecar `/expand-query`) cached 7d. `primeExpansion(query)` awaited in `searchWorker.ts` before dispatch.

**Alert cache (lib/searchCache.ts):** `withListingsCache` wraps `runSearchJob` in `alertRunner.ts`. 50 users watching same query = 1 scrape fanned out.

**Supabase tables (must exist in prod):**
- `search_listings_cache(key text pk, listings jsonb, expires_at timestamptz)`
- `query_expansion_cache(query_norm text pk, payload jsonb, expires_at timestamptz)`
- Both need `GRANT SELECT/INSERT/UPDATE/DELETE TO authenticated, service_role`

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

**2026-06-21 — Color sort boost**
- `resolveColorKey()` + `sortByColorMatch()` in `lib/colorFilter.ts`
- Structured color from JSON-LD on ThredUp, Poshmark, eBay, StockX, Vinted
- Sort boost only — color never drops a listing (§7 J design decision, still holds)

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
