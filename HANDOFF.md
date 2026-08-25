# Crawli — Handoff

**Last updated:** 2026-08-21

## How to use this file
 
**HANDOFF.md is the current-state hub** — what is true right now, what is broken, what is open. It is NOT a changelog.

- Architecture and search internals → [`docs/core/SYSTEM_DESIGN.md`](docs/core/SYSTEM_DESIGN.md)
- Per-platform scraping status → [`docs/core/PLATFORM_STATUS.md`](docs/core/PLATFORM_STATUS.md)
- Gotchas and lessons learned → [`docs/core/PITFALLS.md`](docs/core/PITFALLS.md)
- Server SSH, n8n, deployment → [`docs/reference/SERVER_REFERENCE.md`](docs/reference/SERVER_REFERENCE.md)
- B2B feature scope and truth → [`docs/reference/B2B_FEATURE_TRUTH.md`](docs/reference/B2B_FEATURE_TRUTH.md)
- **Growth/marketing gameplan (distribution + conversion roadmap)** → [`docs/planning/GROWTH_PLAN.md`](docs/planning/GROWTH_PLAN.md)
- **Audience research + hook program (live, multi-session, has its own status board)** → [`docs/planning/AUDIENCE_AND_HOOKS_PLAN.md`](docs/planning/AUDIENCE_AND_HOOKS_PLAN.md)
- Cost model → [`docs/reference/FIRECRAWL_PRICING.md`](docs/reference/FIRECRAWL_PRICING.md) + `node scripts/cogs-per-search.mjs`
- Marketing/carousel operation → [`docs/marketing/POSTS_README.md`](docs/marketing/POSTS_README.md)
- History older than the newest 5 sessions → [`docs/CHANGELOG.md`](docs/CHANGELOG.md)

**Maintenance rule for every session:**
1. Update the "Current state" section below if you change anything structural
2. Update the relevant doc file (PLATFORM_STATUS, PITFALLS, etc.) — not this file — for the details
3. Add one bullet under "Recent changes", then move any entry beyond the newest 5 into [`docs/CHANGELOG.md`](docs/CHANGELOG.md) (move, don't delete — this file is read every session, so it stays short)
4. If you fix an open issue below, remove it from the list

---
 
## Current state (2026-08-20)

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

**Tier caps (`lib/tierCaps.ts` — single source of truth; repackaged 2026-08-17 into two plans):**

| | Free | Pro ($10/mo · $3/wk · $100/yr) |
|---|---|---|
| Searches/week | 5 | 50 — **sold as "Unlimited"** |
| Results per native platform | **8** | 100 — **sold as "Unlimited"** |
| Alerts | **1** | 8 |
| Alert cadence | daily or weekly | daily or weekly |
| Saves | **10** | 500 |
| Tracked listings | **10** | 500 |
| Price summary · sold comps · flip margin | **🔒 locked** | ✅ |

- **Pro's two search caps are marketed as "Unlimited" (2026-08-18) while staying finite in `TIER_CAPS`** — 50/week and 100 per native platform are anti-abuse backstops, not product limits, the same deliberate copy/cap divergence already in force for saves and tracked listings. Grounding: busiest user-week ever recorded is 13 searches, p90 is 5.9, **0 of 52 user-weeks have ever exceeded even the old cap of 40**, and break-even on one $10/mo sub is ~495 searches/mo (worst case: all 9 platforms every search on Firecrawl Hobby). At the new cap the worst case is $4.12/mo COGS against $9.41 net, so **56% margin even if someone maxes it**. Two obligations that come with the word: a paid user must never see a "you used all N searches" wall (`/api/search` carries tier-specific 402 copy and logs a `[quota] PAID user hit the abuse backstop` warning), and if anyone ever actually lands on either cap, raise it or drop the word.
- **`nativeResultsCap` is free at any value up to 100.** `lib/searchWorker.ts` calls the sidecar with a hardcoded `limit=100` on every tier and the cap is a post-fetch `.slice()`, so a free user's 8-result search costs exactly what a Pro user's 100-result search costs. It also never touches eBay (non-native: hardcoded `slice(0, 10)` listings, and Firecrawl discovery is a hardcoded `searchLimit = 20`). Going past 100 means raising the sidecar limit, which does cost render time. See PITFALLS.
- **`max` is retired from the pricing page** but stays in `TIER_CAPS` and `tierFromPriceId` so a legacy price ID can never downgrade anyone. **No account resolves to it** — verified by `scripts/verify-paywall.mts`.
- **Caps moved out of `lib/stripe.ts` into `lib/tierCaps.ts`** (which imports nothing) so client components and the search worker can read them without bundling the Stripe SDK. `lib/stripe.ts` re-exports everything, so existing import sites are unchanged. See PITFALLS.
- Caps are stored on `profiles` columns (`max_searches_per_period`, `max_saved_searches`, `max_tracked_listings`, `native_results_cap`, `max_saves`, `min_alert_cadence_hours`) AND derived in `TIER_CAPS`. **Enforcement reads DB-first, so a TIER_CAPS change needs a `profiles` backfill** — done 2026-08-17 for all 46 users, and the column *defaults* were retuned too (new signups inherit them). `nativeResultsCap` is the exception — always read live from TIER_CAPS.
- **`profiles` grants are column-level** — a new cap column needs its own `GRANT` in the same migration or it 42501s. See PITFALLS.
- **Alerts are gated by count, not frequency** (owner decision 2026-08-17, reversing a weekly-only free floor). Alert runs are cheap — `lib/searchCache` fans one scrape out to every user watching the same query — and the alert email is the strongest driver of a second session, the metric this product is worst at. `min_alert_cadence_hours` is 24 on both tiers; the floor logic and its UI are retained and driven off `caps.minAlertCadenceHours` from `/api/billing/status`, so raising it later needs no code change.
- Overage: prepaid credit packs (`lib/creditPacks.ts`): 100/$10, 300/$25, 1000/$60. Drawn from `profiles.search_credits` after the period cap. **Verified live and working 2026-08-17** — prod has all three `STRIPE_PRICE_PACK_*` set to live-mode one-time prices whose amounts match the displayed $10/$25/$60 exactly. (Earlier docs called this "dormant / 503s without env vars" — that was stale. Local `.env` is test-mode with *different* pack IDs, which is why it reads as unconfigured from a dev box.)

**Price intelligence is paid (2026-08-17, locked-UI redesigned same day).** The governing line is *free shows you listings, Pro tells you what they mean*. `POST /api/sold-comps` resolves tier and returns a **stripped payload** for free users — platform names, sample size `n` and `windowDays` only, with `medianPrice`/`p25`/`p75`/`daysToSell` omitted server-side (`toLockedResult` in `lib/soldComps/types.ts`). Deliberately **not** a 402: the locked UI needs the sample counts to be persuasive. Both the cache-hit and fresh-compute paths exit through one `respond()` helper so there is a single place prices could leak. Verified live: the raw fetch response for a free account contains no price field anywhere.

**Locked UI is a blurred backdrop + upgrade overlay, not per-field redaction.** `LockedOverlay.tsx` blurs `children` (`filter: blur(8px)`, `inert`, `aria-hidden`, `pointer-events: none`) and layers a lock icon + message + "Upgrade to Pro" button on top. The critical rule: **`children` must never contain a real number** — a CSS blur is presentation, not protection, and is one devtools click from gone. `lib/fakePricing.ts` generates deterministic-but-fabricated numbers from non-sensitive seeds (query, platform, label) so the backdrop looks like a real panel through the *same* components the unlocked view uses (`Metric`, `SoldCompsPanel`) fed fake data — real sample size (`n`/`windowDays`) passes through since that was never secret. `SoldCompsLockedPanel.tsx` composes this for the sold-comps-only surfaces (`/price-check`, onboarding tail, via `SoldCompsLookup.tsx`); `PriceSummary.tsx` composes it directly for the results-page panel (Metric grid + sold comps + a static flip-margin bar). Tier read via `lib/hooks/useTier.ts` (fails closed while loading). `UpgradeInline.tsx` was deleted — superseded by the overlay.

**Two different guarantees, both land on "free never sees a real number," for different reasons — see spec §5 for the full writeup:**
- **Sold comps: a true server gate.** `/api/sold-comps` strips every price field before the response leaves the server. The number never reaches a free user's browser at all — there's nothing for devtools to recover regardless of what happens to the blur.
- **Price summary (low/median/high): the locked render path never constructs the real number.** These figures are legitimately computable client-side (from listings already shown to free users), so hiding them isn't structurally possible without breaking "free shows listings" — but instead of computing the true value and then choosing not to render it, the locked branch calls `fakePriceString(...)` and never touches `priceRange`/`averagePrice` when building what gets blurred. One open, accepted, disclosed gap: `PriceSummary` itself still receives the real `priceRange`/`averagePrice` as props (it needs them to decide whether to render at all) — inspectable via React DevTools on that specific component, not on the blurred children. Not a new leak: it's the same number a user could already hand-average from the visible listing prices below the panel.
- **Pro users never touch any of this** — `unlocked=true` skips the fake-data path entirely and renders the real values straight through.

**Margin calculator (lib/marketplaceFees.ts):** covers 7 sell-on platforms (eBay, Poshmark, Mercari, Grailed, Depop, Vinted, StockX). ThredUp is source-from only — not in the fee calc. All rates verified 2026-06-28.

**Brand alias matching (lib/queryExpansion.ts):** live. Static map covers bape/a bathing ape, cdg, fog/fear of god, tnf, assc, stussy, polo ralph lauren, new balance. LLM enrichment (gpt-4o-mini via sidecar `/expand-query`) cached 7d. `primeExpansion(query)` awaited in `searchWorker.ts` before dispatch.

**Alert cache (lib/searchCache.ts):** `withListingsCache` wraps `runSearchJob` in `alertRunner.ts`. 50 users watching same query = 1 scrape fanned out.

**Alerts pipeline (recurrence is server cron, NOT Vercel):** the app is self-hosted on Hetzner via systemd — there is no Vercel Cron. `/api/cron/run-alerts` (Bearer `CRON_SECRET`) is driven by a crontab line on `5.78.187.97` (`*/15 * * * *`, logs `/var/log/crawli-alerts.log`). It selects `saved_searches` where `next_run_at <= now()` and `paused=false` (all users, ≤20/tick), runs each via `runAlert`, reschedules `next_run_at` to the next 9 AM in the owner's tz, `cadence_hours` days out (24=daily, 168=weekly — `lib/alertSchedule.ts`). Each non-first run inserts a `notifications` row (regardless of cadence, even 0 new) + `alert_matches` rows when new; email only when new. **First run (creation, or a baseline-resetting edit) writes no `notifications`/`alert_matches` rows but does send one baseline email** — "N listings match right now across M marketplaces", explicitly labelled as the starting point, with a separate zero-match variant (`buildBaselineEmailHtml` in `lib/email/alertEmailTemplate.ts`, sent from `runAlert`'s `isFirstRun` branch). **Without that crontab line nothing recurs** — this was the 28-day silent-alerts bug (next_run_at frozen in the past).

**Sold comps (shipped 2026-08-10):** `lib/soldComps/` returns median completed-sale price, p25-p75, sample size, window and days-to-sell for **Grailed + Poshmark only**. Pure TypeScript, plain HTTP, **no sidecar involvement** — Grailed via its `Listing_sold_production` Algolia index, Poshmark via `availability=sold_out&sort_by=recently_sold` parsed out of `window.__INITIAL_STATE__`. `FlipMargin` seeds its resale price from median sold rather than average ask. **Aggregates and individual sale rows are gated separately (2026-08-18):** `MIN_SAMPLE` (now **5**, was 10) governs only the median/spread/days-to-sell, while `SoldCompsResult.sales` returns the individual completed sales — dated, priced, linked, newest first, capped at `SALES_ROW_CAP = 50` per platform — with **no floor at all**, so a query with 2 sales shows rows and no median instead of showing nothing. `POST /api/sold-comps` is auth-gated, cached 24h in `sold_comps_cache`, and **charges no search credit**. Reported per platform — there is deliberately no pooled cross-platform median (the two carry different inventory for the same query; see PITFALLS). Mercari and ThredUp were dropped on probe evidence. Verify with `npx tsx scripts/verify-sold-comps.mts` (33 checks). Details: `docs/planning/COMPETITIVE_POSITIONING.md` §5 Step 1 + EXP-004.

**Sold comps has two surfaces (2026-08-11):** embedded via `SoldCompsPanel.tsx` inside `PriceSummary` on a search result, and standalone at `/price-check` in primary nav — the query-input-plus-panel-plus-margin-calc UI is shared via `app/components/SoldCompsLookup.tsx`, used by both `TailStep` (onboarding) and the `/price-check` page, so checking a price never requires running a search. The buy-price input links to Settings' "Platform fees" table (`/settings#platform-fees`, opens in a new tab) to explain how the margin numbers are derived.

**Flip margin calculator was de-duplicated into one shared component (2026-08-18).** `app/components/FlipMarginCalculator.tsx` is now the only comprehensive flip calculator in the app — platform dropdown across all 7 `FEE_PLATFORMS`, editable sourcing/resale price with configurable quick-set chips (`sold`/`avg ask`/`high`), Net profit/Margin/ROI stat tiles, and a fee-math breakdown line. `PriceSummary.tsx` (search-results panel) and `SoldCompsLookup.tsx` (`/price-check` + onboarding's `TailStep`) both render it now; previously `SoldCompsLookup`'s version was a stripped-down duplicate that only surfaced one sentence and silently defaulted to whichever sold-comps platform loaded first (Grailed), with no way to change platform from the Flip Margin pane itself. **Any future flip-margin UI work should extend this shared component, not fork a new copy.** `SoldCompsLookup`'s `tabbed` variant (`/price-check`) is now a responsive dashboard: at `lg+` it lays out as a 2-column grid — the sale-rows list on the left, a per-platform market-snapshot panel (median/range/sample-size/days-to-sell — also the platform picker feeding the calculator) stacked above the flip calculator on the right; below `lg` it keeps the original two-tab mobile UI, same content grouping as before. `variant="inline"` (onboarding) is unchanged structurally but now also renders the richer calculator. `/price-check`'s container widened from `max-w-2xl` to `max-w-5xl` to fit the desktop layout. The right rail is `lg:sticky lg:top-6` so it doesn't scroll away behind a long sales list, and `SoldSalesList` has an optional `initialVisible` prop — `/price-check` shows 10 rows with a "Show all N" toggle rather than all 50 at once (unused elsewhere). See "Recent changes" below for two post-deploy bugs this surfaced and how they were fixed.

**Onboarding flow (shipped 2026-08-10, polished 2026-08-11, name step added 2026-08-20):** every account with `profiles.onboarding_completed_at IS NULL` is blocked into `/onboarding` by the gate in `(protected)/layout.tsx`, applying to the 39 pre-existing users as well as new signups. State lives on `profiles.onboarding_*` columns — `onboarding_persona` (`buyer`/`reseller`), `onboarding_started_at`, `onboarding_completed_at` (the gate), `onboarding_step` — plus `first_name`/`last_name`, required and collected on the `name` step, and `display_name` (composed from them on completion, only if not already set). `PATCH /api/onboarding` drives it; `app/onboarding/OnboardingFlow.tsx` and its 6 `steps/` screens (Branch, Name, Seed, Criteria, Alert, Tail) branch by persona, with back navigation through all 6 (`prevStep()` in `lib/onboarding.ts`) locked only once the alert exists — editing an earlier answer can't retroactively change what was already posted to `/api/saved-searches`. Settings has an "Onboarding" row (`/onboarding?replay=1`, button labelled "Redo onboarding"). **The flow charges nothing** — it calls only `/api/sold-comps` and `/api/saved-searches`, never `/api/search`, so `searches_used_this_period`/`search_credits` are untouched. Verify with `npx tsx scripts/verify-onboarding.mts`. Details: `docs/planning/COMPETITIVE_POSITIONING.md` §5 Step 2(a) + EXP-001.

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

**Compare pages + blog (verified 2026-07-26):** 33 rows in `compare_items` → 33 `/compare/[slug]` pages (`app/compare/[slug]/page.tsx`, carries `FAQPage` schema). Since 2026-08-17 their `<title>`/description are generated from the live snapshot (stocked-platform count + a trimmed typical asking-price band via `typicalPriceBand()`), not static strings — the raw `min_price_usd`/`max_price_usd` columns must never reach a snippet, see `docs/core/PITFALLS.md`. Category mix: luxury-handbags 12, sneakers 5, hoodies 4, luxury-watches 3, outerwear 3, tops 2, luxury-accessories 2, denim 1, luxury-jewelry 1 — i.e. 18 luxury / 15 streetwear. `content/blog/` holds 116 posts, of which 33 carry `compareSlug` (one per compare item). The blog's Price Guides tab count is *derived* — `priceGuidesCount={priceGuidePosts.length}` in `app/blog/page.tsx` — so it tracks `compare_items` automatically and needs no manual bump. Refresh path is `/api/compare/refresh` (applies `filterAuthentic()`, see Open issues); results cache in `compare_snapshots`, read back by `getCompareHeroData()` in `lib/compare.ts` for the landing hero.

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

**2026-08-22 — Share card: a shareable "N listings across M marketplaces" image from any search**
New stateless `GET /api/share-card` renders a 1080x1350 PNG via `next/og`'s `ImageResponse` (same pattern as `app/opengraph-image.tsx`) from query params only — no DB row, nothing persisted, nothing to prune. `lib/shareCard.ts` holds the pure logic: `pickShareCardListing()` picks the cheapest listing by effective USD price (reusing `convertToUSD`, skipping unconvertible currencies) and `buildShareCardUrl()` serializes it. On the results page `ShareFindButton.tsx` sits under `PriceSummary`, fetches the card as a blob, previews it in `ShareCardPreviewModal.tsx`, then hands it to `navigator.share()` where the browser can share files, falling back to a plain download everywhere else. **Deliberately not a referral program** — no incentive, no credit reward, no tracking; the artifact is the whole feature, on the reasoning that share mechanics amplify an existing retained base and this product does not have one yet (F9). Scoped to search results only; the alert-match variant is deferred until alert engagement justifies it (F13). Two layout details that mattered: the query renders on its own line above the headline (inlining it produced the ungrammatical "Found 47 stussy tee") and counts pluralize; a dead or hotlink-protected listing photo falls back to a placeholder block rather than failing the card. Verified `npx tsx scripts/verify-share-card.mts` 19/19, `npx tsc --noEmit` clean, `npm run build` clean, eslint clean on all four new files (`ResultsDisplay.tsx` holds at its pre-existing 2-error `preserve-manual-memoization` baseline), and the route exercised directly for happy path / 400 / dead-image / singular / plural / GBP / truncation. **Also verified end-to-end in a real authenticated browser session** on a live "stussy tee" search (79 listings / 3 marketplaces): the card's featured listing matched the grid's own "Lowest price" badge ($15 Mercari), light and dark both correct, Escape closes the modal and releases the body scroll lock, and no console output at all during the search or share flow. One incidental confirmation from a zero-result run: with the sidecar down, every platform returned 0 and the button correctly did not render, which is `pickShareCardListing` returning null. **Deployed to prod 2026-08-25** (`fbb3dd3`; route verified live returning `image/png`, 400 on a missing param, home and /pricing still 200). **Still unverified: the native share sheet on a real phone and the desktop download fallback** — Playwright's Chromium reports `canShare({files})` true so it takes the share path, but that says nothing about real iOS/Android, and Web Share needs a secure context (HTTPS or localhost), so a phone hitting a dev box over plain HTTP will always fall through to the download branch. Design and plan lived at `docs/superpowers/{specs,plans}/2026-08-22-share-card-*.md`, removed after merge per the CLAUDE.md workflow; recover from commit b2a36b6 if needed.

**2026-08-22 — Deep-dive brand-anchor audit: 24 more mall/luxury/hypebeast/watch brands fixed, 3 flagged as needing a different mechanism**
Follow-up to the same-day Acne Studios fix, requested explicitly as a broad sweep: checked ~80 well-known brands (Louis Vuitton, Prada, Gucci, Chanel down through Hollister, PacSun, Uniqlo, Arc'teryx, Rolex, Calvin Klein) against `commonWords.json`. Most were already fine (one word in the name is naturally uncommon and anchors the brand alone — `vuitton`, `heuer`, `hilfiger`, `wang`, `mcqueen`, `laurent`). Added 24 words to `BRAND_ANCHOR_OVERRIDES` for the ones that weren't: `casio`, `tiffany`, `shock` alone, plus full both-halves pairs for phrases where every word is ordinary English — `chrome`+`hearts`, `fear`+`anti`+`social`+`club`, `stone`+`island`, `under`+`armour`/`armor`, `lee`, `calvin`+`klein`, `american`+`eagle`, `banana`+`republic`, `free`+`people`. Verified with 31 before/after adversarial cases (each "should NOT match" title built to contain *exactly one* of the query's common words, e.g. "Roman Armour costume shirt" against "under armour shirt") — 30/30 fixable cases now correctly exclude the off-brand title; re-ran the earlier acne/omega/ralph-lauren/north-face regression set and the full `compare_items` brand audit, zero regressions, `npx tsc --noEmit` clean. **Found and proved a mechanism-level limit along the way:** a query that reduces to exactly one surviving common-word token (e.g. `"columbia jacket"` → just `{columbia}`) cannot be fixed by any override — `anchors.every(...)` over a single anchor and the no-anchor OR-fallback are mathematically the same check. Left `'columbia'` **out** of the override set rather than add it and imply the collision (Columbia Sportswear vs. Columbia University) is handled. **Three brands flagged as needing a different fix, not a missing override:** Old Navy (`'navy'` is a deliberate color stopword, `'old'` alone is too generic), Off-White (already a documented, deliberate exclusion — conflicts with `colorFilter.ts` treating "off-white" as a color), and J.Crew/H&M (their distinguishing token is a single letter, dropped by `relevanceTokens`' length filter before it ever reaches the anchor stage — needs new tokenization logic, not an override). Full writeup and the audit method for adding a future brand: PITFALLS "Relevance filtering".

**2026-08-22 — Brand queries with no anchor word silently stopped filtering by brand: fixed for Acne Studios + 3 more live cases found by audit**
Root cause: `titleMatchesQuery` (`lib/parse.ts`) requires a query's "anchor" tokens (non-common words, or entries in `BRAND_ANCHOR_OVERRIDES`) to all appear in a listing title; with zero anchors it falls back to "match at least one token." "acne studios long sleeve" had all 4 tokens in the common-English corpus, so anchors was empty and the query matched any brand's long-sleeve item. Fixed by adding `'acne'` to `BRAND_ANCHOR_OVERRIDES`. **Audited all 33 real `compare_items` brands for the same empty-anchor failure** (script computed anchors for each brand's bare, no-model query and flagged empty results) and found it live for 3 more: `"omega watch"`, `"ralph lauren shirt"` (without "polo" in the query), `"north face jacket"` (without "nuptse"). Fixed by adding `'omega'`, and — since Ralph Lauren and North Face are phrases where *both* words are ordinary English on their own — `'ralph'` + `'lauren'` and `'north'` + `'face'` together (anchoring just one word of either still let a same-category listing from a different real brand sharing that word through, e.g. "LC Lauren Conrad" on a lone `'lauren'` anchor). Verified all 4 cases against both a real-brand title (must match) and a same-category different-brand title (must not match), before and after; re-ran the full 33-brand audit post-fix with zero remaining gaps. `npx tsc --noEmit` clean. See PITFALLS "Relevance filtering" for the general rule (one word suffices for a single-distinctive-word brand; all words required for an all-common-words phrase) and how to re-run the audit for a newly added brand.

**2026-08-21 — Landing page sections no longer ship invisible in server-rendered HTML**
Found during a growth-research pass (screenshot + live DOM inspection, not a report): `app/components/landing/Reveal.tsx`, which wraps every below-the-fold homepage section (compare grid, price-check demo, alerts, flip calculator, feature grid, testimonial, CTA), set `opacity: shown ? 1 : 0` with `shown` starting `false` — an inline style computed from client state that also renders during SSR, so the **server-rendered HTML itself**, not just a pre-hydration flash, had ~7 major sections at `opacity:0` until an `IntersectionObserver` fired on real scroll. A full-page screenshot, a bot, a slow/no-JS client, or an AI-citability crawl simulation all saw a page that was mostly hero and blank space; a geo-optimizer audit run the same session independently flagged this as a "hidden text / cloaking pattern" negative signal. Fixed: content is always `opacity:1`; only `transform: translateY()` animates on reveal, so the settle-in motion survives with nothing ever invisible. Verified via Playwright (`getComputedStyle().opacity === '0'` count on load: 7 → 0) and `npx tsc --noEmit` clean. See PITFALLS for the "never gate opacity" rule for future reveal effects. Also corrected a stale fact found in the same pass: `GROWTH_PLAN.md` said Product Hunt was "not started" — Crawli is actually already live there (4 upvotes, no engagement), doc updated.

**2026-08-20 — Onboarding now requires first/last name; sidebar shows it instead of email**
New `name` step inserted into the onboarding machine right after `branch` (`lib/onboarding.ts`: `branch → name → seed → criteria → alert → tail → done`, 6 screens now). `NameStep.tsx` requires both fields non-empty before Continue; `PATCH /api/onboarding` persists them to new `profiles.first_name`/`last_name` columns and, on completion, composes `display_name` from them if it isn't already set (never clobbers a display name a user set manually). The account button at the bottom of `AppSidebar.tsx` — previously always showing the raw email — now shows `display_name` via a new `useDisplayName()` hook in `nav-hooks.ts` (realtime-subscribed, same pattern as `useTotalUnreadAlerts`), falling back to email then "Account" if unset. Migration also reset `onboarding_step` to 0 for every profile mid-flow (`onboarding_completed_at IS NULL AND onboarding_step > 0`), since inserting a step shifts what the persisted index means and would otherwise strand in-progress users on the wrong screen. `scripts/verify-onboarding.mts` updated for the new 7-state machine (6 screens + done), `npx tsc --noEmit` clean. Not yet verified in a live browser session — do that before considering this fully done.

Older entries live in [`docs/CHANGELOG.md`](docs/CHANGELOG.md). Move an entry there once it drops out of the newest five; do not delete it.


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
