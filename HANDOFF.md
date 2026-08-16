# Crawli — Handoff

**Last updated:** 2026-08-15

## How to use this file
 
**HANDOFF.md is the current-state hub** — what is true right now, what is broken, what is open. It is NOT a changelog.

- Architecture and search internals → [`docs/core/SYSTEM_DESIGN.md`](docs/core/SYSTEM_DESIGN.md)
- Per-platform scraping status → [`docs/core/PLATFORM_STATUS.md`](docs/core/PLATFORM_STATUS.md)
- Gotchas and lessons learned → [`docs/core/PITFALLS.md`](docs/core/PITFALLS.md)
- Server SSH, n8n, deployment → [`docs/reference/SERVER_REFERENCE.md`](docs/reference/SERVER_REFERENCE.md)
- B2B feature scope and truth → [`docs/reference/B2B_FEATURE_TRUTH.md`](docs/reference/B2B_FEATURE_TRUTH.md)
- **Growth/marketing gameplan (distribution + conversion roadmap)** → [`docs/planning/GROWTH_PLAN.md`](docs/planning/GROWTH_PLAN.md)
- Cost model → [`docs/reference/FIRECRAWL_PRICING.md`](docs/reference/FIRECRAWL_PRICING.md) + `node scripts/cogs-per-search.mjs`
- Marketing/carousel operation → [`docs/marketing/POSTS_README.md`](docs/marketing/POSTS_README.md)

**Maintenance rule for every session:**
1. Update the "Current state" section below if you change anything structural
2. Update the relevant doc file (PLATFORM_STATUS, PITFALLS, etc.) — not this file — for the details
3. Add one bullet under "Recent changes" (last 3–5 sessions only; delete older ones)
4. If you fix an open issue below, remove it from the list

---
 
## Current state (2026-08-15)

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

Full per-platform details, selectors, and open issues: [`docs/core/PLATFORM_STATUS.md`](docs/core/PLATFORM_STATUS.md)

**Tier caps (lib/stripe.ts — single source of truth; revised 2026-06-29 to pass through Avenue A cost savings):**
- Free: 5 searches/wk, 2 alerts, 50 tracked listings, 15 native results/search
- Pro: 40 searches/wk, 8 alerts, 500 tracked listings, 60 native results/search
- Max: 120 searches/wk, 20 alerts, unlimited tracked listings, 100 native results/search
- Caps are stored on `profiles` columns (`max_searches_per_period`, `max_saved_searches`, `max_tracked_listings`, `native_results_cap`) AND derived in `TIER_CAPS`. Enforcement reads DB-first, so a TIER_CAPS change needs a `profiles` backfill for existing users (done 2026-06-29 for the 19 current free users). `nativeResultsCap` is the exception — always read live from TIER_CAPS.
- Overage: prepaid credit packs (`lib/creditPacks.ts`): 100/$10, 300/$25, 1000/$60. `priceUsd` is display-only — owner must provision matching Stripe one-time prices ($10/$25/$60) or charged ≠ displayed. Drawn from `profiles.search_credits` after the period cap.

**Margin calculator (lib/marketplaceFees.ts):** covers 7 sell-on platforms (eBay, Poshmark, Mercari, Grailed, Depop, Vinted, StockX). ThredUp is source-from only — not in the fee calc. All rates verified 2026-06-28.

**Brand alias matching (lib/queryExpansion.ts):** live. Static map covers bape/a bathing ape, cdg, fog/fear of god, tnf, assc, stussy, polo ralph lauren, new balance. LLM enrichment (gpt-4o-mini via sidecar `/expand-query`) cached 7d. `primeExpansion(query)` awaited in `searchWorker.ts` before dispatch.

**Alert cache (lib/searchCache.ts):** `withListingsCache` wraps `runSearchJob` in `alertRunner.ts`. 50 users watching same query = 1 scrape fanned out.

**Alerts pipeline (recurrence is server cron, NOT Vercel):** the app is self-hosted on Hetzner via systemd — there is no Vercel Cron. `/api/cron/run-alerts` (Bearer `CRON_SECRET`) is driven by a crontab line on `5.78.187.97` (`*/15 * * * *`, logs `/var/log/crawli-alerts.log`). It selects `saved_searches` where `next_run_at <= now()` and `paused=false` (all users, ≤20/tick), runs each via `runAlert`, reschedules `next_run_at` to the next 9 AM in the owner's tz, `cadence_hours` days out (24=daily, 168=weekly — `lib/alertSchedule.ts`). Each non-first run inserts a `notifications` row (regardless of cadence, even 0 new) + `alert_matches` rows when new; email only when new. **First run (creation, or a baseline-resetting edit) writes no `notifications`/`alert_matches` rows but does send one baseline email** — "N listings match right now across M marketplaces", explicitly labelled as the starting point, with a separate zero-match variant (`buildBaselineEmailHtml` in `lib/email/alertEmailTemplate.ts`, sent from `runAlert`'s `isFirstRun` branch). **Without that crontab line nothing recurs** — this was the 28-day silent-alerts bug (next_run_at frozen in the past).

**Sold comps (shipped 2026-08-10):** `lib/soldComps/` returns median completed-sale price, p25-p75, sample size, window and days-to-sell for **Grailed + Poshmark only**. Pure TypeScript, plain HTTP, **no sidecar involvement** — Grailed via its `Listing_sold_production` Algolia index, Poshmark via `availability=sold_out&sort_by=recently_sold` parsed out of `window.__INITIAL_STATE__`. `FlipMargin` seeds its resale price from median sold rather than average ask. `POST /api/sold-comps` is auth-gated, cached 24h in `sold_comps_cache`, and **charges no search credit**. Reported per platform — there is deliberately no pooled cross-platform median (the two carry different inventory for the same query; see PITFALLS). Mercari and ThredUp were dropped on probe evidence. Verify with `npx tsx scripts/verify-sold-comps.mts` (33 checks). Details: `docs/planning/COMPETITIVE_POSITIONING.md` §5 Step 1 + EXP-004.

**Sold comps has two surfaces (2026-08-11):** embedded via `SoldCompsPanel.tsx` inside `PriceSummary` on a search result, and standalone at `/price-check` in primary nav — the query-input-plus-panel-plus-margin-calc UI is shared via `app/components/SoldCompsLookup.tsx`, used by both `TailStep` (onboarding) and the `/price-check` page, so checking a price never requires running a search. The buy-price input links to Settings' "Platform fees" table (`/settings#platform-fees`, opens in a new tab) to explain how the margin numbers are derived.

**Onboarding flow (shipped 2026-08-10, polished 2026-08-11):** every account with `profiles.onboarding_completed_at IS NULL` is blocked into `/onboarding` by the gate in `(protected)/layout.tsx`, applying to the 39 pre-existing users as well as new signups. State lives on four `profiles.onboarding_*` columns — `onboarding_persona` (`buyer`/`reseller`), `onboarding_started_at`, `onboarding_completed_at` (the gate), `onboarding_step`. `PATCH /api/onboarding` drives it; `app/onboarding/OnboardingFlow.tsx` and its 5 `steps/` screens (Branch, Seed, Criteria, Alert, Tail) branch by persona, with back navigation through all 5 (`prevStep()` in `lib/onboarding.ts`) locked only once the alert exists — editing an earlier answer can't retroactively change what was already posted to `/api/saved-searches`. Settings has an "Onboarding" row (`/onboarding?replay=1`, button labelled "Redo onboarding"). **The flow charges nothing** — it calls only `/api/sold-comps` and `/api/saved-searches`, never `/api/search`, so `searches_used_this_period`/`search_credits` are untouched. Verify with `npx tsx scripts/verify-onboarding.mts`. Details: `docs/planning/COMPETITIVE_POSITIONING.md` §5 Step 2(a) + EXP-001.

**Supabase tables (must exist in prod):**
- `sold_comps_cache(key text pk, payload jsonb, expires_at timestamptz)` — 24h TTL; only successful lookups are cached, so a transient upstream failure isn't pinned for a day. (migration `docs/migrations/sold-comps-cache.sql`)
- `search_listings_cache(key text pk, listings jsonb, expires_at timestamptz)`
- `query_expansion_cache(query_norm text pk, payload jsonb, expires_at timestamptz)`
- `notifications(id, user_id, alert_id, new_count, seen, created_at)` — one row per alert run; drives the nav bell badge (count of `seen=false`). In the `supabase_realtime` publication. Never pruned — also powers the per-alert run-history view (`GET /api/saved-searches/[id]/history`).
- `alert_matches(id, user_id, alert_id, notification_id, url, title, price, currency, image, platform, seller, size, condition, color, seen, found_at)` — the new listings per run; powers "click alert → view matches", grouped by `notification_id` into per-day sections. Pruned to ~100/alert, so older days may show a run-history entry with no cards.
- `stripe_webhook_events(event_id text pk, type text, processed_at timestamptz)` — idempotency ledger; webhook claims each `event.id` before processing, skips duplicates, deletes the claim on failure so retries re-run. service_role-only. (migration `docs/migrations/stripe-webhook-idempotency.sql`)
- All need `GRANT SELECT/INSERT/UPDATE/DELETE TO authenticated, service_role` (see `docs/migrations/alert-notifications.sql`)

**Protected app shell (2026-07-02):** all `(protected)/*` pages share one chrome via `app/components/shell/AppShell.tsx` (mounted in `(protected)/layout.tsx`). It renders a persistent, retractable left sidebar (`AppSidebar.tsx`) on `lg+` and a hamburger drawer below `lg`. Nav = Search · Alerts (unread badge) · Price Check · Saves · History, plus footer Upgrade / Home (`/`) / account menu (Profile/Settings/Pricing/Sign out). Collapse state persists to `localStorage` (`crawli_sidebar_collapsed`). The old top-right `AuthButton` is gone — its hooks + `markIntentionalSignOut` now live in `app/components/shell/nav-hooks.ts`; unread/plan are fetched once in `AppShell` and passed to `AppSidebar` as props (do NOT re-call `useTotalUnreadAlerts` in a second mounted component — see PITFALLS realtime channel note). Per-page `<nav>`/`<AuthButton>` were removed from all 7 protected pages/layouts; pages now render a plain content `<div>`, not their own `<main>`.

**Account deletion:** users can self-delete via Settings → "Delete account" (type-to-confirm modal) → `DELETE /api/settings/delete-account` → `admin.auth.admin.deleteUser`.

**Compare pages + blog (verified 2026-07-26):** 33 rows in `compare_items` → 33 `/compare/[slug]` pages (`app/compare/[slug]/page.tsx`, carries `FAQPage` schema). Category mix: luxury-handbags 12, sneakers 5, hoodies 4, luxury-watches 3, outerwear 3, tops 2, luxury-accessories 2, denim 1, luxury-jewelry 1 — i.e. 18 luxury / 15 streetwear. `content/blog/` holds 116 posts, of which 33 carry `compareSlug` (one per compare item). The blog's Price Guides tab count is *derived* — `priceGuidesCount={priceGuidePosts.length}` in `app/blog/page.tsx` — so it tracks `compare_items` automatically and needs no manual bump. Refresh path is `/api/compare/refresh` (applies `filterAuthentic()`, see Open issues); results cache in `compare_snapshots`, read back by `getCompareHeroData()` in `lib/compare.ts` for the landing hero.

**Auth bot protection:** Cloudflare Turnstile on the auth forms via `app/components/TurnstileWidget.tsx` — mounted in `app/login/page.tsx`, `app/forgot-password/page.tsx`, `app/check-email/page.tsx`.

**Landing page:** comparison-first structure (2026-07-08), rebuilt for AI-referred visitors 2026-08-13. Order: Hero (live `CompareHeroWidget` — rotates real per-platform prices for 5 curated compare items, right column; plus `HeroSearch.tsx`, a public no-auth typeahead over all 33 `compare_items` that routes matches to `/compare/[slug]` and misses to `/compare/search?q=`) → PlatformLogos → Testimonials (two real attributed quotes, no Review schema on purpose) → CompareSection (full item grid) → AlertsAndTrackedSection (combined tabbed pitch, replaces old AlertsMock+SavesMock) → MarginSection (demoted `FlipCalculator`, moved out of the hero) → BentoFeatures (trimmed to 3 supporting cards — 9-platform search, price intelligence, smart filters). `CompareHeroWidget` reads only the existing `compare_snapshots` cache via new `getCompareHeroData()` in `lib/compare.ts` — no new scrape, no new endpoint. Curated hero rotation slugs: `jordan-1-retro-high`, `bape-shark-hoodie`, `carhartt-wip-jacket`, `nike-dunk-low`, `supreme-box-logo-hoodie` (constant in `app/page.tsx`).

---

## Open issues

**ACTION REQUIRED: disable Supabase's legacy API keys (found + mostly fixed 2026-08-15)**
A `service_role` key committed in plaintext across 7 files (still in git history — `git log -S` will find it) is now dead-tree-only: `.env` (local + prod), n8n, and all consuming scripts run on a new `sb_secret_...` key, verified working. **But the leaked JWT itself is still valid** until legacy keys are disabled in Supabase's dashboard (API Keys → "Legacy anon, service_role API keys" tab → Disable) — that's the one step left. Do it once you've confirmed nothing unexpected turns up after a normal day's traffic. Rewriting git history was considered and deliberately skipped — disabling legacy keys makes the historical copy worthless, and a force-push would break existing clones. Revisit only if the repo is ever made public.

**eBay Akamai blocks (intermittent)**
~1 in 5 eBay listing scrapes returns HTTP 403. Structured extractor logs `[structured] crawl failed`, LLM fallback runs on partial content. Not worth fixing now. Options if it worsens: residential proxy, eBay Browse API (OAuth required), paid unlocker.

**StockX SSR vs live price drift**
Possible that `trade-box-buy-amount` in SSR HTML differs from live hydrated DOM. User decision: leave as-is. Add "scraped at" timestamp if user complaints arrive.

**Compare-page floors: authenticity filter shipped, residual gaps remain**
Fixed 2026-07-25 for the luxury set: `filterAuthentic()` in `app/api/compare/refresh/route.ts` drops listings matching replica signals (dupe, inspired, replica, style, vibe, lookalike, shufirst, "like [brand]") plus category-specific wrong-item terms (wallet/charm/ring/book/print ad/jacket for handbags; bracelet/necklace/case-only for watches; etc.), keyed off `compare_items.category`. Scoped to this refresh path only, does not touch `lib/parse.ts` or live search. Confirmed it caught real cases: a $17.96 "Birkin" that was a dust bag, a $125 "Cartier Tank" that was a hardcover book, a $39 "Rolex Datejust" that was a framed print ad, a $36 "Omega Speedmaster" that was a bomber jacket. Streetwear items keep prior behavior (category not in the exclude map).
**Residual, disclosed in the blog posts rather than filtered:** a few implausible outliers still get through title-text matching because nothing in the title says they're wrong — a $131 "Rolex Datejust" (Mercari), a $50.63 "Cartier Love Bracelet" (Depop, physically impossible for solid 18k gold), a couple of Cartier Tank listings that are actually the Santos model or a strap-only sale. Each affected post calls this out explicitly as a buyer-protection tip rather than quoting the number as real. No further filtering planned unless these recur after future refreshes — chasing every edge case with title regex has diminishing returns; a price-plausibility model would be the next real step if this keeps surfacing.

---

## Recent changes

**2026-08-15 — Supabase service_role key rotated in production; CTA copy simplified to "Sign up"**
Legacy `service_role` key (the one scrubbed from the repo earlier today) rotated via Supabase's Publishable/Secret key migration — new `sb_secret_...` key deployed to `.env` (local + prod), n8n credentials, and the daily-email/SEO-brief scripts; verified via a real logged-in `/settings` load (exercises `createAdminClient()` → `profiles`) with zero JWT/permission errors in Supabase logs afterward. Legacy keys not yet disabled in the dashboard — do that once nothing unexpected turns up. Separately, all 7 `CtaLink` instances (`Hero`, `CTASection`, `LandingNav`, `FlipCalculator`, `SoldCompsSection`, `/compare/search`) relabeled from "Start comparing free" (desktop) / "Start free" (mobile nav) to a single "Sign up" everywhere — no `href`/behavior change, all still route to `/login?tab=signup`.

**2026-08-15 — Security sweep: profiles privilege-escalation closed, service_role key scrubbed from the repo**
Repo-wide sweep for the Safari `NotFoundError` Sentry issue turned up two real problems unrelated to it. (1) **Privilege escalation on `public.profiles`** — RLS scoped rows (`auth.uid() = id`) but `authenticated` held table-level `GRANT UPDATE` on all 24 columns, so any logged-in user could PATCH PostgREST directly with the public anon key and set their own `subscription_tier`/`search_credits` or zero their quota counter. Fixed by migration `restrict_profiles_update_to_user_editable_columns`: revoked, then re-granted `UPDATE (display_name, bio, avatar_url)` only — the exact set `PATCH /api/profile` writes. Verified post-apply; `service_role` retains all columns so billing/quota/onboarding are untouched. Full writeup in `docs/core/PITFALLS.md` "Payments + Supabase". (2) **Leaked service_role JWT** — the key was hardcoded in 4 n8n workflow JSONs and 3 scripts under `docs/workflows/` and `scripts/`, present in git history since the first n8n commit. All 7 files now read `SUPABASE_SERVICE_ROLE_KEY` from env / use a `<SUPABASE_SERVICE_ROLE_KEY>` placeholder; **the key itself still needs rotating — see Open issues.** The Sentry error that started this was itself benign browser noise (now suppressed) — see PITFALLS "Infrastructure". Also: `.gitignore` venv entries globbed after a 761MB backup venv blocked a push; 3 stale `docs/superpowers/` spec/plan files deleted per the CLAUDE.md step-7 rule, plus 7 pre-existing dangling references to specs deleted in earlier sessions repaired; Recent changes trimmed from 61 entries to the 3–5 sessions this file's own rule specifies.

**2026-08-13 — DeepSeek added as an available `LLM_PROVIDER` option; tested and not recommended as primary**
`main.py`'s `_PROVIDER_KEY_ENV` was missing a `"deepseek"` entry, so `DEEPSEEK_API_KEY` was silently never read even with `LLM_PROVIDER=deepseek/...` set — fixed. Live A/B test (`deepseek/deepseek-v4-flash` vs current `openai/gpt-4o-mini`) on real listing pages found DeepSeek's hidden reasoning-token overhead makes it more expensive and slower in practice despite a lower headline price; kept `openai/gpt-4o-mini` as the active provider. Full numbers in `docs/core/PITFALLS.md` "LLM / sidecar". Also surfaced a pre-existing, separate bug: Grailed's Tier 2 LLM extraction fallback returns empty regardless of provider (dormant — Tier 1 covers Grailed reliably) — see `docs/core/PLATFORM_STATUS.md` open issues.

**2026-08-13 — GA4 event instrumentation (first custom events on the site)**
GA4 had **zero custom events and zero key events** — only automatic page_view/scroll — so no channel's conversion rate was knowable. New `lib/analytics.ts` exports a typed `track()` that no-ops safely when gtag is absent (dev, or pre-hydration). Four events: `hero_search` {search_term, outcome: match|no_match}, `cta_click` {location}, `sign_up` {method: email}, `onboarding_complete` {persona}. `hero_search` misses are the compare-item roadmap — they record what visitors want that we don't have a page for. `cta_click` goes through new `CtaLink.tsx`, a client wrapper used by all 6 primary CTAs so server-component sections can report click location. `sign_up` fires on the email path only (Google OAuth can't distinguish new from returning client-side); `onboarding_complete` is the method-agnostic activation signal, since every new account is gated through `/onboarding`. **These still need marking as key events in the GA4 UI** (Admin → Events). `hero_search` match/miss and `cta_click` verified firing in a real browser; `sign_up`/`onboarding_complete` code-verified only.

**2026-08-13 — Baseline GA4 numbers, captured before the homepage changes (90 days to 2026-08-13)**
622 sessions: Direct 303, **AI Assistant 112**, Organic Social 78, Organic Search 76, Referral 32. **AI already outsends Google organic by 47%** (`chatgpt.com` 105, perplexity 7, openai 4, copilot 2), and is growing: 10 sessions in June, 69 in July, 33 in the first 13 days of August. 59% of all sessions land on `/`. But AI sessions specifically land on the **blog** more than the homepage (`/blog/best-secondhand-marketplaces-for-luxury-items` 43 vs `/` 32) — the homepage's 370 landings are driven by Direct (227). **The number that matters:** AI sessions landing on `/` engage at 53% for 134s average, versus 35% for 37s on that blog post. Similarweb's claim that AI visitors outperform search visitors does NOT replicate here in aggregate (AI 38% engaged vs Organic Search 51%). GA4 property 539492436; the Analytics Admin API is disabled on GCP project 993676212139, so hardcode the property — the Data API works fine with `~/.config/crawli-sa.json`.

**2026-08-13 — Homepage rebuilt for AI-referred visitors: public search, unified CTA, testimonials**
AI answer engines cite deep pages but send the click to the homepage (Similarweb: homepage share of ChatGPT referrals went from ~26-32% to ~60% after ChatGPT began linking brand names inline on 2026-05-07). Crawli's homepage scored ~4/12 against that visitor. Three fixes: (1) **public search** — new `HeroSearch.tsx` typeahead over the 33 `compare_items` rows already loaded by `app/page.tsx`, so it costs no extra query; matches route to `/compare/[slug]`, misses route to the new `/compare/search?q=` page which server-renders near-matches plus a signup card seeded with the query. (2) **unified CTA** — five different labels for one action ("Get started", "Create free account", "Check a price", "Source live across 9 platforms") collapsed to one label everywhere (copy changed again 2026-08-15, see Recent changes). (3) **testimonials** — new `Testimonials.tsx` with two real attributed quotes, deliberately unmarked-up (Google excludes self-serving reviews from `Organization` rich results). `SearchAction` schema re-added pointing at the new public page, and the blanket `/*?*q=` rule dropped from `robots.ts` — see `docs/core/PITFALLS.md` "SEO / indexing" for the three constraints that keep this from regressing. `npx tsc --noEmit` clean; hit/miss/empty-query and route precedence verified via curl. **Mobile verified at 320px and 375px** (light + dark, logged-in and logged-out nav): no element overflows the viewport on `/` or `/compare/search`. One real bug caught and fixed in that pass — the typeahead dropdown used `--surface`, which is transparent in dark mode, so hero content showed through it; now `--bg-elevated`. See `docs/core/PITFALLS.md`.

**2026-08-11 — Price Check (sold comps) surfaced on the landing page + FAQ**
New `SoldCompsSection.tsx` added between `CompareSection` and `AlertsAndTrackedSection` on `/`, ranked alongside price comparison and alerts per owner request. Static illustrative mock (same pattern as `AlertsAndTrackedSection`) since `/api/sold-comps` is auth-gated and `/api/` routes aren't touched for this kind of change. New FAQ entry added (`faqData.ts`), plus a one-line addition to the "What is Crawli" answer. Copy is scoped factually to Grailed + Poshmark, no efficacy claims — EXP-004 (`docs/planning/COMPETITIVE_POSITIONING.md` §6) is still open/pending, so this stays a factual feature listing rather than a validated marketing claim.

**2026-08-11 — Onboarding polish + sold comps spun off into standalone `/price-check`**
Owner's live walkthrough of the shipped flow surfaced real gaps: no framing that this was onboarding, misleading "check your inbox now" copy (the baseline email takes a few minutes), no way to go back, and unclear where a created alert or sold comps live once the flow ends. Fixed: persistent "Welcome to Crawli" chrome; corrected inbox-timing copy plus an explicit "find/edit this in the Alerts tab" pointer; back navigation across all 5 screens, locked only once the alert exists (editing an earlier answer can't retroactively change what was already posted); Settings' "Redo setup" row relabelled "Onboarding". **Bigger finding:** sold comps was only discoverable by running a search first, even though `/api/sold-comps` never needed one — onboarding's own tail step already proved that. Spun into a new standalone `/price-check` nav destination; the panel-plus-margin-calc UI was extracted into shared `app/components/SoldCompsLookup.tsx`, used by both `TailStep` and the new page. Its buy-price input now links to Settings' "Platform fees" table (new `#platform-fees` anchor, opens in a new tab — same-tab would bounce a still-onboarding user back through the gate and lose their in-progress step). `npx tsc --noEmit`, `eslint`, `npm run build` all clean each round. Full detail: `docs/planning/COMPETITIVE_POSITIONING.md` §5 Step 2(a).

**2026-08-11 — Fee rates corrected in `lib/marketplaceFees.ts` + new Settings "Platform fees" table**
Re-verified all 7 platform fee schedules against current vendor pages/fee trackers ahead of a fee-explainer video. Two were stale: eBay's FVF was still the pre-2025-02-14 13.25% (now 13.6%), and StockX's Level-1 transaction fee was 9.5% (actual levels are 9%/8.5%/8%/7.5%/7% across Level 1→5, so Level-1 default is 9%). Poshmark, Mercari, Grailed, Depop, Vinted already matched — only their `lastVerified` dates were bumped. All entries now dated 2026-08-11; `docs/reference/B2B_FEATURE_TRUTH.md` §1 table and worked example updated to match. New "Platform fees" section added to `app/(protected)/settings/page.tsx`, reading directly from `MARKETPLACE_FEES`/`FEE_PLATFORMS` (no numbers duplicated in the component) so it can't drift from the flip-margin calculator. `npx tsc --noEmit` clean; **browser check (light + dark) still outstanding**.

**2026-08-10 — Sold comps shipped (Step 1) · EXP-004 running**
Crawli now shows what items actually sold for, not just what sellers are asking. New `lib/soldComps/` (Grailed + Poshmark), `POST /api/sold-comps`, `SoldCompsPanel.tsx`, and `FlipMargin` reseeded from median sold instead of average ask — the change that makes claim C5 true. Full writeup: `docs/planning/COMPETITIVE_POSITIONING.md` §5 Step 1.
- **The probe overturned the planned approach.** The old plan assumed adding a `sold` flag to the Python grid extractors. Both shipped platforms are plain HTTP instead, so **the sidecar was not touched at all** — a sold-comps lookup is two requests and ~1s, against ~35s/platform for live search.
- **Mercari dropped, ThredUp ruled out.** Mercari's sold filter (`itemStatuses=2`) works but exposes **no sale date anywhere**, so no days-to-sell, and it needs a browser render. ThredUp has no sold filter at all — `availability=sold` is silently ignored. Both findings are in PITFALLS so they don't get re-probed.
- **No pooled cross-platform median, deliberately.** Grailed and Poshmark carry materially different inventory for the same query (Jordan 1: $125 adult pairs vs $33 mostly youth sizes), so a blended number describes neither. Reported per platform; the calculator seeds from Grailed when it qualifies.
- **Thin data renders nothing.** Window widens 90d → 180d → 365d, and a platform needs n≥10 after relevance filtering and IQR trimming or it's omitted entirely.
- **Step 0 (audience validation) was skipped by owner decision.** This makes a null EXP-004 result ambiguous by construction — it can't separate "sold comps doesn't matter" from "these users were never resellers." The kill criterion in §6c says to run Step 0 before iterating rather than tuning the feature.
- Verified: `npx tsx scripts/verify-sold-comps.mts` 33/33 pass (unit + live across 4 queries + an obscure-query negative case), `npx tsc --noEmit` clean, route returns 401 unauthenticated, cache round-trip confirmed against the real table and GRANTs. **Browser UI check (light + dark) is still the owner's to do.**

**2026-08-10 — Onboarding flow SHIPPED · EXP-001 running**
Measured as EXP-001. Built differently from what §5 Step 2(a) originally described, in four ways that matter:
- **Gate is a DB flag, not a redirect.** `profiles.onboarding_completed_at IS NULL`, checked in `(protected)/layout.tsx` (which already loads the user server-side). So **`login/page.tsx` and `auth/callback/route.ts` are not modified**, and the never-verified "does Supabase preserve a query param on `redirectTo` through the OAuth round trip" assumption is deleted rather than tested. Existing accounts get onboarded too, which was the owner requirement that made the flag approach necessary.
- **Blocking: no skip, no exit until complete**, all users including the current 39. Therefore `/onboarding` lives **outside** `(protected)/` so it cannot be caught by its own gate and renders without `AppShell` nav it would refuse to honour. Every step must advance even when its upstream call fails — a blocking flow with a failing step is a locked account.
- **Costs zero searches.** `/api/sold-comps` charges nothing (its own header says so), alert creation charges nothing (only `max_saved_searches` gates it), and the flow **hands off** to `/search` pre-filled rather than running a search. No refund mechanism, no abuse surface, `/api/search` untouched.
- **Branches on "buying for yourself, or to resell?"** (finally collecting §5 Step 0's question). Alerts are the shared spine of both branches; sold comps sits in the reseller tail; the buyer tail ends with an optional "got anything sitting in your closet?" screen as a buyer→reseller on-ramp.
- **New evidence:** first-session depth predicts return almost perfectly — 1 search on day 1 → **0%** ever returned (0/10), 5+ → **100%** (3/3), monotonic, cliff between 3 and 4. **Users churn before reaching the free cap, not because of it** (only 3 of 28 ever hit 5/week). Recorded as a drift row in `COMPETITIVE_POSITIONING.md` §6a, not a re-baseline.
- **Counting rule worth knowing:** a `search_history` row is a distinct `(user_id, query, platforms, filters)` combo (UNIQUE `search_history_dedupe`), not an attempt and not a charge. 9 rows against a 5 cap is normal.
- **EXP-002 superseded** with 0 exposed users (none of its 24-user cohort ran a search in the ~29h after ship; posting hasn't restarted). Deliberately **not** recorded as `0/24` — that would fire its kill criterion on zero evidence. Its code stays live. **EXP-005 now gated on EXP-001 alone.**
- Built as `PATCH /api/onboarding`, gate in `(protected)/layout.tsx`, `app/onboarding/OnboardingFlow.tsx` + `steps/{BranchStep,SeedStep,CriteriaStep,AlertStep,TailStep}.tsx`, and a Settings "Onboarding" row (`/onboarding?replay=1`). Verified: `npx tsc --noEmit` clean; a repo-wide grep of `app/onboarding/` confirms zero references to `/api/search`, `searches_used_this_period`, or `search_credits`. **Live end-to-end zero-cost proof, new-signup (email + Google OAuth), baseline email receipt, and light/dark/375px checks are still the owner's to do.**

**2026-08-10 — Alert-adoption pass shipped: EXP-002 (now superseded) + EXP-003**
Three of the four planned Step 2 items were live at the time; the onboarding flow (item 1) followed later the same day, shipped in the entry above — this change alone did not touch the signup or auth path. Full experiment blocks, metrics and kill criteria: `docs/planning/COMPETITIVE_POSITIONING.md` §6c "Running".
- **Results-page alert CTA is now primary.** New `app/components/AlertCtaBanner.tsx` replaces the right-aligned `text-sm`/`text-muted` "Save as alert" ghost button in `SearchSection.tsx` with a full-width accent card. Two states: `watching` (an alert already covers this query — quiet confirmation + link to /alerts) and the default pitch. `hasAlert` comes from the existing `GET /api/saved-searches`, compared on normalized query strings; no new endpoint.
- **Creating an alert now navigates to `/alerts`, it does not open a modal over the results.** The CTA pushes `/alerts?new=1&query=…&platforms=…`; `app/(protected)/alerts/page.tsx` parses those into an `autoCreate` prop threaded through `AlertsTabsClient` → `SearchAlertsTab`, which waits for the alerts list *and* billing to load, runs the same quota gate a manual "+ New alert" click goes through, then opens `CreateAlertModal` pre-filled. The URL is `router.replace`d back to `/alerts` on open so a refresh or back-nav doesn't reopen a dismissed form; the prefill is held in a ref, not state (the `showCreate` flip is what re-renders). `SearchSection` no longer imports `CreateAlertModal` at all.
- **A repeat-search trigger was built and reverted the same day** (owner call — two states are enough). Its DB support (`search_history.search_count` + a `record_search()` RPC) was applied to prod and then dropped; **schema is back to its original shape, all 130 rows intact**. Worth keeping from that work: the plan's premise that `search_history` shows queries run 5-6x is **false** — the table upserts on `search_history_dedupe (user_id, query, platforms, filters)`, so identical repeats collapse into one row and those counts are distinct platform/filter variants. True repeat counts have never been recorded and are unrecoverable. Recorded in `docs/core/PITFALLS.md` → Payments + Supabase.
- **Baseline email on first alert run.** The immediate first run already existed; the email did not. `runAlert`'s `isFirstRun` branch now sends one (`buildBaselineEmailHtml`, plus a shared `emailShell` the existing new-matches email was refactored onto — its rendered output is unchanged, verified by rendering all three variants). No `notifications`/`alert_matches` rows on a first run, so "new" keeps its strict meaning. Copy in `CreateAlertModal` and `SearchAlertsTab` that promised "no email then" was corrected.
- **Compound criteria surfaced, and the claim corrected.** `applyCriteria()` supports `size` + `minPrice` + `maxPrice` only — **not** "brand AND keyword", which live in the query string. `CreateAlertModal` gained the missing `minPrice` input (API and matcher already accepted it), a bordered criteria block with a live AND-chain readout and a min>max guard; `SavedSearchCard` now shows criteria as `AND`-joined chips (they were invisible after creation before).
- **Landing dead button fixed:** `AlertsAndTrackedSection.tsx`'s `aria-hidden` "+ New alert" button is now a `Link` to `/login?tab=signup`.
- Verified after the revert: `npx tsc --noEmit` clean (needed `rm -rf .next` — a stale `.next/types` validator still referenced the deleted route), `npm run build` clean, `search_count`/`record_search` confirmed gone from the live DB with `search_history` row count unchanged, all three email variants rendered and read. **Browser UI check (light + dark) is still the owner's to do.**

**2026-08-08 — GSC indexing triage: `/compare` hub added, blog↔compare cannibalization broken up**
GSC showed 35 URLs "Discovered — currently not indexed" (19 blog + 16 compare). Ruled out every technical cause (200s, 110–615ms TTFB, correct self-canonicals, `index, follow`, all in sitemap, all 116 posts linked from `/blog`); the unindexed set is exactly the 2026-07-25 luxury batch, and none of the 35 have a single impression. Two root causes: (1) each `<item>-resale-price` post and its `/compare/<slug>` page competed for the same head term — Google indexes only one per pair; (2) 21 of 33 compare pages had no inbound link except their paired post, since `CompareSection` caps the landing grid at 12 and no `/compare` index existed. Fixes: new `app/compare/page.tsx` hub (all 33 items, grouped by category, `ItemList` schema) linked from `LandingNav` + `Footer` and added to the sitemap; 20 of the 33 price-guide posts retitled onto the "how to vet a cheap listing" intent so the compare page owns the price term (12 with zero impressions, then the 8 that were outranking their own compare page — a deliberate trade of ~330 monthly blog impressions for a shot at indexing those 8 compare pages); dead `SearchAction` schema removed. Details in `docs/core/PITFALLS.md` §SEO.
- **`/compare` used to 404** — `app/compare/` had only `[slug]/` and `layout.tsx`. Google walks parent paths, so it found and reported the 404.
- **Internal linking rebuilt.** Before this session, **no** blog post linked to a `/compare/` page: all 40 in-body "live price" links pointed at `/blog/<slug>-resale-price` instead, reinforcing the very posts that were cannibalizing the compare pages. All 40 repointed to `/compare/<slug>` across 17 posts (18 of them in `best-secondhand-marketplaces-for-luxury-items`, the site's strongest page at 1,740 impr), plus 10 new contextual links into `/compare` and specific items from the highest-impression reseller and authentication posts. Anchor text was already accurate for compare pages ("live", "current", "refreshed daily"), so no rewriting was needed.
- **Still cannibalized:** the 13 streetwear price-guide posts keep their `"<item> Resale Price"` titles because those pairs mostly resolved on their own. `carhartt-wip-jacket` is the one exception showing the broken symptom (blog indexed at 28 impr, compare page crawled-not-indexed) — retitle it if the 20 retitles above work out.

**2026-08-10 (planning, superseded by the entry above) — Sold-comps scope locked + value-prop ledger added**
Step 1 narrowed to **Poshmark + Mercari + Grailed only** (owner decision); eBay and StockX deferred with reasons. Established `docs/planning/COMPETITIVE_POSITIONING.md` §6 as the live value-prop ledger + experiment log (frozen 2026-08-07 baselines, a 6-claim ledger gating what copy may say, kill criteria written before shipping). Two intra-day planning entries that sat here — an onboarding-first plan and an earlier alerts-plan correction — were folded into that doc and removed, because their EXP numbering and scope no longer match what shipped. **`COMPETITIVE_POSITIONING.md` is the source of truth for experiment numbering and status; do not reconstruct it from this changelog.**

**2026-08-07 — Competitive positioning analysis vs Beni/Gem/Underpriced AI**
New decision doc `docs/planning/COMPETITIVE_POSITIONING.md`. Live data pull: 36 users (1 paid), 26 searches/30d across 14 users (1.9/user/month, nowhere near the 5/wk free cap), saves and alerts both frozen at 4 and 2 users while signups doubled, GSC 8,203 impr → 39 clicks (0.48% CTR) over 90d with compare pages at 696 impr / **zero** clicks. Search logs show buyer-side and partly non-fashion queries (Xbox, phone, game collectibles), contradicting the hybrid B2B+B2C framing in `B2B_FEATURE_TRUTH.md` §5. Conclusion: the buyer-side aggregator segment is unwinnable against Beni (~50 marketplaces, $6.26M) and Gem (image search + real-time alerts + indie long tail); the reachable position is cross-platform **sold-price** data for resellers, which Crawli does not have today (search returns live asks only). Gated on a 36-user audience-validation step before any build.

*Older entries (2026-07-25 and back to 2026-06-28) trimmed 2026-08-15 per the 3–5 session rule above; recoverable via `git log -p HANDOFF.md`. The durable lessons from them live in `docs/core/PITFALLS.md`, `PLATFORM_STATUS.md`, and `SYSTEM_DESIGN.md`.*

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
