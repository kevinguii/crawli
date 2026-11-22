# Crawli — Handoff

**Last updated:** 2026-09-15 (final — repo archived, legacy Supabase keys disabled, see Project status below)

## How to use this file
 
**docs/HANDOFF.md is the current-state hub** — what is true right now, what is broken, what is open. It is NOT a changelog.

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

## ⏹ Project status: WINDING DOWN · repo archived 2026-09-15

The service was still fully operational at archive time — 9/9 platforms working,
server up 60 days, all crons firing, compare pages last refreshed 2026-09-14.
Nothing below describes a broken system; it describes a working one being retired.

- **Read this first if you are new or returning:** [`docs/CRAWLI_TEARDOWN.html`](docs/CRAWLI_TEARDOWN.html) — a self-contained browser walkthrough of the whole system and what the numbers ended up saying.
- **To run it again:** [`RESTORE.md`](RESTORE.md). `node_modules`, both Python venvs and `.next` were stripped for archival (1.85 GB); source, docs, content, migrations and git history are complete. `npx tsc --noEmit` was verified clean immediately before stripping.
- **Last open security item is now closed:** Supabase legacy API keys were disabled 2026-09-15. The leaked `service_role` JWT is dead and has been scrubbed from git history. See Recent changes.

**Final numbers (2026-09-15, pulled live):** 105 users · 4 paying customers plus the
owner's own account · 84 users ever searched · 13 ever returned on a second day ·
324 searches · 37 alerts across 32 users · 193 saves across 6 users · 176 GSC clicks
and **6,189 Microsoft Copilot citations** in the trailing 90 days.

---

## Current state (2026-09-07)

**Platforms: 9 total, all 9 native and working (Avenue A) and deployed to prod. Avenue B is retired.**
Note: Mercari, Depop and now eBay are native-first with a Firecrawl fallback — they can 403 the datacenter IP but real Chromium renders most searches, so they're free most of the time and only pay a Firecrawl credit on an actual render miss. (Mercari's misclassifying hard-block probe was removed 2026-06-29.) The other 5 working native platforms are free always. ThredUp is a special case: fixed this session via its own dedicated one-shot browser, not Firecrawl — see its row below. **eBay moved off Avenue B on 2026-08-25** — it was the last platform doing Firecrawl URL discovery + a per-listing scrape fan-out.

| Platform | Avenue | Status |
|---|---|---|
| Grailed | A | ✅ |
| Depop | A | ✅ (native-first, Firecrawl fallback on intermittent fingerprint block — never pre-probed) |
| Mercari | A | ✅ (native-first, Firecrawl fallback on intermittent render miss — like Depop; probe removed 2026-06-29) |
| ThredUp | A | ✅ **Fixed 2026-09-02, live in prod** — was fully broken 2026-08-28 through 2026-09-02 (Cloudflare Bot Management). Now uses a dedicated one-shot `UndetectedAdapter` browser per search, capped to 1 concurrent. Per-listing/watchlist-refresh still broken. See PLATFORM_STATUS.md. |
| Vestiaire | A | ✅ |
| Vinted | A | ✅ |
| Poshmark | A | ✅ |
| StockX | A | ✅ |
| eBay | A | ✅ (native SRP since 2026-08-25; Firecrawl fallback on 403) |
| RealReal | — | ❌ disabled (PerimeterX) |

Full per-platform details, selectors, and open issues: [`docs/core/PLATFORM_STATUS.md`](docs/core/PLATFORM_STATUS.md)

**Tier caps (`lib/tierCaps.ts` — single source of truth; repackaged 2026-08-17 into two plans):**

| | Free | Pro ($5/mo · $50/yr) |
|---|---|---|
| Searches/week | 5 | 50 — **sold as "Unlimited"** |
| Results per native platform | **8** | 100 — **sold as "Unlimited"** |
| Alerts | **1** | 25 — **sold as "Unlimited"** |
| Alert cadence | daily or weekly | as often as hourly (1h/3h/6h/12h/24h/168h) |
| Saves | **10** | 500 |
| Tracked listings | **10** | 500 |
| Price summary · sold comps · flip margin | **🔒 locked** | ✅ |

- **Pro's two search-shaped caps are marketed as "Unlimited" while staying finite in `TIER_CAPS`** — 50/week and 100 per native platform are anti-abuse backstops, not product limits, the same deliberate copy/cap divergence already in force for saves and tracked listings. Grounding: busiest user-week ever recorded is 13 searches, p90 is 5.9, **0 of 52 user-weeks have ever exceeded even the old cap of 40**. **Pro repriced $10 → $5/mo ($50/yr, weekly billing dropped) on 2026-08-21** — break-even at $5/mo is ~248 searches/mo (worst case: all 9 platforms every search on Firecrawl Hobby); the 50/wk cap (~217/mo) stays under that, but margin drops to **~10% worst-case after Stripe fees (was ~56% at $10)**. Two obligations that come with the word: a paid user must never see a "you used all N searches" wall (`/api/search` carries tier-specific 402 copy and logs a `[quota] PAID user hit the abuse backstop` warning), and if anyone ever actually lands on either cap, raise it or drop the word.
- **Alerts joined the "Unlimited" set too (2026-08-18)** — Pro's saved-search cap went 8 → 25. Different cost shape from the two caps above: a saved alert is a *permanent recurring job* (reruns forever via the `/api/cron/run-alerts` crontab), so raising this cap is cheap-per-unit and linear, not free the way the search caps are. Grounding: alert runs never touch Firecrawl (`ALERT_EXCLUDED_PLATFORMS` excludes eBay, the only metered platform), the crontab ticks every 15 min with ~1920/day of headroom against an actual ~13 alerts across 48 users, and the busiest real user ever has 3 alerts. 25 is a backstop for that linear cost, not a felt limit — same rule: if a real user lands on it, raise it or drop the word. **Final count 2026-09-15: 37 alerts across 32 users** — roughly 3x the adoption this decision was grounded on, still an order of magnitude inside the cron's headroom, and nobody ever reached 25.
- **`nativeResultsCap` is free at any value up to 100.** `lib/searchWorker.ts` calls the sidecar with a hardcoded `limit=100` on every tier and the cap is a post-fetch `.slice()`, so a free user's 8-result search costs exactly what a Pro user's 100-result search costs. It also never touches eBay (non-native: hardcoded `slice(0, 10)` listings, and Firecrawl discovery is a hardcoded `searchLimit = 20`). Going past 100 means raising the sidecar limit, which does cost render time. See PITFALLS.
- **`max` is retired from the pricing page** but stays in `TIER_CAPS` and `tierFromPriceId` so a legacy price ID can never downgrade anyone. **No account resolves to it** — verified by `scripts/verify-paywall.mts`.
- **Caps moved out of `lib/stripe.ts` into `lib/tierCaps.ts`** (which imports nothing) so client components and the search worker can read them without bundling the Stripe SDK. `lib/stripe.ts` re-exports everything, so existing import sites are unchanged. See PITFALLS.
- Caps are stored on `profiles` columns (`max_searches_per_period`, `max_saved_searches`, `max_tracked_listings`, `native_results_cap`, `max_saves`, `min_alert_cadence_hours`) AND derived in `TIER_CAPS`. **Enforcement reads DB-first, so a TIER_CAPS change needs a `profiles` backfill** — done 2026-08-17 for all 46 users, and the column *defaults* were retuned too (new signups inherit them). `nativeResultsCap` is the exception — always read live from TIER_CAPS.
- **`profiles` grants are column-level** — a new cap column needs its own `GRANT` in the same migration or it 42501s. See PITFALLS.
- **Free alerts are gated by count, not frequency** (owner decision 2026-08-17, reversing a weekly-only free floor); Pro still has a count cap (25) but is not gated by frequency. Alert runs are cheap — `lib/searchCache` fans one scrape out to every user watching the same query — and the alert email was long *assumed* to be the strongest driver of a second session, the metric this product is worst at. **That assumption was measured for the first time on 2026-09-07 and it does not hold:** 254 alert emails sent in 30d, 252 delivered, **0 opened and 0 clicked**, with Resend open+click tracking confirmed enabled on the domain and no per-send override in `lib/alertRunner.ts`. Do not cite alerts as a proven retention mechanism until the deliverability issue below is resolved and the numbers are re-read. `min_alert_cadence_hours` is 24 for free (daily or weekly only) and 1 for Pro/Max (any of the 6 presets in `lib/alertSchedule.ts`, down to hourly) since the 2026-08-25 paid alert-speed change, driven off `caps.minAlertCadenceHours` from `/api/billing/status` — frequency is now the paid tier's differentiator, not just count.
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

**Compare pages + blog (verified 2026-07-26):** 33 rows in `compare_items` → 33 `/compare/[slug]` pages (`app/compare/[slug]/page.tsx`, carries `FAQPage` schema). Since 2026-08-17 their `<title>`/description are generated from the live snapshot (stocked-platform count + a trimmed typical asking-price band via `typicalPriceBand()`), not static strings — the raw `min_price_usd`/`max_price_usd` columns must never reach a snippet, see `docs/core/PITFALLS.md`. Category mix: luxury-handbags 12, sneakers 5, hoodies 4, luxury-watches 3, outerwear 3, tops 2, luxury-accessories 2, denim 1, luxury-jewelry 1 — i.e. 18 luxury / 15 streetwear. `content/blog/` holds 116 posts, of which 33 carry `compareSlug` (one per compare item). The blog's Price Guides tab count is *derived* — `priceGuidesCount={priceGuidePosts.length}` in `app/blog/page.tsx` — so it tracks `compare_items` automatically and needs no manual bump. Refresh path is `/api/compare/refresh` (applies `filterAuthentic()`, see Open issues); results cache in `compare_snapshots`, read back by `getCompareHeroData()` in `lib/compare.ts` for the landing hero. **As of 2026-09-08 the cron only refreshes a curated 15 of the 33 items, weekly** (was daily/all-33) — see Recent changes and `docs/reference/SERVER_REFERENCE.md` "Compare-pages refresh cron" for why and the heartbeat guard that came with it.

**Auth bot protection:** Cloudflare Turnstile on the auth forms via `app/components/TurnstileWidget.tsx` — mounted in `app/login/page.tsx`, `app/forgot-password/page.tsx`, `app/check-email/page.tsx`.

**Landing page:** comparison-first structure (2026-07-08), rebuilt for AI-referred visitors 2026-08-13. Order: Hero (live `CompareHeroWidget` — rotates real per-platform prices for 5 curated compare items, right column; plus `HeroSearch.tsx`, a public no-auth typeahead over all 33 `compare_items` that routes matches to `/compare/[slug]` and misses to `/compare/search?q=`) → PlatformLogos → Testimonials (two real attributed quotes, no Review schema on purpose) → CompareSection (full item grid) → AlertsAndTrackedSection (combined tabbed pitch, replaces old AlertsMock+SavesMock) → MarginSection (demoted `FlipCalculator`, moved out of the hero) → BentoFeatures (trimmed to 3 supporting cards — 9-platform search, price intelligence, smart filters). `CompareHeroWidget` reads only the existing `compare_snapshots` cache via new `getCompareHeroData()` in `lib/compare.ts` — no new scrape, no new endpoint. Curated hero rotation slugs: `jordan-1-retro-high`, `bape-shark-hoodie`, `carhartt-wip-jacket`, `nike-dunk-low`, `supreme-box-logo-hoodie` (constant in `app/page.tsx`).

---

**ACTION REQUIRED: no DMARC record on thecrawli.com, and alert-email engagement is exactly zero — cause not yet confirmed (found 2026-09-07)**
`dig TXT _dmarc.thecrawli.com` returns nothing (SPF and Resend DKIM are both fine), and separately, **254 alert emails sent over 30 days, 252 delivered, 0 opens and 0 clicks**, with tracking verified enabled and a real HTML body confirmed being sent. **These two facts are not yet proven connected** — 254 emails reached only ~19 real people, so 0% clicks is weaker evidence than it looks, and Resend's metrics window here is only ~30 days, so whether this is new is unknown. Add the DMARC record regardless (`_dmarc` TXT, `v=DMARC1; p=none; rua=mailto:dmarc@thecrawli.com`, it's free and correct either way), but **before treating alert delivery as the retention fix, run the falsification test**: trigger a matching alert on a known-good account, open it, click a link, confirm Resend registers the click. If it doesn't register, tracking itself is broken and this is a smaller bug than diagnosed. Full writeup with the calibration: `docs/planning/COMPETITIVE_POSITIONING.md` §6c. **Until re-measured, no claim about alerts driving retention is supportable** (see the alerts bullet above) — one heavy user got 4 alert emails in a single day and has opened none of 72 badge-worthy notifications, which is suggestive but not conclusive on its own.

**eBay Akamai blocks — search path fixed 2026-08-25, watchlist refresh still exposed**
The search path no longer scrapes eBay per-listing, so its block surface dropped ~10x: measured 8/8 concurrent queries clean from the prod Hetzner IP, and a 403 now costs ~3s before the Firecrawl fallback returns a full grid for ~1 credit. **Watchlist price refresh still hits eBay listing pages one at a time and still sees ~1 in 5 403s** — `[structured] crawl failed`, LLM fallback on partial content. Not worth fixing now. Options if it worsens: residential proxy, eBay Browse API (OAuth required), paid unlocker.

**StockX SSR vs live price drift**
Possible that `trade-box-buy-amount` in SSR HTML differs from live hydrated DOM. User decision: leave as-is. Add "scraped at" timestamp if user complaints arrive.

**Compare-page floors: authenticity filter shipped, residual gaps remain**
Fixed 2026-07-25 for the luxury set: `filterAuthentic()` in `app/api/compare/refresh/route.ts` drops listings matching replica signals (dupe, inspired, replica, style, vibe, lookalike, shufirst, "like [brand]") plus category-specific wrong-item terms (wallet/charm/ring/book/print ad/jacket for handbags; bracelet/necklace/case-only for watches; etc.), keyed off `compare_items.category`. Scoped to this refresh path only, does not touch `lib/parse.ts` or live search. Confirmed it caught real cases: a $17.96 "Birkin" that was a dust bag, a $125 "Cartier Tank" that was a hardcover book, a $39 "Rolex Datejust" that was a framed print ad, a $36 "Omega Speedmaster" that was a bomber jacket. Streetwear items keep prior behavior (category not in the exclude map).
**Residual, disclosed in the blog posts rather than filtered:** a few implausible outliers still get through title-text matching because nothing in the title says they're wrong — a $131 "Rolex Datejust" (Mercari), a $50.63 "Cartier Love Bracelet" (Depop, physically impossible for solid 18k gold), a couple of Cartier Tank listings that are actually the Santos model or a strap-only sale. Each affected post calls this out explicitly as a buyer-protection tip rather than quoting the number as real. No further filtering planned unless these recur after future refreshes — chasing every edge case with title regex has diminishing returns; a price-plausibility model would be the next real step if this keeps surfacing.

---

## Recent changes

**2026-11-22: Git history scrubbed and repo published as a portfolio piece**
Rewrote all history with `git filter-repo` before going public: removed the `archive/db/` shutdown DB dump (user emails), redacted every leaked credential (Supabase `service_role` and n8n JWTs, Google OAuth client secret + refresh token; the Google client was also deleted), replaced the owner's personal email and handles with placeholders, and dropped screenshots containing personal or third-party data. Recreated the GitHub repo as `kevinguii/crawli` so no pre-rewrite commit stays reachable; moved HANDOFF/RESTORE/SCALING into `docs/` and rewrote the README as a reviewer-facing overview above the full teardown.

**2026-09-15: Supabase legacy API keys disabled — closes the last open security item**
The `service_role` key that was committed in plaintext across 7 files (2026-08-15) had already been rotated to a new `sb_secret_...` key everywhere it was consumed (`.env`, n8n, scripts). The one remaining step — disabling the legacy JWT itself in Supabase's dashboard (API Keys → "Legacy anon, service_role API keys" tab) — is now done. The old key is dead; its plaintext copy still sits in git history but is worthless. Rewriting history remains deliberately skipped (a force-push would break existing clones, and the repo is private) — revisit only if the repo is ever made public.


**2026-09-15: Bing AI Performance found 6,189 Copilot citations; repo archived and stripped for storage**
Owner supplied Bing Webmaster Tools AI Performance data that had gone unexamined for three months. Over the same 90 days GSC recorded 176 organic clicks, Microsoft Copilot and partner surfaces cited thecrawli.com **6,189 times** (avg 9 distinct pages/day, peak 314 on 2026-09-02) — **35x more citations than clicks.** Citations were 0.6/day before 2026-07-09 and 92/day after, and 2026-07-09 is the date `PITFALLS.md` records the Bing Submission API being adopted; the alignment is exact but is one undated correlation on one domain, not a proven cause. This **validates the Step 3 decision** to treat compare pages as an AI-answer-engine surface and stop measuring them on clicks (see `COMPETITIVE_POSITIONING.md` §5 Step 3), and **does not reopen** writing posts — a citation is not a visit, and these citations coincide with the flattest stretch of the funnel. Caveats recorded: the Jul 27-Aug 6 and Aug 21-23 gaps snap back to 149 and 230 so are almost certainly reporting gaps (true total likely higher), "citation" is Microsoft's undocumented definition, and this covers Bing/Copilot only. Also this session: wrote `docs/CRAWLI_TEARDOWN.html` (full system walkthrough), condensed `docs/superpowers/` into `docs/ARCHIVED_SPECS.md` and repointed all 10 references to it including 6 in source comments and 2 pre-existing dangles, and stripped 1.85 GB of regenerable dependencies with restore steps in `docs/RESTORE.md`. `npx tsc --noEmit` clean before stripping.



**2026-09-08: Root-caused the near-daily sidecar SIGKILLs to the compare-refresh cron, shrank it 94%, added a heartbeat guard**
The sidecar was getting force-killed almost daily around 06:15-06:30 UTC — not OOM, a `systemctl restart` timeout. Traced it to `/api/compare/refresh`'s 6am daily cron fanning 33 items × 9 platforms (297 renders) through the sidecar's small render semaphore, monopolizing it for 20+ minutes and starving the `*/15 * * * *` smoke-test health check, which then auto-restarted the sidecar mid-batch. Same job, at the higher pre-incident RENDERS=6, is almost certainly what caused the original 2026-08-29 OOM too. Also found `crawli-compare.log` had logged nothing since June 2026 — nginx's 300s `proxy_read_timeout` was cutting the client connection before the job (already outliving 300s even before this) finished, even though it completed successfully server-side every time (confirmed via `compare_snapshots.scraped_at`). Pulled 30 days of GSC data — the whole feature earns ~5 clicks/month total — and cut the cron to a curated **15 of 33 slugs** (biased toward luxury + impressions), **weekly instead of daily** (135 renders/week now, down from 297/day). Used the existing `{"slugs":[...]}` body filter rather than `compare_items.enabled`, since disabling an item 404s its live page (`lib/compare.ts` gates on `enabled=true`) — the 18 left out of rotation stay live, just stop getting fresh prices. Also added a heartbeat file (`/run/crawli-compare-refresh.heartbeat`, touched per-slug in `app/api/compare/refresh/route.ts`) that the smoke-test auto-heal cron now checks before restarting, so a refresh in progress no longer gets killed mid-batch. Built and hardened `scripts/bench-sidecar-concurrency.py` to measure a safe RENDERS ceiling directly rather than guessing — after fixing three separate bugs in it (each requiring manual production recovery), a clean run showed RENDERS 2-6 all safe for a single search-sized burst (4.3-5.1Gi peak, well under the ~7.5Gi OOM level), but that doesn't test the sustained-batch failure mode that actually caused the incident, so `RENDERS=3` was left unchanged. **Not yet done:** raising nginx's `proxy_read_timeout` for this route (or making it properly async) so `crawli-compare.log` starts reflecting reality again — deferred until the smaller weekly job's real duration is known. Full detail: `docs/reference/SERVER_REFERENCE.md` "Compare-pages refresh cron" + "Heartbeat guard".



**2026-09-07: Funnel audit at 94 users killed a proposed weekly-pricing change and found the alert email channel is dark**
Owner asked to add a high-anchor weekly plan (~$5-7/wk, monthly removed). Pulled the real numbers first and the change was dropped before any code was written. Findings, in order of consequence: (1) all 4 real paying customers (a 5th Pro account is the owner's own) signed up, searched, created an alert and **paid on day zero**, two of them after only 2 searches against a 5/week free cap, so conversion here is a first-impression impulse buy and has nothing to do with quota exhaustion; (2) **254 alert emails, 252 delivered, 0 opens, 0 clicks**, root cause almost certainly the missing DMARC record (see Open issues); (3) retention is the actual constraint, 76 of 94 users ever searched but only 11 ever returned on a second day, and just 3 of the 48 users in the last three signup cohorts did; (4) 3 of the 4 paying customers have not opened the product since the day they paid, with renewals landing 2026-09-28 and 09-29. Weekly pricing was rejected because day-zero impulse conversion is exactly what a 5x effective price increase breaks, and because it would have overwritten EXP-006/EXP-007 nine days before their scheduled reads. Full writeup and the corrected baseline: `docs/planning/COMPETITIVE_POSITIONING.md` §6c. No behavior change shipped this session; two stale code comments about the notification badge were corrected (the bell already filters to `new_count > 0`, which is not what either comment said).



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
