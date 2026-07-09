# Crawli — Handoff

**Last updated:** 2026-07-08

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

**Alerts pipeline (recurrence is server cron, NOT Vercel):** the app is self-hosted on Hetzner via systemd — there is no Vercel Cron. `/api/cron/run-alerts` (Bearer `CRON_SECRET`) is driven by a crontab line on `5.78.187.97` (`*/15 * * * *`, logs `/var/log/crawli-alerts.log`). It selects `saved_searches` where `next_run_at <= now()` and `paused=false` (all users, ≤20/tick), runs each via `runAlert`, reschedules `next_run_at` to the next 9 AM in the owner's tz, `cadence_hours` days out (24=daily, 168=weekly — `lib/alertSchedule.ts`). Each non-first run inserts a `notifications` row (regardless of cadence, even 0 new) + `alert_matches` rows when new; email only when new. **Without that crontab line nothing recurs** — this was the 28-day silent-alerts bug (next_run_at frozen in the past).

**Supabase tables (must exist in prod):**
- `search_listings_cache(key text pk, listings jsonb, expires_at timestamptz)`
- `query_expansion_cache(query_norm text pk, payload jsonb, expires_at timestamptz)`
- `notifications(id, user_id, alert_id, new_count, seen, created_at)` — one row per alert run; drives the nav bell badge (count of `seen=false`). In the `supabase_realtime` publication. Never pruned — also powers the per-alert run-history view (`GET /api/saved-searches/[id]/history`).
- `alert_matches(id, user_id, alert_id, notification_id, url, title, price, currency, image, platform, seller, size, condition, color, seen, found_at)` — the new listings per run; powers "click alert → view matches", grouped by `notification_id` into per-day sections. Pruned to ~100/alert, so older days may show a run-history entry with no cards.
- `stripe_webhook_events(event_id text pk, type text, processed_at timestamptz)` — idempotency ledger; webhook claims each `event.id` before processing, skips duplicates, deletes the claim on failure so retries re-run. service_role-only. (migration `docs/migrations/stripe-webhook-idempotency.sql`)
- All need `GRANT SELECT/INSERT/UPDATE/DELETE TO authenticated, service_role` (see `docs/migrations/alert-notifications.sql`)

**Protected app shell (2026-07-02):** all `(protected)/*` pages share one chrome via `app/components/shell/AppShell.tsx` (mounted in `(protected)/layout.tsx`). It renders a persistent, retractable left sidebar (`AppSidebar.tsx`) on `lg+` and a hamburger drawer below `lg`. Nav = Search · Alerts (unread badge) · Saves · History, plus footer Upgrade / Home (`/`) / account menu (Profile/Settings/Pricing/Sign out). Collapse state persists to `localStorage` (`crawli_sidebar_collapsed`). The old top-right `AuthButton` is gone — its hooks + `markIntentionalSignOut` now live in `app/components/shell/nav-hooks.ts`; unread/plan are fetched once in `AppShell` and passed to `AppSidebar` as props (do NOT re-call `useTotalUnreadAlerts` in a second mounted component — see PITFALLS realtime channel note). Per-page `<nav>`/`<AuthButton>` were removed from all 7 protected pages/layouts; pages now render a plain content `<div>`, not their own `<main>`.

**Landing page:** comparison-first structure (2026-07-08). Order: Hero (live `CompareHeroWidget` — rotates real per-platform prices for 5 curated compare items, right column) → PlatformLogos → CompareSection (full item grid) → AlertsAndTrackedSection (combined tabbed pitch, replaces old AlertsMock+SavesMock) → MarginSection (demoted `FlipCalculator`, moved out of the hero) → BentoFeatures (trimmed to 3 supporting cards — 9-platform search, price intelligence, smart filters). `CompareHeroWidget` reads only the existing `compare_snapshots` cache via new `getCompareHeroData()` in `lib/compare.ts` — no new scrape, no new endpoint. Curated hero rotation slugs: `jordan-1-retro-high`, `bape-shark-hoodie`, `carhartt-wip-jacket`, `nike-dunk-low`, `supreme-box-logo-hoodie` (constant in `app/page.tsx`). Design spec: `docs/superpowers/specs/2026-07-08-landing-page-priority-redesign-design.md`.

---

## Open issues

**eBay Akamai blocks (intermittent)**
~1 in 5 eBay listing scrapes returns HTTP 403. Structured extractor logs `[structured] crawl failed`, LLM fallback runs on partial content. Not worth fixing now. Options if it worsens: residential proxy, eBay Browse API (OAuth required), paid unlocker.

**StockX SSR vs live price drift**
Possible that `trade-box-buy-amount` in SSR HTML differs from live hydrated DOM. User decision: leave as-is. Add "scraped at" timestamp if user complaints arrive.

---

## Recent changes

**2026-07-08 — Schema fixes: platform-count drift + Product/AggregateOffer on compare pages**
- Homepage `StructuredData.tsx`'s hand-maintained `PLATFORMS` array was missing ThredUp and said "eight marketplaces" while the same page's FAQPage schema said nine — fixed to nine everywhere. `/compare/[slug]` price schema switched from `ItemList`+`Offer` (list/carousel rich result) to `Product`+`AggregateOffer` (the type that actually earns Google's price-range snippet). See PITFALLS.md.
- Also confirmed via GSC URL Inspection: all 15 `/compare/[slug]` pages are still unindexed (12 "Discovered — not indexed", 3 "unknown to Google" — the 3 not linked from the homepage's first-12 grid). Root cause is low domain authority/backlinks (Common Crawl shows zero referring domains), not a crawlability bug — real internal links to all 12 are present and Googlebot-visible in raw HTML.

**2026-07-08 — Landing page reprioritized: comparison leads, margin calculator demoted**
- Hero no longer leads with the margin calculator. New `CompareHeroWidget.tsx` shows real, rotating per-platform prices (reads existing `compare_snapshots` cache, zero new backend cost) in the hero's right column instead. `AlertsMock.tsx` + `SavesMock.tsx` merged into one tabbed `AlertsAndTrackedSection.tsx`. `FlipCalculator` moved into its own new `MarginSection.tsx`, positioned after the alerts/tracked pitch. `BentoFeatures.tsx` trimmed from 6 cards to the 3 supporting ones (its former hero trio now has full sections elsewhere). See `docs/superpowers/specs/2026-07-08-landing-page-priority-redesign-design.md`.

**2026-07-08 — Fixed `longsleeve`/`shortsleeve` as unmatchable relevance-filter anchors**
A user's "black longsleeve messi jersey" alert silently returned 0 new matches every day (unlike a sibling alert) because "longsleeve" (one word) never appears in listing titles, which write "long sleeve" (two words) — same class as the earlier `tshirt` bug but fixed via a normalized-substring compound-word map in `lib/parse.ts` instead of stopwording, since sleeve length is a real narrowing signal. See `docs/core/PITFALLS.md` → Relevance filtering.

**2026-07-08 — Fixed duplicate Sentry client init + trimmed legacy JS polyfills (PageSpeed follow-up)**
- Sentry was initializing twice in the browser (`instrumentation-client.ts` auto-loaded by Next.js + a leftover `sentry.client.config.ts` wired via a now-deleted `app/sentry-provider.tsx`), bloating the JS bundle by ~200 KB and silently running prod at 100% trace sampling + PII collection instead of the intended 10%. Consolidated into `instrumentation-client.ts` only. Also added a `browserslist` field to `package.json` (modern evergreen targets) so Next's SWC compiler stops shipping `Array.at`/`flat`/`Object.hasOwn`/etc. polyfills for browsers that don't need them. See `docs/core/PITFALLS.md` Infrastructure section.

**2026-07-08 — Cross-links between /compare/[slug] and its price-guide blog post**
- New `getPriceGuideSlugMap()` in `lib/blog.ts` (compareSlug → blog post slug, from the same `PostMeta.compareSlug` field the Price Guides tab uses). `/compare/[slug]` now shows a "Read the full price analysis →" link under the hero when a price-guide post exists for that item. Landing page `CompareSection` cards got the same treatment on the other direction: each card's `<Link>` wrapper became a `<div>` with an absolutely-positioned stretched link to `/compare/[slug]` (`z-0`) plus a small separate "Read analysis →" link to the blog post (`z-10`, sits above the stretched link so it captures its own clicks — standard stretched-link-with-sublink pattern, not nested anchors). Only 12 of the 15 compare items show as cards on the landing page (`shown = items.slice(0, 12)`, pre-existing, unrelated to this change) — the other 3 still get the reverse link on their own `/compare/[slug]` page.

**2026-07-08 — Price Guides tab on /blog**
- `/blog` now has a two-tab segmented control ("All Posts" 89 / "Price Guides" 15), reusing `AlertsTabsClient`'s exact pill+badge pattern in a new `app/components/blog/BlogTabsClient.tsx`. Both lists are server-rendered up front (no client fetch); the client component only toggles `display:block/none`, so both sets of post links stay in the initial HTML regardless of which tab is active — no crawlability loss either way. "All Posts" is the default tab (unchanged behavior/links). Split is driven by `PostMeta.compareSlug` (exclusive to the 15 posts — the older `price-comparison` tag isn't a clean signal, 2 unrelated posts also carry it). Each of the 15 also gets a small "Live pricing" badge on its card in both tabs, so it's recognizable without switching tabs.

**2026-07-07 — Live-pricing embed on the 15 compare-anchored blog posts**
- `content/blog/*-resale-price.md`'s hand-written, build-time-frozen price tables are replaced with a live `LivePriceTable` component (`app/components/blog/LivePriceTable.tsx`) that reads real-time data via the same `getComparePageData()` `/compare/[slug]` uses. Each post's table is spliced in via an `<!-- LIVE_PRICE_TABLE -->` marker in the markdown, which `marked` passes through untouched; `app/blog/[slug]/page.tsx` splits `post.html` on it and renders the live component in between. New optional `compareSlug` frontmatter field (`lib/blog.ts`) maps each post to its compare item — 3 of the 15 diverge from their filename (`jordan-1-resale-price.md`→`jordan-1-retro-high`, `levis-501-resale-price.md`→`levis-501-jeans`, `north-face-nuptse-resale-price.md`→`north-face-nuptse-jacket`).
- **Found mid-implementation:** `/blog/[slug]` (and `/compare/[slug]`) both build as `ƒ` fully dynamic routes, not `●` static/ISR — `export const revalidate` is inert on both today because both call `supabase.auth.getUser()` (a dynamic API), not yet root-caused beyond that. Fine for freshness here since `getComparePageData()` now runs fresh on every request rather than on an hourly cache.
- FAQ text/JSON-LD on these posts stays a manual snapshot, intentionally not live, to avoid a visible-text/structured-data mismatch.

**2026-07-08 — Doc staleness sweep (HANDOFF, PLATFORM_STATUS, SYSTEM_DESIGN)**
- Triggered by the ISR discovery above. Verified every checkable claim in HANDOFF.md's open issues + current-state block, PLATFORM_STATUS.md, and SYSTEM_DESIGN.md against the actual code (not memory/assumption). Fixed: the `/compare/[slug]` "ISR, cached daily" claim here and in `app/sitemap.ts`'s own comment (both corrected to reflect the `ƒ` dynamic reality above); SYSTEM_DESIGN.md §6 `nativeResultsCap` said `10/40/80`, code (`lib/stripe.ts` `TIER_CAPS`) says `15/60/100`; SYSTEM_DESIGN.md's eBay cost line said "~$0.016 Standard" (that's actually the Hobby figure — Standard is ~$0.005, matching the doc's own later table). Removed 2 fully-resolved open issues: `_DRIVER_DEAD_PATTERNS` missing-string gap (string is already in `main.py`'s tuple — checked) and "Supabase cache tables may not exist in prod" (both `search_listings_cache`/`query_expansion_cache` confirmed present via Supabase MCP). Everything else checked (TIER_CAPS values, protected-app-shell files, landing page section order, platform counts/lists in SYSTEM_DESIGN.md) matched code exactly.
- **Not fixed, flagged instead:** "Recent changes" below has ~20 dated entries back to 2026-06-28, well past this file's own stated "last 3-5 sessions only" retention rule. Didn't prune it — these entries are still factually accurate, just numerous, and deciding what history is safe to drop is an editorial call, not a correctness fix.

**2026-07-07 — Threads auto-posting live via `scripts/post-to-threads.mjs`**
- On-demand script (no n8n — CLI `execute` can't take custom trigger input without a wrapper workflow, so a plain script direct to OpenAI + Zernio was simpler for something invoked by hand). Drafts a Threads-voice caption, posts via Zernio, logs to `content_history`. `--draft` flag to preview without posting. Zernio's Threads `content` field is required even when using `threadItems` for a reply chain (their docs say otherwise) — see `docs/core/PITFALLS.md`. Full writeup: `docs/planning/AGENT_PLAN.md` §1H.
- 6 posts live: 2 retitled evergreen posts + 4 compare-anchored `*-resale-price.md` posts. TikTok's Zernio connection was replaced by Threads (free-tier 2-account limit) — `tiktok auto post`/`tiktok performance digest` are stale until TikTok is reconnected on a paid slot.
- Also fixed 2 zero-click blog post titles (`best-secondhand-marketplaces-for-luxury-items`, `how-to-identify-vintage-band-tee`) flagged by `mcp__gsc__ctr_anomalies` — ruled out cannibalization first, then added a real number/hook to each title+description instead of just keeping them short.

**2026-07-06 — Blog conversion reframe complete (all 4 phases) + meta description length fix**
- 15 new compare-anchored price posts (one per live `/compare/[slug]`), 2 new Tier C posts, bulk title-shortened all 89 posts to ≤60 chars, and a full convert-audit pass (internal compare-links, CTA tightening, unsourced-stat cleanup, dead-post rescues) across all 72 pre-existing posts. Full breakdown, decisions, and what's left: `docs/blog-briefs-2026-07-reframe.md` (STATUS section at top).
- Bing Webmaster flagged one post's meta `description` as too long; audit found 66 of 89 posts over Bing/Google's ~160-char display limit (title rule was ≤60 chars but no equivalent existed for description). Fixed all 89 to 25-160 chars via 5 parallel subagents — see PITFALLS.md. Nothing committed yet.

**2026-07-02 — Alert query edits are free (cooldown-gated, not credit-charged)**
- Baseline-changing alert edits (query/platforms/filters/criteria) no longer charge a search credit. They still reset the baseline and re-run in-house (eBay excluded from alerts → crawl4ai only, marginal cost). Free tier is gated by a per-alert cooldown (`FREE_BASELINE_EDIT_COOLDOWN_HOURS = 4` in `lib/alertConstants.ts`); paid tiers uncapped. New column `saved_searches.last_baseline_edit_at` tracks the last edit — deliberately NOT `last_run_at` (cron runs bump that too). PATCH now returns `429 edit_cooldown` for free-tier over-edits. Client (`CreateAlertModal`) no longer fires `crawli:search-started` on edits and messages the cooldown for free users.

**2026-07-02 — Sidebar app shell + Alerts page revamp**
- New shared `app/components/shell/` (AppShell + AppSidebar + nav-hooks); retractable left sidebar on desktop, hamburger drawer on mobile. Removed the per-page top navs and the old `AuthButton` (deleted). Spec: `docs/superpowers/specs/2026-07-02-sidebar-and-alerts-redesign-design.md`.
- Alerts page: replaced the full-width 50/50 tab bar + centered description strip with compact segmented pill tabs that carry live count badges; consolidated `WatchlistTab`'s stacked count/last-refreshed rows into one status line.
- Profile stats: added an "Active alerts" tile (`activeAlerts` = non-paused `saved_searches`) to `/api/profile/stats` + `ProfileDashboard` (now a 4-up strip).
- Caught+fixed a realtime bug in the refactor (channel-name collision) — see PITFALLS.

**2026-07-02 — New TikTok carousel batch (8 posts) + fixed a Day-7 rendering bug**
- Built `docs/marketing/2026-07-02/` (8 posts, 50 slides — 2 grid posts consolidate to 4 slides each, `SLIDE_COUNTS = [7,7,7,4,7,7,4,7]`). 8 brand-new font pairings, split/number-left/visual-hero/grid/myth layouts, Neumorphism on one post, cover placement rotates top/side-rail/center/bottom. Full breakdown in `docs/marketing/POSTS_README.md` "Post Breakdown — Day 9".
- Dedup against Supabase `content_history` caught a duplicate the brief itself missed: "eBay's Authenticity Guarantee" nearly repeated the already-posted `authenticity-guarantee-limits` (2026-06-29) — dropped before building.
- Found and fixed a latent bug from the 2026-06-25 batch's code: the number-left/visual-hero slide renderer dispatched on `post.layout`, but that batch's post objects never set `layout` at the post level (only on individual slide objects), so `post.layout` was always `undefined` and every "number-left" post there silently rendered as `visual-hero` instead. Not worth re-exporting that old batch, but worth knowing if `content-posts-slides.html` is reused as a template again — always set `layout` on the post object itself, not just the first slide.
- Marked all 8 new `topic_key`s `posted = true` in Supabase `content_history`.

**2026-07-02 — 10 new blog posts published**
- Added `content/blog/*.md` + matching SVG covers for: vintage Rolex Datejust authentication, Hermes Birkin origin story, Harrington/Baracuta G9 history, corduroy fabric history, sukajan jacket history, The RealReal authentication process (grounded in the real 2019 CNBC investigation/shareholder suit, not a later unverified claim), a Poshmark 30-day sales-tracking case study, best platform to sell a vintage Cartier Tank, best platform to sell a Hermes scarf, and a vintage band tee single-stitch dating guide. Several factual claims from the original briefs were corrected against live web search before publishing (e.g. Sotheby's Birkin auction price, Baracuta G9 timeline, Chrono24/1stDibs/Vestiaire fee tiers, RealReal's actual authentication controversy) rather than published as originally drafted. Verified: all 10 frontmatter blocks parse via `gray-matter`, `tsc --noEmit` clean, all 10 `/blog/[slug]` routes 200 and render correctly (cover, FAQ accordion, tables) in a real browser.

**2026-07-01 — Fixed Pinterest auto-pin 403 (stale Zernio accountId)**
- `pinterest crawli` n8n workflow (`0SoGJUO8UrgPIJY7`) was 403ing with "One or more accounts do not belong to this user". Cause: the Pinterest Zernio connection got recreated on 2026-07-01, which issued a new Zernio account `_id` (`6a454bd69d9472faae43601f`) even though it's the same `thecrawli` Pinterest profile — the workflow's Code node still had the old id (`6a2506e02b2567671a0b8721`) hardcoded. Updated the Code node, reimported + reactivated the workflow, verified with a live test webhook (execution 168, status success). See gotcha in `docs/planning/AGENT_PLAN.md` §1A for how to decrypt the Zernio credential and re-check account IDs if this recurs on other platforms (TikTok, Reddit).

**2026-07-01 — IndexNow + accurate sitemap lastmod (Bing indexing fixes)**
- IndexNow now pings Bing/Yandex/Naver on content change. New: `lib/indexnow.ts` (best-effort `submitToIndexNow`, never throws), `app/api/indexnow/submit/route.ts` (Bearer `CRON_SECRET`; no body = resubmit full sitemap), ownership key file `public/421d3af41bc04a0439069010586fcb56.txt` + `INDEXNOW_KEY` env. Wired into `/api/compare/refresh` (submits refreshed slug URLs) and the deploy step (curl in `docs/reference/SERVER_REFERENCE.md`). No effect on Google (Google doesn't use IndexNow).
- Sitemap `<lastmod>` was always "now" for every URL — now accurate: posts use `updated||date`, compare pages use real `scraped_at` (new `getCompareLastUpdated()` in `lib/compare.ts`), static pages use last git commit (`lib/gitLastModified.ts`). Verified 30 distinct lastmod values in `/sitemap.xml`. Added `export const revalidate = 3600` to `app/sitemap.ts` — without it Next.js prerenders the sitemap as fully static and freezes lastmod (incl. compare `scraped_at`) until the next deploy. Unlike `/compare/[slug]` and `/blog/[slug]` (both forced fully dynamic by `supabase.auth.getUser()`, see 2026-07-07 entry), the sitemap route has no dynamic API calls, so this `revalidate` is real ISR — 1h just comfortably beats the daily 6am compare-refresh cron.
- www→non-www 301 now live on nginx (`5.78.187.97`) — `https://www.thecrawli.com/*` 301s to the bare domain (was serving 200 duplicate content). Dedicated www server block + main block scoped to `thecrawli.com`; port-80 www redirect collapsed to a single hop. Backup at `/root/crawli.nginx.bak-*`. See `docs/reference/SERVER_REFERENCE.md` "nginx: www → non-www redirect".
- Baseline security headers added (`next.config.ts` `headers()`): HSTS (no preload), `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`. Site had none before. No CSP yet — needs per-directive scoping against Stripe checkout/Sentry tunnel/GA4 before adding, don't add a blanket policy.
- Corrected a stale SERVER_REFERENCE.md claim: Cloudflare is an **active proxy** (confirmed via `cf-ray`/`server: cloudflare` response headers), not just DNS — it terminates client TLS at the edge in addition to nginx's own Certbot cert for the Cloudflare→origin hop (Full/strict mode).

**2026-06-30 — Landing page reseller revamp (killed the fake searches)**
- Replaced both fake search elements with two real, no-login, interactive proofs: a live flip-margin calculator in the hero (`FlipCalculator.tsx`, real `netFlipProfit` math) and the promoted real compare slugs (`CompareSection` now data-driven w/ "from $X" teasers via new `getCompareTeasers()`). Deleted `SearchMock.tsx` + `mockSearches.ts`. Hero is now a two-column layout (copy left, calculator right). BentoFeatures elevates **tracked listings** into a co-equal hero card alongside margin + alerts; SavesMock reframed to price-drop tracking and moved up. Below-fold sections fade in via `Reveal.tsx` (reduced-motion aware). Compare `/[slug]` page: removed the eBay "not cached" card, breadcrumb now bridges to `/#compare`. Verified: `tsc` clean; no horizontal overflow at 375/768/1280; light + dark correct. Design spec: `docs/superpowers/specs/2026-06-30-landing-reseller-revamp-design.md`.

**2026-06-30 — Phase 2 compare pages + GEO fixes**
- 15 public `/compare/[slug]` pages, no auth required — `app/compare/[slug]/page.tsx`. Has `export const revalidate = 3600` but builds as `ƒ` fully dynamic (see 2026-07-07 entry below) — data is fetched fresh per request, not from an hourly ISR cache. Scrape cron `0 6 * * *` wired on server (`/var/log/crawli-compare.log`). Nginx `proxy_read_timeout 300s` added for `/api/compare/refresh`. First snapshot run triggered 2026-06-30. DB tables: `compare_items` (slug registry) + `compare_snapshots` (cached stats + listings). Both applied to prod.
- GEO: `public/.well-known/ai.txt`, `public/ai/summary.json`, `/ai/faq.json`, `/ai/service.json`. RSS feed at `/feed.xml` + `<link rel="alternate">` in layout `<head>`.
- Footer: brand-gradient top border, bigger padding + icons (22px), platform brand-color hover glow, Blog link removed.
- Stripe idempotency migration applied to prod (previous session).

**2026-06-30 — Growth gameplan doc + SEO/AEO entity signals**
Wrote `docs/planning/GROWTH_PLAN.md` — the full distribution/conversion roadmap (data diagnosis, phased plan, owner checklist) so any session can continue the marketing push. Shipped Phase 1 SEO code: `public/llms.txt`, Organization `sameAs`/`alternateName`/`foundingDate` in `StructuredData.tsx`, and social links in landing `Footer.tsx`. Next planned: Phase 2 public `/compare/[slug]` page (not built). On-page SEO was already strong; brand-rank gap is off-page (age/backlinks/entity).

**2026-06-30 — Stripe webhook idempotency + local billing test**
Added `stripe_webhook_events` ledger so a re-delivered `checkout.session.completed` can't double-grant credits (claim-with-rollback in `app/api/webhooks/stripe/route.ts`). Confirmed the credit-grant path is correct end-to-end via new `scripts/test-credit-webhook.mjs` (0→100 on grant, duplicate skipped, no double-grant). Root cause of "credits never granted in dev" was just that Stripe can't reach localhost without `stripe listen` — code was fine. See `docs/core/PITFALLS.md` → Payments.

**2026-06-30 — Weekly cadence option for search alerts**
Alerts could only check daily (`cadence_hours` hardcoded to `24` end-to-end). Added `168` (weekly) as a second valid value — floating 7-day interval, still anchored to 9 AM in the owner's timezone, no day-of-week picker. Fixed `nextAnchoredRunAt` in `lib/alertSchedule.ts`, which previously ignored `cadenceHours` entirely (always found "next 9 AM," which only worked for daily by coincidence) — see `docs/core/PITFALLS.md`. `CreateAlertModal` now has a real Daily/Weekly toggle and the edit flow actually persists cadence changes (it silently dropped `cadence_hours` from the PATCH body before). No schema migration, no cron change.

**2026-06-30 — Landing page reorder: proof before CTA, redundancy cut**
- Removed `HowItWorks` (fully redundant with `BentoFeatures` hero cards); anchor `#how-it-works` now lives on `BentoFeatures`
- New section order: Hero → SearchMock → PlatformLogos → BentoFeatures → AlertsMock → AboutSection → SavesMock → FounderNote → CTASection → FAQ → Footer
- `FounderNote` (trust) now precedes `CTASection` (was reversed); `SavesMock` de-emphasized vs `AlertsMock`; gradient-text signature reserved for Hero headline only

**2026-06-30 — Alert matches grouped by run date in UI**
`AlertMatchesModal` now fetches `GET /api/saved-searches/[id]/history` (one row per `notifications` entry, up to 365) alongside the existing `/matches` query and groups matches by `notification_id` under a date header (e.g. "Jun 30, 2026 · 11 new"). Days whose `new_count > 0` but whose matches have since been pruned (beyond the 100/alert cap) show "No longer available" instead of silently disappearing. The 100-match cap itself is unchanged — this only adds visibility into run history, which was already being recorded but never surfaced.

**2026-06-30 — Poshmark/StockX grid images fixed (lazy-load scroll)**
Cards below the fold on both grids were missing/wrong images (Poshmark: "No image"; StockX: gray-X placeholder graphic) because both lazy-swap images via IntersectionObserver and the scraper captured HTML before scrolling. Added a scroll script (`js_code`, runs after `wait_for`) in `main.py` for both platforms; extractors also fall back to `data-src` (Poshmark) and null out the StockX placeholder URL if it's still unswapped. See `docs/core/PITFALLS.md` → "Poshmark/StockX grid cards lazy-load images".

**2026-06-30 — Mobile overflow fixes (settings, profile, alerts)**
- Three real horizontal-overflow culprits on protected pages at ≤375px (all public pages were already clean): settings `Row` didn't stack so the long email + fixed `w-48` quota bars pushed off-screen; profile `RecentSearches` platform list collided with the timestamp; alerts `SavedSearchCard` squeezed the title/platforms into a sliver beside 3 fixed action buttons.
- Fixes: settings `Row` now `flex-col … sm:flex-row` (value wraps under label on mobile) + email `break-all`; `RecentSearches` platform list `hidden sm:inline` + `truncate max-w-[45%]`; `SavedSearchCard` actions drop to their own row on mobile (`flex-col … sm:flex-row`, actions `flex-wrap`). Desktop layout unchanged. Verified at 360/375px and 1280px via a throwaway harness rendering the real components with worst-case data (long email, all 9 platforms). See `docs/core/PITFALLS.md` → "Mobile horizontal overflow".
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
- docs/reference/FIRECRAWL_PRICING.md Brave/hybrid section remains historical.

**2026-06-29 — Deploy fix: `unzip` required on server + npm install/build order corrected**
- Fixed deploy order in `docs/reference/SERVER_REFERENCE.md`: `npm install` must run before `npm run build` (was reversed)
- Server was missing `unzip`, breaking Puppeteer's Chrome download during `npm install`; installed via apt
- See `docs/core/PITFALLS.md` Infrastructure section for the stale-cache symptom and fix

**2026-06-29 — Session 4: Avenue A migration + alias matching**
- All 8 native platforms now on Avenue A (vestiaire, vinted, poshmark, stockx extractors added to `search_page_extractors.py`)
- `lib/queryExpansion.ts` + alias-aware `parse.ts` anchoring (bape→A Bathing Ape etc.)
- `primeExpansion(query)` wired in `searchWorker.ts`; `withListingsCache` wired in `alertRunner.ts`
- `'tshirt'` added to RELEVANCE_STOPWORDS (was an anchor that never matched "t-shirt" in titles)
- Landing pages updated to 9 platforms; vestiaire re-added everywhere

**2026-06-29 — B2B Session 3: landing page reseller revamp**
- HowItWorks, BentoFeatures, Hero, faqData, PricingCards rewritten for reseller audience
- Positioning: sourcing intelligence (comp pricing, flip margin, alerts) — NOT cross-listing
- Source of truth for feature claims: `docs/reference/B2B_FEATURE_TRUTH.md`

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
