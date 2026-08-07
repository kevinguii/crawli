# Crawli — Handoff

**Last updated:** 2026-07-26

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

## Current state (2026-07-26)

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

**Account deletion:** users can self-delete via Settings → "Delete account" (type-to-confirm modal) → `DELETE /api/settings/delete-account` → `admin.auth.admin.deleteUser`.

**Compare pages + blog (verified 2026-07-26):** 33 rows in `compare_items` → 33 `/compare/[slug]` pages (`app/compare/[slug]/page.tsx`, carries `FAQPage` schema). Category mix: luxury-handbags 12, sneakers 5, hoodies 4, luxury-watches 3, outerwear 3, tops 2, luxury-accessories 2, denim 1, luxury-jewelry 1 — i.e. 18 luxury / 15 streetwear. `content/blog/` holds 116 posts, of which 33 carry `compareSlug` (one per compare item). The blog's Price Guides tab count is *derived* — `priceGuidesCount={priceGuidePosts.length}` in `app/blog/page.tsx` — so it tracks `compare_items` automatically and needs no manual bump. Refresh path is `/api/compare/refresh` (applies `filterAuthentic()`, see Open issues); results cache in `compare_snapshots`, read back by `getCompareHeroData()` in `lib/compare.ts` for the landing hero.

**Auth bot protection:** Cloudflare Turnstile on the auth forms via `app/components/TurnstileWidget.tsx` — mounted in `app/login/page.tsx`, `app/forgot-password/page.tsx`, `app/check-email/page.tsx`.

**Landing page:** comparison-first structure (2026-07-08). Order: Hero (live `CompareHeroWidget` — rotates real per-platform prices for 5 curated compare items, right column) → PlatformLogos → CompareSection (full item grid) → AlertsAndTrackedSection (combined tabbed pitch, replaces old AlertsMock+SavesMock) → MarginSection (demoted `FlipCalculator`, moved out of the hero) → BentoFeatures (trimmed to 3 supporting cards — 9-platform search, price intelligence, smart filters). `CompareHeroWidget` reads only the existing `compare_snapshots` cache via new `getCompareHeroData()` in `lib/compare.ts` — no new scrape, no new endpoint. Curated hero rotation slugs: `jordan-1-retro-high`, `bape-shark-hoodie`, `carhartt-wip-jacket`, `nike-dunk-low`, `supreme-box-logo-hoodie` (constant in `app/page.tsx`). Design spec: `docs/superpowers/specs/2026-07-08-landing-page-priority-redesign-design.md`.

---

## Open issues

**eBay Akamai blocks (intermittent)**
~1 in 5 eBay listing scrapes returns HTTP 403. Structured extractor logs `[structured] crawl failed`, LLM fallback runs on partial content. Not worth fixing now. Options if it worsens: residential proxy, eBay Browse API (OAuth required), paid unlocker.

**StockX SSR vs live price drift**
Possible that `trade-box-buy-amount` in SSR HTML differs from live hydrated DOM. User decision: leave as-is. Add "scraped at" timestamp if user complaints arrive.

**Compare-page floors: authenticity filter shipped, residual gaps remain**
Fixed 2026-07-25 for the luxury set: `filterAuthentic()` in `app/api/compare/refresh/route.ts` drops listings matching replica signals (dupe, inspired, replica, style, vibe, lookalike, shufirst, "like [brand]") plus category-specific wrong-item terms (wallet/charm/ring/book/print ad/jacket for handbags; bracelet/necklace/case-only for watches; etc.), keyed off `compare_items.category`. Scoped to this refresh path only, does not touch `lib/parse.ts` or live search. Confirmed it caught real cases: a $17.96 "Birkin" that was a dust bag, a $125 "Cartier Tank" that was a hardcover book, a $39 "Rolex Datejust" that was a framed print ad, a $36 "Omega Speedmaster" that was a bomber jacket. Streetwear items keep prior behavior (category not in the exclude map).
**Residual, disclosed in the blog posts rather than filtered:** a few implausible outliers still get through title-text matching because nothing in the title says they're wrong — a $131 "Rolex Datejust" (Mercari), a $50.63 "Cartier Love Bracelet" (Depop, physically impossible for solid 18k gold), a couple of Cartier Tank listings that are actually the Santos model or a strap-only sale. Each affected post calls this out explicitly as a buyer-protection tip rather than quoting the number as real. No further filtering planned unless these recur after future refreshes — chasing every edge case with title regex has diminishing returns; a price-plausibility model would be the next real step if this keeps surfacing.

---

## Recent changes

**2026-08-07 — Competitive positioning analysis vs Beni/Gem/Underpriced AI**
New decision doc `docs/planning/COMPETITIVE_POSITIONING.md`. Live data pull: 36 users (1 paid), 26 searches/30d across 14 users (1.9/user/month, nowhere near the 5/wk free cap), saves and alerts both frozen at 4 and 2 users while signups doubled, GSC 8,203 impr → 39 clicks (0.48% CTR) over 90d with compare pages at 696 impr / **zero** clicks. Search logs show buyer-side and partly non-fashion queries (Xbox, phone, game collectibles), contradicting the hybrid B2B+B2C framing in `B2B_FEATURE_TRUTH.md` §5. Conclusion: the buyer-side aggregator segment is unwinnable against Beni (~50 marketplaces, $6.26M) and Gem (image search + real-time alerts + indie long tail); the reachable position is cross-platform **sold-price** data for resellers, which Crawli does not have today (search returns live asks only). Gated on a 36-user audience-validation step before any build.

**2026-07-25 — Luxury compare pages (15 → 33 items) + 18 dedicated price-guide posts + authenticity filter**
Bing's AI grounding-query report showed every top-cited query for this domain is luxury resale ("compare luxury resale prices including fees" 42.4% citation share, "best marketplaces to resell luxury handbags" 42.9%), with zero streetwear, while all 15 compare items were streetwear with a $1–$28 floor — the site had no live price data behind its luxury claims. Added 18 luxury items (12 handbags, 3 watches, 1 jewelry, 2 accessories) to `compare_items`; every `query` was probed live against all 8 native platforms first. Rows applied to prod, so the pages and sitemap went live without a deploy; snapshots backfilled via the `slugs` filter on `/api/compare/refresh`. Migration recorded in `docs/migrations/luxury-compare-items.sql`.
- **Authenticity filter added** (`filterAuthentic()` in the refresh route) after the initial backfill surfaced replica and wrong-item listings contaminating floors (a dust-bag "Birkin," a book listed as a "Cartier Tank," a jacket as an "Omega Speedmaster"). See Open issues for what it catches and what's still residual.
- **18 new dedicated blog posts** written (one per new compare slug, `<slug>-resale-price.md`, `compareSlug` set, matching the existing streetwear template) with matching cover SVGs in `public/blog/images/`. `compareSlug` was deliberately *not* added to the 5 pre-existing luxury guide posts (Birkin history, Hermès scarf, Cartier Tank, Cartier jewelry, Rolex fake-spotting) — those got a plain markdown link to the relevant `/compare/` page instead, since giving them the "Live pricing" badge and Price Guides tab miscategorized general guide/history content as a price guide. `priceGuidesCount` (Price Guides tab) is now 33, matching `compare_items` exactly.
- Compare-page link blocks added to the two luxury hub posts, hero rotation reweighted to luxury, and `llms.txt` expanded from 24 lines to list the full compare inventory (it previously never mentioned `/compare/` at all).

**2026-07-23 — Actually fixed new-signup search cap stuck at 3 (2026-07-17 fix was incomplete)**
The `handle_new_user()` Postgres trigger hardcoded `max_searches_per_period` to `3` in its INSERT, overriding the column DEFAULT no matter what it was set to — so 3 more users who signed up 2026-07-20/21/22 got capped at 3 again. Fixed the trigger to drop that column from the explicit INSERT (falls through to DEFAULT like the other cap columns always did) and backfilled the 3 affected accounts to 5. See `docs/core/PITFALLS.md` "Payments + Supabase" for the full writeup.

**2026-07-17 — AI-Overview optimization pass on top-impression pages + FAQ on compare template**
- Diagnosed via live GSC + a Playwright pull of the actual Google SERP: "best marketplaces for luxury items" (1,806 impr, pos ~6.5, **0 clicks**) is fully answered by an AI Overview (cites Fashionphile/RealReal/Vestiaire/Farfetch, not Crawli) with Reddit/Quora holding the organic slots — a structural zero-click ceiling, not a title bug. Reworked 5 blog posts to the AIO-citable pattern (direct answer capsule up top, scannable table, question-shaped headings, co-cite trusted entities): `best-secondhand-marketplaces-for-luxury-items`, `how-to-identify-vintage-band-tee`, `how-to-price-secondhand-clothing`, `how-to-optimize-your-depop-profile`, `cavalry-twill-fabric-guide`. Left `vintage-fashion-trends-2026` untouched (already compliant). Also fixed a real fee error (pricing post claimed "Depop takes 10%"; Depop US/UK is $0 commission since 2024 per `lib/marketplaceFees.ts`) and punctuation-dash violations in the cavalry-twill post.
- Added a **data-driven FAQ to the `/compare/[slug]` template** (`app/compare/[slug]/page.tsx`): 4 Q&A computed from the same live snapshot the page renders (price range, cheapest platform, marketplace list, is-it-worth-it), rendered as plain server HTML AND mirrored into a new `FAQPage` node in the existing `@graph` — this was the one AIO gap vs the blog (compare pages already had the answer capsule + Product/AggregateOffer schema). Renders only when snapshot data exists. tsc clean.
- Submitted the 5 changed blog URLs to Bing (priority reindex). **Note:** `scripts/submit-bing.mjs` reads `NEXT_PUBLIC_SITE_URL` from `.env`, which locally is `http://localhost:3000` → it submits localhost URLs and Bing 400s `NotAuthorized`. Ran the API call directly with `siteUrl=https://thecrawli.com` instead. The script works as-is on the server (prod `.env`), but is broken for local runs — worth hardening to force the prod domain.

**2026-07-17 — Fixed stale free-tier column defaults on `public.profiles`**
Two users who signed up 2026-07-16 got 3 searches/1 saved search/10 native results cap instead of the current free tier (5/2/15) — the live table's column `DEFAULT`s were never updated when `TIER_CAPS.free` in `lib/stripe.ts` was bumped, and new-signup profile rows fall through to those defaults. Backfilled both affected users; DDL fix applied via Supabase SQL editor (`docs/migrations/fix-free-tier-column-defaults.sql`) and verified live — defaults now read 5/2/15. See `docs/core/PITFALLS.md` "Payments + Supabase" for the full writeup and the diagnostic technique (PostgREST OpenAPI introspection for live column defaults without a DB connection).

**2026-07-15 — Fixed silent `alert_matches` insert failures + full history reset on baseline edits**
Found via a user report: an alert had been reporting "N new matches" correctly every day for ~20 days while storing zero rows in `alert_matches` the whole time (unchecked `supabase-js` insert error — see `docs/core/PITFALLS.md`). Fixed the silent failure, and separately made baseline-changing edits (query/platforms/filters/criteria) wipe `notifications` history too, not just matches, so old dates don't linger with "No longer available." `CreateAlertModal` now has an explicit `reset-confirm` step requiring "Yes, clear history & save" before a destructive edit applies.

**2026-07-13 — GEO audit of `/compare/[slug]` + added Answer Capsule; corrected stale GROWTH_PLAN.md Phase 2 status**
- Verified existing AggregateOffer/BreadcrumbList JSON-LD (SSR, `app/compare/[slug]/page.tsx`), `public/llms.txt`, and AI-crawler-allowing `robots.ts` were all already in place. Added the one real gap: a plain-text Answer Capsule sentence (price range + marketplace count + cheapest platform) right under the H1, using values already computed for the schema — makes the price range directly citable by AI answer engines without parsing JSON-LD. `docs/planning/GROWTH_PLAN.md` had Phase 2 marked "not built" even though it shipped 2026-07-08 (feeds `CompareHeroWidget`) — corrected the phase status, owner checklist, and status snapshot table; off-page directory/Reddit/PH tasks are unblocked but still not started.

**2026-07-13 — Journey Series illustrated pipeline documented + 3 posts built (Wisdom Kaye, Emma Rogue, Satu Tuohimaa)**
- New illustrated sub-format (AI-redrawn cartoon portraits, 4:5, full-bleed, Playfair Display captions) fully written up in `docs/marketing/journey-series/README.md`, superseding the original photo-only pilot for new posts. Pipeline itself lives outside the repo at `~/Desktop/nano-banana-tests/<post-slug>/` (`process.py` + `build_cta.py`, reused per post). New step added: every journey post now also gets a matching `content/blog/<slug>.md` (real citations, FAQ schema, no forced `compareSlug`) plus 3 draft X posts. See CLAUDE.md "Social media content" for the pointer.

**2026-07-13 — New blog post: third-party luxury authentication providers**
- `content/blog/best-third-party-luxury-authentication-services.md` — fills a gap the two existing authentication posts don't cover (in-house/partner platform checks only); GSC showed real impressions for this exact query already misfiled on an unrelated page. Two other briefed ideas (fee/profit case study, Levi's 501 platform price tracking) were dropped after checking for cannibalization: both duplicated live-ranking posts (`luxury-selling-platform-fees-vs-speed`, `hidden-costs-of-selling-vintage-clothing`, `levis-501-resale-price`) and one repeated the `cross-platform-flip-case-study` format verbatim.

**2026-07-12 — Turnstile CAPTCHA shipped to production, fully enforced**
- New `app/components/TurnstileWidget.tsx` — explicit-render wrapper (`window.turnstile.render`) with an imperative `reset()` handle (tokens are single-use, ~5min TTL) and a `TURNSTILE_ENABLED` export gated on `NEXT_PUBLIC_TURNSTILE_SITE_KEY` being set. Wired into `app/login/page.tsx` (`signUp` + `signInWithPassword`), `app/check-email/page.tsx` (both resend paths — widget only mounts once the 60s cooldown clears), and `app/forgot-password/page.tsx` (`resetPasswordForEmail`). Google OAuth exempt by design.
- Supabase dashboard switch (Auth → Providers → Turnstile) is flipped and enforcing. Deployed to prod (`git pull && npm run build && systemctl restart crawli-next`) with `NEXT_PUBLIC_TURNSTILE_SITE_KEY` in `/opt/crawli/.env`. Verified live on `thecrawli.com`: widget auto-solves invisibly (Managed mode), a bad-credentials sign-in returns `error_code: invalid_credentials` (not a captcha error) in Supabase auth logs — confirms the full token round-trip works in production, not just locally.

**2026-07-11 — Diagnosed slow signup confirmation emails (Supabase auth throttles, not Resend) + fixed existing-account signup dead end**
- Confirmation/reset emails go through Supabase Auth → Resend SMTP (verified), all delivered — not the app's `resend.emails.send` paths. Slowness traced to (1) Supabase project-wide email rate limit stuck at default 30/h shared across all auth email types → **raised to 100/h**, and (2) the per-user ~60s resend cooldown that no-ops repeated signups (`user_repeated_signup` in auth logs). CAPTCHA is still **disabled** (Attack Protection) so bot signups burn the hourly budget — enabling Turnstile/hCaptcha is the outstanding real fix (needs client `captchaToken` wired into `signUp` before flipping the dashboard switch, or all signups break).
- Separately fixed a real dead end found via this investigation: a user with a Google-only account (no password identity) tried email/password signup, got routed to a "check your email" screen that would never receive anything (`resend()` silently no-ops for confirmed accounts, still returns 200 — not a reliable "already registered" signal). `app/login/page.tsx` signup handler now always routes `identities:[]` responses to `/check-email?...&existing=1`; that page shows honest copy plus **Continue with Google** / sign-in-with-password / forgot-password, verified working end-to-end in a real browser (including confirming via SQL that `signUp()` truly no-ops for existing accounts and that `updateUser({password})` correctly attaches a password credential to an OAuth-only account). Resend button (60s cooldown, label branches on signup vs. reset mode) stays visible in the existing-account state too. All auth code paths (email/password signup+signin, Google OAuth, forgot-password, reset-password, `/auth/callback`) re-audited and confirmed correct — no further work needed there. Full write-up in `docs/core/PITFALLS.md` → "Auth emails … throttled by TWO Supabase limits" and "signUp's identities:[] response is ambiguous". CAPTCHA (the remaining piece to stop bots eating the email budget) is scoped and ready to hand off — see `docs/reference/TURNSTILE_CAPTCHA_SETUP.md`.

**2026-07-11 — Tool Spotlight post 2: luxury authentication (`2026-07-11-luxury-authentication/`)**
- Second post in the series, topic chosen off GSC: luxury/authentication queries dominate impressions ("best marketplaces for luxury items" 1,354 impr, plus a large "trusted/reliable/authenticated luxury resale platform" cluster). "5 tools so you never get scammed on a designer piece" — 6 slides, 5 real authentication tools (brand hardware/date-code markers, PurseForum "Authenticate This", paid photo auth like LegitGrails, platforms that authenticate before shipping) with Crawli named as the 5th on equal footing. Series signature held (Satoshi + General Sans, spotlight-photo, centered-stacked); per-post variation = alert-red `#ff4d4d` accent + glassmorphism frosted text panel (both unused in visual-history). Real Unsplash photos, visually reviewed. Not posted yet — pending review. CREDITS photographer names left unfilled (not fabricated). visual-history.json updated (post 91).

**2026-07-09 — Fixed whole-page horizontal scroll on mobile (`/search` + 47 blog posts)**
- Two unrelated root causes, found by sweeping every route (public + protected + all table-bearing blog posts) at a 390×844 viewport and checking `scrollWidth` vs `innerWidth`: (1) `/search`'s platform-chip row had a `sr-only` checkbox with no positioned ancestor, whose containing block bubbled up to the document and pinned it ~450px past the viewport — fixed with `relative` on the chip `<label>` (`FilterPanel.tsx`). (2) `lib/blog.ts` rendered markdown tables as bare `<table>`, never matching the `.table-wrapper` CSS that was supposed to scope their overflow — fixed by wrapping `marked`'s table output in `.table-wrapper` post-render; confirmed across all 47 posts that have a markdown table. Full trace and detection method in `docs/core/PITFALLS.md` → "Mobile horizontal overflow".

**2026-07-09 — New "Tool Spotlight" TikTok carousel series (pilot)**
- New format at `docs/marketing/tool-spotlight-series/` (own README, distinct from the fact-carousel batches and the Journey Series): a genuine "underrated tools" roundup, one real named tool per slide, overlaid on free-licensed Unsplash photos (no AI generation, no gpt-image-2 spend). First draft named zero tools (vague capability blurbs + a hidden aside) and was rejected on review as giving the reader nothing concrete — rebuilt so Crawli is named directly as one of 4 real tools (Google Lens reverse-image check, eBay's sold-listings filter, Google Trends, Crawli), all given equal plain treatment. This is a deliberate per-series exception to the project's obfuscate-CI rule — see the series README "Naming policy". New font pairing (Satoshi + General Sans via Fontshare) and centered-stacked text placement, both new to the project. Not posted yet — pilot pending review.

**2026-07-09 — Bing "Discovered but not crawled" fix: title/description overflow + priority reindex script**
- Root cause of Bing SEO/GEO "issues found": homepage title (77 chars) and meta description (235 chars) exceeded Bing's limits; `/compare/[slug]` titles rendered up to 85 chars once the item name was interpolated into a long fixed suffix; 40/94 blog posts overflowed 60 chars once the root layout's `· Crawli` title template suffix (easy to miss — see PITFALLS.md) was accounted for. All fixed: home/pricing/blog-listing metadata shortened, compare page title template shortened to `${item.name} Resale Price`, 40 blog post titles trimmed losslessly (no meaning change). Committed as `161ce5c` + `db2f0f5`.
- Added `scripts/submit-bing.mjs` — Bing Webmaster `SubmitUrlBatch` API, requests priority reindexing (same effect as manual "Request Indexing" in Bing WMT UI, scriptable). **Run this after any content change** — IndexNow alone wasn't getting Bing to recrawl promptly on this domain. Requires `BING_WMT_API_KEY` in `.env` (already set). See `docs/reference/SERVER_REFERENCE.md` "Bing priority reindex".

**2026-07-09 — 5 new blog posts (GSC-driven, cannibalization-checked) + first interactive in-article component**
- Added `content/blog/*.md` + cover SVGs for: `is-vintage-leather-real-leather` (targets the "is vintage leather real leather" query already at GSC pos 13.7 with no page), `how-to-tell-cashmere-quality` (greenfield — zero cashmere impressions), `best-place-to-sell-vintage-cartier-jewelry`, `depop-fabric-tags-search`, `quiet-luxury-resale-trend-2026`. Keyword targets were chosen against a live GSC pull to avoid cannibalizing existing assets: the Cartier jewelry post is a **spoke** that avoids the 1,042-impr/pos-8.3 "best marketplaces for luxury items" query owned by the luxury hub, and the quiet-luxury post avoids "resale fashion trends 2026" (pos 7.7, owned by `vintage-fashion-trends-2026`). Reciprocal spoke links added to `vintage-fashion-trends-2026`, `identifying-quality-vintage-leather`, and `best-place-to-sell-vintage-cartier-tank`.
- **New pattern:** the two "5 tests" posts (leather, cashmere) embed an interactive tick-as-you-check checklist authored as **raw HTML inside the markdown** (native `<input type=checkbox>`, styled with the site's CSS vars, `accent-color:#7c3aed`). It renders through the existing `marked` → `dangerouslySetInnerHTML` path with **zero code changes** and works without JS. Verified: gray-matter parses all 5, titles ≤60 / descriptions ≤160, no em/en dashes, all internal links resolve, 5 checkboxes render per post. Not committed (user owns commits). UI spot-check in light+dark still the user's to do.

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
- 33 public `/compare/[slug]` pages (18 luxury, 15 streetwear/basics), no auth required — `app/compare/[slug]/page.tsx`. Has `export const revalidate = 3600` but builds as `ƒ` fully dynamic (see 2026-07-07 entry below) — data is fetched fresh per request, not from an hourly ISR cache. Scrape cron `0 6 * * *` wired on server (`/var/log/crawli-compare.log`). Nginx `proxy_read_timeout 300s` added for `/api/compare/refresh`. First snapshot run triggered 2026-06-30. DB tables: `compare_items` (slug registry) + `compare_snapshots` (cached stats + listings). Both applied to prod.
  - **Adding a compare item needs no deploy.** `compare_items` is the source of truth; the route, `generateStaticParams`, and `app/sitemap.ts` all read it live, so an insert makes the page reachable immediately. Only the copy that links to it (blog posts, `llms.txt`, hero list) ships with a deploy.
  - `/api/compare/refresh` accepts an optional `{"slugs":[...]}` body to refresh specific items. No body = all enabled items, which is what the cron posts. Use the filter to backfill newly-added slugs (a full run is ~35s/slug and now exceeds 19 min, well past nginx's 300s `proxy_read_timeout` — the curl 504s but the route keeps running server-side and still completes).
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
