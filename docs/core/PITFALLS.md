# Pitfalls & Lessons Learned

> **Maintenance rule:** this file is for lessons that are STILL RELEVANT — things a future session could get wrong. When a problem is fully resolved and the fix is obvious from the code, remove or summarize the entry. Do not log historical explorations here; put them in git commit messages.

---

## SEO / indexing

**IndexNow key file must stay in `public/` (added 2026-07-01)**
`public/421d3af41bc04a0439069010586fcb56.txt` is Bing's domain-ownership proof — its name AND contents must equal `INDEXNOW_KEY`. Delete it or change the env without updating both and IndexNow submissions silently 403. Submissions (`lib/indexnow.ts`) are **best-effort and never throw** — a failed ping must not break a deploy or the compare cron, so callers don't need try/catch. Locally you'll see `ok:false` / a 4xx in logs because the API rejects `localhost` URLs; that's expected, it works in prod. IndexNow is Bing/Yandex/Naver only — it does nothing for Google (Google indexing is driven via GSC, not code).

**Sitemap `lastmod` must reflect real dates, not `new Date()` (fixed 2026-07-01)**
`app/sitemap.ts` used to stamp every URL with "now", which makes Bing/Google distrust the freshness signal. It now derives real dates: posts `updated||date`, compare pages `scraped_at` (`getCompareLastUpdated()`), static pages last-git-commit (`lib/gitLastModified.ts`). The git helper shells out to `git log` and only works because prod is a persistent `git pull` clone — it falls back to build time if `.git` is absent. If you add a new static page to the sitemap, give it a `gitLastModified("app/<route>/page.tsx")` entry, not a bare `new Date()`.

**IndexNow alone doesn't get URLs crawled promptly on a young domain (found 2026-07-09)**
"Discovered but not crawled" in Bing Webmaster Tools can persist for days/weeks even with IndexNow firing correctly — IndexNow only notifies Bing a URL changed, it doesn't force a recrawl, and Bing gates actual crawling by domain authority. For any real content change (new/edited blog post, new compare item, title/description edit), also run `node scripts/submit-bing.mjs <path...>` — the Bing Webmaster Submission API, which is the same "Request Indexing" action as the WMT UI button. See `docs/reference/SERVER_REFERENCE.md` "Bing priority reindex" for quota details (shared with manual UI submissions, don't resubmit unchanged URLs).

**A blog post and its `compareSlug` page cannibalize each other (found 2026-08-08)**
Every `<item>-resale-price.md` post and its `/compare/<slug>` page targeted the identical head term ("<item> resale price"), and GSC shows Google indexing **exactly one page per pair, almost never both**: of 22 luxury pairs, 8 had only the blog indexed, 3 only the compare page, 1 both, and 10 neither. When adding a new compare item + guide post, the compare page owns `"<item> resale price"` and the post must be titled for a different intent — the "how to vet a cheap listing" angle these posts already contain works well. Don't ship a pair whose two `<title>`s differ only by suffix.

**Whole publish batches get "Discovered — currently not indexed" (found 2026-08-08)**
The 18 luxury compare items added in one day on 2026-07-25 went almost entirely unindexed (16 of 18), while every compare page from the 2026-06-30 batch is indexed. Same template, same word count (~1,950), 200s, correct canonicals, sub-600ms TTFB, all in the sitemap — so **don't go looking for a technical bug**. It's crawl budget plus a large same-day batch of same-shaped pages in a high-competition vertical on a low-authority domain. Ship new compare items and price-guide posts in small batches spread over weeks, and give each one an inbound link from a page that already earns impressions.

**`SearchAction` must point at `/compare/search`, never `/search` (removed 2026-08-08, re-added 2026-08-13)**
`StructuredData.tsx` originally declared a `SearchAction` pointing at `/search?q={search_term_string}`. `/search` is auth-gated and `Disallow`ed in `robots.ts`, so the searchbox could never work, and Google crawled the literal `{search_term_string}` placeholder as a URL (it showed up in GSC "Blocked by robots.txt"). It was removed, then re-added 2026-08-13 targeting the new **public** `/compare/search?q=` page instead. Three constraints hold it together, and breaking any one re-creates the original bug:
1. `/compare/search` must stay publicly fetchable — no auth, no `Disallow`.
2. `robots.ts` no longer carries the blanket `/*?*q=` rule. That rule existed to block raw search queries, but `/search` is already fully disallowed, so it was redundant there while silently blocking the new page. **Don't re-add `/*?*q=`.**
3. `/compare/search` sets `robots: { index: false, follow: true }` in its own metadata. That's what keeps arbitrary `?q=` permutations out of the index without blocking the crawl the SearchAction declaration needs to be verifiable.

**`/compare/search` is a sibling route on purpose, not `/compare?q=` (added 2026-08-13)**
Reading `searchParams` inside `app/compare/page.tsx` would opt that page out of its `export const revalidate = 3600` and make the main comparison hub dynamic on every request. A static `search` segment also takes routing precedence over `[slug]`, so it never collides with `/compare/<item>`. If you ever need query params on the hub itself, move the reading into a child component wrapped in `<Suspense>` rather than putting them on the page.

**All root layout `<title>` metadata gets `· Crawli` appended (found 2026-07-09)**
`app/layout.tsx` defines `title: { default, template: "%s · Crawli" }`. Any child page/post that sets its own `title` string gets `· Crawli` (9 chars) auto-appended by Next.js — this is easy to forget when checking a title against Bing's ~60-char limit. Always check the *rendered* `<title>` (`curl -s <url> | grep -oE '<title>.*</title>'`), not just the raw frontmatter/string value. Blog post frontmatter titles should stay ≤51 chars so the rendered title (with suffix) stays ≤60.

---

## Relevance filtering

**`tshirt` as anchor kills results (fixed 2026-06-29)**
Users type "bape japan tshirt" (one word). Platform titles write "t-shirt" → tokenizes to "shirt" (a stopword). "tshirt" is not in COMMON_WORDS so it becomes an anchor that never matches. Fix: added "tshirt" to `RELEVANCE_STOPWORDS`. If you add more garment-type synonyms to stopwords, keep them as *type* words only — specific items like "puffer" that could narrow results should stay as anchors.

**Compound sleeve-length words (`longsleeve`/`shortsleeve`) as anchors kill results (fixed 2026-07-08)**
Same tokenization gap as the `tshirt` fix above, but titles that write "long sleeve"/"short sleeve" as two words are a real narrowing signal (unlike "shirt"), so it isn't safe to just stopword it — that would let short-sleeve items through on a long-sleeve query. Fixed via `COMPOUND_ANCHOR_FORMS` in `lib/parse.ts`: `anchorSatisfied` checks the one-word query form against a normalized-substring match of the two-word title form (same mechanism as multi-word brand aliases, but a separate small map — deliberately not folded into `queryExpansion.ts`'s `ALIAS_GROUPS`, since that feeds `detectBrandInText` and a non-brand entry there would corrupt brand detection for other queries). Root-caused via a live alert (`black longsleeve messi jersey`, `saved_searches.id=858a5236…`) that had gone ~5 days silently returning 0 new matches every run — `seen_count` never grew past the 2 URLs seeded on first run. If a user reports a search-alert-style query silently returning nothing, check `saved_searches.last_seen_urls` array length over time before assuming the query is genuinely low-volume.

**Brand alias matching is now in `lib/queryExpansion.ts`**
"bape" must match "A Bathing Ape" titles. The static alias map in `queryExpansion.ts` covers well-known streetwear brands. The LLM expansion path (sidecar `/expand-query`) enriches the long tail. `primeExpansion(query)` is called in `searchWorker.ts` before dispatch — this is the only LLM call in the search hot path. Do not add inline LLM calls in `parse.ts` (it's synchronous).

**"japan" is in COMMON_WORDS (~rank 4700)**
So it is NOT an anchor. "bape japan tshirt" → only anchor is "bape". This is correct — "japan" alone should never block a result. Check `lib/data/commonWords.json` before assuming a word is uncommon.

**Anchor-AND logic: all anchors must match**
The old OR logic let Ronaldo jerseys through on "messi jersey" (shared "soccer" token). AND logic was intentional — don't revert. If a user reports too-strict results, the first check is: which token became an unexpected anchor? Is it in COMMON_WORDS? Add it to RELEVANCE_STOPWORDS if it's a garment type.

**Clothing type words must be stopwords**
"shirt", "hoodie", "sneakers", etc. are in RELEVANCE_STOPWORDS. These are too generic to distinguish brand queries. If ThredUp returns garbage for a brand query, first check: is there a clothing-type token slipping through as an anchor?

---

## Platform-specific gotchas

**Sold data lives in a different layer than the live grid — don't add `sold` to the scrapers** (2026-08-10)
Sold comps for Grailed and Poshmark do NOT go through the Python sidecar at all. Both are plain HTTP from TypeScript (`lib/soldComps/`), ~1s each, no browser. Specifics that will otherwise cost hours to rediscover:
- **Grailed:** the `/shop` grid is active-listings-only and its Sold toggle is **login-gated** — `?sold=true` is parsed into Next.js query state but never switches the Algolia index, and clicking the checkbox logged-out fires no request at all. Sold data is a separate Algolia index, `Listing_sold_production`, which answers to the `public_search_key` embedded in every shop page's SSR HTML. Hits carry `sold_price` (true final), `sold_at_i`, and `created_at_i`. If Grailed rotates the key we recover by re-reading it from the page on a 403 — see `lib/soldComps/grailed.ts`.
- **Poshmark:** `availability=sold_out` works, **but you must also pass `sort_by=recently_sold`.** The default sort returns sales up to 6.6 years old (median 203 days), which makes the median meaningless. `sort_by` is validated server-side — a nonsense value returns **zero rows**, which is how to test whether a sort param is real rather than silently ignored. Parse `window.__INITIAL_STATE__.$_search.gridData.data[]`, **not the DOM**: sold cards render differently and the grid selectors find only 27 of 48 rows. `max_id` is a 1-indexed page cursor.
- **Mercari:** `itemStatuses=2` is the sold filter (`status=sold_out` is ignored). Cards carry a SOLD badge and the final price as the first `$` in `ProductThumbItemPrice`. **There is no sale date anywhere in the card DOM or `__NEXT_DATA__`**, so days-to-sell is impossible. Also needs a browser render. Dropped from sold comps for that reason.
- **ThredUp has no sold filter.** `availability=sold` is silently ignored (119 items back, 114 in-stock, 5 incidentally sold). Ruled out 2026-08-10 — do not re-probe without new evidence.
- **Never pool sold medians across platforms.** For "nike air jordan 1", Grailed's sold inventory is adult pairs (median $125) and Poshmark's is mostly youth sizes and Mid/Low models (median $33). The pooled figure ($55) describes neither market. Report per platform.

**Mercari raw-403s but renders in a real browser — do NOT re-add it to the probe**
Mercari's raw HTTP 403 on the datacenter IP does NOT predict native browser failure — same as Depop. Verified 2026-06-29 on the prod Hetzner IP: real Chromium rendered ~3/4 of searches; the rest fell back to Firecrawl. It was wrongly in `FIRECRAWL_PROBE_PLATFORMS`, which made the fast 403 probe skip the working native render and pay Firecrawl on EVERY search. The probe was removed (default now empty; `/opt/crawli/.env` sets `FIRECRAWL_PROBE_PLATFORMS=`). Mercari now runs native-first with Firecrawl fallback. Do NOT re-add it (or any platform) to the probe unless its block also defeats the real browser from the datacenter IP.

**Depop is NOT probed**
Depop's block is fingerprint-based: raw HTTP 403s but the real browser often passes. Probing would force paid Firecrawl over a working free path. Depop stays on try-native-then-fallback.

**ThredUp fires fine with raw HTTP probe but you must NOT probe it**
Same reasoning as Depop — raw-403 from ThredUp does not predict native browser failure.

**Vestiaire is CSR with ~8s hydration**
The `wait_for` selector on Vestiaire needs the full `a[data-cy^="catalog__productCard__"]` — if you change this, the extractor will get empty HTML. `page_timeout=60_000` is necessary.

**StockX is also heavy CSR**
`[data-testid="ProductTile"]` needs 12s+ wait. `page_timeout=60_000`. If the testid changes (StockX deploys regularly), extraction silently returns 0 listings.

**Poshmark/StockX grid cards lazy-load images — must scroll before capturing HTML**
Both platforms swap in the real `<img>` only when a card scrolls into the viewport (IntersectionObserver). `wait_for` only confirms the *first* card exists, so any card below the fold gets captured mid-lazy-load: Poshmark leaves `src` empty (real URL sits in `data-src`), StockX leaves `src` pointing at its own placeholder (`Product-Placeholder-Default-*.jpg` — the gray-X graphic). `main.py`'s `_LAZY_IMAGE_SCROLL_JS` runs as `js_code` (executes after `wait_for`, before HTML capture) to scroll the page and trigger every card's lazy-load first. If you touch the Poshmark/StockX `_build_run_cfg` blocks, keep `js_code` wired — removing it silently brings back missing/placeholder images on every card past the first screenful.

**RealReal is disabled — do not re-enable without a proxy solution**
PerimeterX press-and-hold blocks all headless approaches including UndetectedAdapter + managed profile cookies. The extractor code is scaffolded in `search_page_extractors.py` but `NATIVE_PLATFORMS` in `lib/types.ts` excludes it. The Python `SEARCH_PAGE_PLATFORMS` includes it — so you'd also need `main.py` wait_for config and to uncomment `lib/types.ts`.

**SEARCH_PAGE_PLATFORMS is duplicated**
The set lives in BOTH `crawl4ai-service/search_page_extractors.py` AND `lib/scraper.ts`. Keep them in sync. If a platform is in the Python set but not the TS set, Next.js routes it through Avenue B (Firecrawl) while the sidecar doesn't know to extract its grid.

**`PLATFORM_STRATEGY[platform]` in `lib/firecrawl.ts` is now inert for all Avenue A platforms**
The route checks `SEARCH_PAGE_PLATFORMS.has(platform)` first. The entries are kept as fallbacks in case a search-page extractor breaks later. Do not delete them.

**Homepage schema's `PLATFORMS` array (`app/components/StructuredData.tsx`) is a fourth, separate platform list**
It's hand-maintained and had drifted — missing ThredUp, describing the site as "eight marketplaces" instead of nine, while the same page's `FAQPage` schema (from `faqData.ts`) correctly said nine. Google can flag mismatched entity counts across a page's own JSON-LD. Fixed 2026-07-08; if the platform roster changes again, update this array too (it's independent of `NATIVE_PLATFORMS`/`SEARCH_PAGE_PLATFORMS`/`PLATFORM_NAMES` in `lib/types.ts`).

**`/compare/[slug]` price schema must be `Product`+`AggregateOffer`, not `ItemList`+`Offer`**
`ItemList` renders as a list/carousel rich result in Google, not the price-range/product snippet. Switched 2026-07-08 (`app/compare/[slug]/page.tsx`) to `Product` with a top-level `AggregateOffer` (`lowPrice`/`highPrice`/`offerCount` across all platforms) containing per-platform `Offer` children. If you add more compare data fields (ratings, images), they go on the `Product`, not the old `ItemList`.

---

## Payments + Supabase

**RLS alone is not enough**
Every public table also needs explicit `GRANT SELECT/INSERT/UPDATE/DELETE ON public.<table> TO authenticated, service_role`. Without GRANTs, every request returns Postgres `42501 permission denied` — not a helpful error message. This applies to any new table you create.

**`search_history` row counts are NOT search counts (found 2026-08-10)**
`search_history` upserts on the unique index `search_history_dedupe (user_id, query, platforms, filters)`. A user running the *same* query with the *same* platforms and filters does not add a row — it only bumps `searched_at`. So `count(*) group by (user_id, query)` counts **distinct platform/filter variants**, not repeats, and it is easy to read "5 rows for one query" as "searched 5 times." It isn't: the busiest pair in the table had 5 rows and 4 distinct platform combos. **The table has never recorded how many times a search was actually run, and there is no way to recover that history.** Treat any "user searched X N times" claim sourced from this table as wrong unless it is counting variants on purpose. A `search_count` column + `record_search()` RPC were built to fix this forward and then reverted the same day (product decision — the repeat-intent feature they existed for was dropped), so the gap is open by choice, not by oversight.

**Realtime subscriptions need the table in the publication**
A new table is NOT automatically streamed over Supabase Realtime. A client `.on('postgres_changes', …)` subscription silently never fires until you `ALTER PUBLICATION supabase_realtime ADD TABLE public.<table>`. The initial `.select()` load still works, so the symptom is "data is right on refresh but the badge/list never updates live." `notifications` was added 2026-06-30 for the nav bell; `saved_searches` was already in it. Check with `select tablename from pg_publication_tables where pubname='supabase_realtime'`.

**Realtime channel names must be unique per subscriber (fixed 2026-07-02)**
`supabase.channel('<name>')` with a hardcoded name throws `cannot add 'postgres_changes' callbacks for realtime:<name> after subscribe()` if two components subscribe with the same name at once. `useTotalUnreadAlerts` used a fixed `'alert-badge'` channel — fine while only `AuthButton` called it, but the new app shell had both `AppShell` (mobile badge) and `AppSidebar` (nav badge) mount it simultaneously → crash. Fixes applied: (1) subscribe once in `AppShell` and pass `unread`/`plan` down as props, and (2) the hook now suffixes the channel name with `${userId}-${random}`. If you add another realtime subscriber, give it a unique channel name (see `SearchAlertsTab`'s `search-alerts-tab-${user.id}-${Date.now()}`).

**supabase-js `.insert()`/`.update()` never throws — an unchecked call can fail silently forever (found 2026-07-15)**
`lib/alertRunner.ts`'s `alert_matches` insert wasn't destructuring `{ error }` from the call, so a failing insert just resolved normally — no exception, nothing in `journalctl`, nothing in Postgres logs (the rejection likely never reached SQL execution at all). A real alert ran daily for ~20 days, correctly detecting 6-12 "new" listings and emailing/notifying every time, while silently storing **zero** rows in `alert_matches` the entire time — the in-app "view matches" list showed nothing for any date, ever. Root cause was probably one malformed listing (missing `url`) killing the whole batch insert, since `insert()` with multiple rows is one atomic statement. Fixed by filtering out rows missing `url` before the insert AND checking/logging `{ error }`. Lesson: any `await supabase.from(...).insert/update/delete(...)` whose result isn't checked is a silent-failure trap — grep for bare `await admin.from(...)` calls without `const { error }` if you're chasing a "should have data but doesn't" bug.

**Baseline-invalidating alert edits now wipe `notifications` too, not just `alert_matches` (2026-07-15)**
Editing an alert's query/platforms/filters/criteria was already dropping stale `alert_matches` rows (PATCH route), but left old `notifications` rows in place — so the per-alert history view (`AlertMatchesModal`) kept showing pre-edit dates with "No longer available" forever (matches gone, history entry still there). Fixed: the PATCH route now deletes `notifications` for the alert too (cascades any remaining `alert_matches` via FK) before re-running as a fresh baseline. `CreateAlertModal` also gained an explicit `reset-confirm` step — Save on a baseline-changing edit routes there first, requiring an affirmative "Yes, clear history & save" click, instead of relying on inline copy inside the general review screen.

**Alert recurrence is a server crontab line, not Vercel Cron**
The app is self-hosted (systemd on Hetzner), so `/api/cron/run-alerts` has nothing triggering it unless a crontab line on `5.78.187.97` calls it. It was missing for ~28 days → every alert's `next_run_at` froze in the past and the UI showed a stale "next check" date (looked like a frontend/timezone bug; it was an ops gap). The line: `*/15 * * * * curl -sf -H "Authorization: Bearer <CRON_SECRET>" https://thecrawli.com/api/cron/run-alerts >> /var/log/crawli-alerts.log 2>&1`. If alerts look stuck, `crontab -l` first.

**`nextAnchoredRunAt` ignored `cadenceHours` until 2026-06-30**
`lib/alertSchedule.ts`'s `ANCHOR_HOURS` was `(_cadenceHours) => [9]` — the param was accepted but never used, so the function only ever found "the next occurrence of 9 AM" regardless of cadence. This produced correct daily behavior by coincidence (24h cadence = next-9AM is always right), but adding weekly (168h) would have silently fired it daily too. Fixed by computing a `daySpan = Math.round(cadenceHours / 24)` and rolling forward that many days before landing on 9 AM, instead of branching on hour-of-day alone. Lesson: a function whose parameter is silently unused is a landmine for the next cadence value — grep for params before assuming "it already handles N" just because the signature accepts N.

**Auth emails (signup confirmation / reset) are throttled by TWO Supabase limits, not Resend (investigated 2026-07-11)**
Confirmation + reset emails go through Supabase Auth → custom SMTP (Resend, verified `thecrawli.com`), NOT the app's `resend.emails.send` code paths (those are contact form / alerts only). So "slow confirmation email" is almost never a Resend problem — Resend delivered every one. Two Supabase-side throttles cause it: (1) **project-wide email rate limit** (Auth → Rate Limits → "Rate limit for sending emails") — was the default **30/h shared across ALL auth email types**; raised to **100/h** on 2026-07-11. Configuring custom SMTP does NOT auto-raise it. (2) **per-user ~60s resend cooldown** — re-submitting signup within the window logs `user_repeated_signup` and **silently sends no email** (200 response, nothing sent), which reads as "email never arrives." Bot signups (e.g. `radiant-flow.org`, random gmails) burn the hourly budget because **CAPTCHA is disabled** (Auth → Attack Protection). Real ceiling on Free tier is Resend's **100 emails/day / 3000/month** — that's what to upgrade if volume grows, not Supabase. For a *single* slow signup (few emails, cap not hit), suspect Gmail Promotions/spam + young-domain deferral, or the 60s no-op — not the cap. The check-email page now has a resend button with a matching 60s countdown so users stop re-hitting signup into the no-op.

**`signUp`'s `identities:[]` response is ambiguous — don't infer confirmation status from `resend()`'s success/error (fixed 2026-07-11)**
When `supabase.auth.signUp()` is called for an email that already has an account, it returns `data.user` with `identities: []` regardless of whether that account is confirmed, unconfirmed, or has no password identity at all (e.g. Google-only signup). The old code tried to disambiguate by calling `supabase.auth.resend({type:'signup', email})` and branching on whether it errored — but `resend()` **also** returns 200 success (silent no-op) for already-confirmed accounts, as part of the same anti-enumeration design. So the "resend errored → show already registered" branch was effectively dead code; real users with existing (especially Google-only) accounts always got funneled into a "check your email" screen that would never receive anything. Confirmed via `auth.users` lookup: a user's account showed `email_confirmed_at` set at creation with `confirmation_sent_at: null` (Google OAuth auto-confirms, no confirmation email ever sent) — he then tried email/password signup twice, `/resend` returned 200 both times, no email arrived either time, and he only recovered via "Forgot password" (which doubles as a way to attach a password identity to an OAuth-only account). Fix: `app/login/page.tsx` no longer branches on `resend()`'s result — it always routes `identities:[]` to `/check-email?...&existing=1`, and that page shows both "if new, check your email" AND concrete recovery options (Continue with Google, sign in with password, forgot password) since the two cases can't be told apart client-side. The resend button stays visible in the `existing=1` state too (a genuinely-unconfirmed repeat-signup user still needs a manual resend path) — don't hide it behind `!existing`, that was an earlier draft bug caught before merge.

**Verified via `auth.users`/`auth.identities` SQL (2026-07-11), for anyone re-deriving this:** `signUp()` on an existing account is a true no-op — no row is created or mutated, confirmed by re-running it against a real Google-only account and diffing `auth.identities` before/after (unchanged, single `google` row). `auth.users.updateUser({ password })` on an OAuth-only account (the password-reset flow) DOES set a working `encrypted_password` on the existing `auth.users` row — confirmed for the real incident user (`has_password` flipped `true` at the exact reset timestamp) — but does NOT add a corresponding `auth.identities` row with `provider: 'email'`. So after a reset, the account has one `identities` row (`google`) but two working sign-in methods (Google + password) — don't assume identity count reflects sign-in method count when debugging this area.

**Resend-button copy must branch on `mode`, not assume signup** — a shared "Resend confirmation email" button used for both the signup and password-reset check-email states will mislabel the reset case (there is no "confirmation" being resent, it's a reset link). Caught in visual QA before merge; the label now reads `Resend reset link` vs `Resend confirmation email` based on `mode === 'reset'`.

**Admin client vs user client**
`createAdminClient()` uses the service role key and bypasses RLS entirely. Use it only in server-side routes and cron jobs. Never expose service role key to client components.

**Credit pack prices are provisioned in Stripe by the owner**
`STRIPE_PRICE_PACK_SMALL/MEDIUM/LARGE` env vars must be set. If unset, the credits route returns 503 (dormant, no broken checkout). Don't create Stripe prices yourself — the owner provisions them and signs off on the dollar amounts in `lib/creditPacks.ts`.

**Stripe webhooks never reach localhost — credits won't grant in `npm run dev`**
A test credit-pack purchase completes on Stripe but `profiles.search_credits` stays 0 in dev, because Stripe can't POST `checkout.session.completed` to `localhost`. Making the price $0 does NOT help — same undelivered webhook. Two ways to test billing locally: (1) `stripe listen --forward-to localhost:3000/api/webhooks/stripe`, copy the printed `whsec_…` into `.env` as `STRIPE_WEBHOOK_SECRET`, restart dev, then buy with test card `4242…`; or (2) deterministic, no browser: `node --env-file=.env scripts/test-credit-webhook.mjs <USER_ID> [small|medium|large]` posts a correctly-signed event straight to the webhook. Prod works because it has a real public URL + registered endpoint.

**Stripe webhook is idempotent via `stripe_webhook_events`**
The webhook claims each `event.id` (PK insert) before processing and skips duplicates (Stripe delivers at-least-once; the credit grant is a non-idempotent read-modify-write). On processing failure the claim is deleted so Stripe's retry re-runs. New table `public.stripe_webhook_events`, service_role-only. Migration: `docs/migrations/stripe-webhook-idempotency.sql`.

**`profiles` column DEFAULTs drift from `TIER_CAPS.free` when pricing changes (found 2026-07-17, actually fixed 2026-07-23)**
New signups get their `profiles` row created by a Supabase-side trigger, `public.handle_new_user()` (not tracked in this repo — only visible via `pg_get_functiondef`, not grep). The 2026-07-17 fix assumed the trigger relies on the table's column-level `DEFAULT` and only updated the DEFAULTs (`docs/migrations/fix-free-tier-column-defaults.sql`). That was wrong: `handle_new_user()` explicitly hardcoded `max_searches_per_period` to `3` in its `INSERT`, which overrides any column DEFAULT regardless of its value — so new signups kept getting capped at 3 searches even after the DEFAULT was corrected to 5. (The other cap columns — `max_saved_searches`, `native_results_cap`, `max_tracked_listings` — were never in the explicit INSERT list, so those genuinely did fall through to DEFAULT and were fixed correctly the first time; only the searches cap was silently broken.) Caught again 2026-07-23 when 3 more signups (2026-07-20 to 2026-07-22) all landed at 3 instead of 5. Real fix: `CREATE OR REPLACE FUNCTION public.handle_new_user()` to drop `max_searches_per_period` from the explicit column list entirely, so it also falls through to DEFAULT like the others. Backfilled the 3 affected users to 5. **Lesson: when a Postgres trigger is suspected of overriding a column DEFAULT, dump its actual definition with `pg_get_functiondef` — don't assume it relies on the DEFAULT just because a similar-looking column does. A trigger can hardcode one column and rely on DEFAULT for its neighbors in the same INSERT.**

---

## Infrastructure

**Streaming endpoints buffer in dev mode**
Test `/api/search` streaming with `curl -N http://localhost:3000/api/search` to bypass Next.js dev proxy buffering. The browser works fine; the proxy is dev-only.

**CSS theming: use `[data-theme="dark"]` not Tailwind `dark:`**
The app sets `data-theme="dark"` on `<html>`. Tailwind's `dark:` variant uses `prefers-color-scheme` by default and won't respond to the attribute without config changes. All dark-mode CSS must use `[data-theme="dark"] .class { ... }`.

**Mobile horizontal overflow comes from `justify-between` label/value rows, not the page shell**
The page shells (`mx-auto max-w-* px-6` + nav) are all mobile-safe; public pages never overflow. Offenders are inner `flex items-center justify-between` rows where one side can't shrink: a long unbroken string (email — needs `break-all`), a fixed-width control (`w-48` quota bars), or a `shrink-0` text run (the profile recent-search platform list) colliding with a sibling. Fix pattern: stack the row on mobile (`flex-col gap-… sm:flex-row sm:items-center sm:justify-between`), give the text side `min-w-0`, and either `break-all`/`truncate` long strings or `hidden sm:inline` secondary text. Detect by loading at 360px and checking `document.documentElement.scrollWidth > clientWidth` — `scrollWidth` over viewport = real overflow; per-element `right > vw` inside an `overflow-x:auto`/marquee container is by-design (Hero search chips, platform logo marquee). Protected pages need auth to view; a throwaway routable page (NOT `_`-prefixed — Next treats `_dir` as private/404) rendering the real prop-driven components with worst-case data verifies them without logging in.

**...unless a `sr-only` absolutely-positioned input has no positioned ancestor (fixed 2026-07-09)**
`FilterPanel.tsx`'s platform-chip row (`overflow-x-auto`, `flex-nowrap`) was making the *whole page* horizontally scrollable on mobile — not just the chip row. Root cause: each chip `<label>` wraps a `<input class="sr-only">` (Tailwind's `position: absolute` screen-reader-only pattern) for the checkbox. The `<label>` had no `position: relative`, so the checkbox's containing block bubbled all the way up to the initial containing block (the document), and its static position was computed from its location in the row's *unclipped* content width (844px), not the row's visible clipped box — pinning a 1px invisible element up to ~450px past the viewport edge and inflating `document.documentElement.scrollWidth` to match. Fix: add `relative` to the label wrapping any `sr-only` absolutely-positioned input, especially inside an `overflow-x-auto`/`flex-nowrap` row. The same unwrapped pattern exists in `app/(protected)/settings/page.tsx`'s platform checkboxes but doesn't currently trigger it because that row is `flex-wrap` (reflows instead of overflowing) — same fix if it's ever changed to `flex-nowrap`. Detect exactly like the note above (`scrollWidth > clientWidth` at 360–390px), but when the offending elements are all `sr-only`/1px and `position: absolute|fixed`, look for the nearest ancestor `label`/wrapper missing `position: relative` rather than assuming a layout-width bug.

**Bare markdown `<table>` elements also blew out mobile width on 47 blog posts (fixed 2026-07-09)**
`globals.css` has `.blog-content .table-wrapper { overflow-x: auto }`, but `lib/blog.ts` rendered posts with plain `marked.parse(content)` — the default renderer emits a bare `<table>` with zero wrapper, so that CSS rule matched nothing. A wide table (long headers, several columns) then forced the raw in-flow `<table>` past the viewport, inflating `document.documentElement.scrollWidth` directly (found via `grep -rlE '^\s*\|.*\|.*\|\s*$' content/blog/*.md` → 47 posts had markdown tables, 0 used a manual wrapper). Fixed by post-processing marked's output in `lib/blog.ts`: `.replace(/<table>([\s\S]*?)<\/table>/g, '<div class="table-wrapper"><table>$1</table></div>')`. Verified with a full sweep: every route in the app (public + protected, all 20 top-level routes + every one of the 47 table-bearing posts) now reports `scrollWidth === innerWidth` at a 390×844 mobile viewport. If a future markdown feature needs different table handling, do it in this same post-process step rather than switching to a different renderer, or the wrapper will silently stop applying again.

**sidecar TTL caches**
- `/scrape` (per URL): 30 min TTL
- `/scrape-search` (per `platform::query`): 10 min TTL
- `_expand_cache` (query expansion, per normalized query): 7 day TTL
- Only successful, non-empty results land in cache; failures retry next time.

**n8n on the server is the real edit path**
`n8n MCP` tools are read-only and only see a subset of workflows. All real workflow edits go via SSH. See `docs/reference/SERVER_REFERENCE.md` for the SSH workflow edit pattern. After editing: export → patch → import + `--active=true` → `systemctl restart n8n`.

**n8n `Run on demand` trigger is required for CLI testing**
n8n 2.8.4's `n8n execute --id` fails with "Missing node to start execution" unless the workflow also has an `Execute Workflow Trigger` node (not just the schedule trigger). Add one to any workflow you want to CLI-test.

**Server deploy `npm install` needs `unzip` (fixed 2026-06-29)**
Puppeteer's postinstall downloads Chrome and extracts it with `unzip` — if missing, install fails with "Required native binary ... was not found in PATH". Already installed on the production box via `apt-get install -y unzip`; only relevant again on a fresh server. If `npm install` instead fails with "browser folder exists but executable is missing," a prior failed extraction left a stale partial cache — `rm -rf /root/.cache/puppeteer && npm install` to fix (upstream extract-zip bug, see `docs/reference/SERVER_REFERENCE.md`).

**Only one Sentry client entry point: `instrumentation-client.ts` (fixed 2026-07-08)**
Next.js auto-loads root `instrumentation-client.ts` — it needs no import anywhere. The original Sentry install (commit `5f9f39b`) also left a legacy `sentry.client.config.ts` wired in via `app/sentry-provider.tsx`, so Sentry was initializing twice per pageload with two different, conflicting configs (the stale one ran `tracesSampleRate: 1` + `sendDefaultPii: true` unconditionally, overriding the intended prod value of `0.1`). Confirmed via a real `next build`: `.next/static/chunks/*.js` contained both configs' distinctive strings in one ~204 KB chunk — this is very likely what PageSpeed Insights was flagging as "~188 KiB unused JavaScript" on the homepage. Removed `sentry.client.config.ts` and `app/sentry-provider.tsx`; the conservative settings (env DSN, `tracesSampleRate: 0.1` in prod) now live solely in `instrumentation-client.ts`. If Sentry needs client config again, edit that file only — do not reintroduce `sentry.client.config.ts` or a wrapper component that imports it.

**Onboarding gate is blocking and lives in `(protected)/layout.tsx`.** While
`profiles.onboarding_completed_at` is null, every protected route redirects to
`/onboarding`. `/onboarding` is deliberately **outside** `app/(protected)/` so it
cannot catch itself — moving it inside creates an infinite redirect that locks every
user out of the entire app. Any new step added to the flow must advance even when its
upstream call fails, for the same reason. `OnboardingFlow.tsx`'s own back navigation
(`prevStep()` in `lib/onboarding.ts`) is safe against this because it never persists —
it only moves local `step` state, so closing the tab mid-back-navigation still resumes
at the furthest step actually reached via `onboarding_step`, never at a stale local
position.

**Any link rendered inside an onboarding screen must open in a new tab.** A plain
`<Link>` to any `(protected)/*` route (e.g. `/settings`) navigates the current tab away
from `/onboarding`, and since the destination is itself gated on
`onboarding_completed_at`, a user who hasn't finished yet gets bounced straight back to
`/onboarding` — silently discarding whatever they'd typed into that step's local state
(e.g. a buy-price value in `TailStep`/`SoldCompsLookup`). `SoldCompsLookup.tsx`'s
"See the fee breakdown" link to `/settings#platform-fees` uses `target="_blank"
rel="noopener noreferrer"` for exactly this reason — it's shared with the onboarding
tail step, not just the standalone `/price-check` page where a same-tab link would be
fine.

---

## Content / marketing

**No em/en dashes in any caption or slide**
The platform rule: no em dashes (—), en dashes (–), or punctuation hyphens used as sentence separators. Use line breaks or plain commas instead. This applies to all generated content in `docs/marketing/`.

**Obfuscate commercial intent in TikTok content**
No `thecrawli.com`, no URL, no "search Crawli", no "download", no "link in bio" on any slide or caption. Crawli is teased as a subtle aside on the final slide only, worded differently each post, present in only some posts. Goal is comment inquiries not clicks. This is baked into the live n8n content brief (`moMVEnr5L6kGgJTC`).

**visual-history.json and POSTS_README.md are the source of truth for batch history**
Before generating a new carousel batch: run `marketing-visual-diversity` skill to read `check-visual-diversity.js` output. Each batch must differ from the last 1-2 on font pairing AND text placement AND layout. These are in `docs/marketing/visual-history.json`.

**Zernio Threads posts: `content` is NOT optional even when using `threadItems`**
`docs.zernio.com/platforms/threads` claims top-level `content` is "optional if threadItems provided" — false as of 2026-07-06. A `threadItems`-only request 400s with `"Content is required for selected platforms"`. `content` must always carry the root post; `platformSpecificData.threadItems` holds only *additional* reply post(s) in the chain, not a repeat of the root. See `scripts/post-to-threads.mjs` and `docs/planning/AGENT_PLAN.md` §1H.

**Threads' 500-char cap can't be bypassed via Zernio**
Zernio does not expose Threads' native 10,000-character text-attachment feature at all — don't build anything assuming it can. Longer content means a real Threads reply (a second post), not a workaround.

**GSC zero-click anomaly on a well-ranked page isn't always a title problem — check cannibalization first**
Before assuming a bad title/snippet caused 0 clicks despite decent position, run `mcp__gsc__cannibalization` to rule out two pages competing for the same query first (would otherwise misdiagnose the fix). Confirmed clean via `dimension_filters` on `page` scoped to the exact query on 2026-07-06 before rewriting two post titles.

**Blog post `description` frontmatter must be ≤160 chars, not just `title` ≤60**
`description` drives `<meta name="description">`, `og:description`, AND `twitter:description` simultaneously (`app/blog/[slug]/page.tsx`) — one over-long field breaks all three surfaces at once. Bing Webmaster flags anything over ~160 chars as "too long." Found 2026-07-06: 66 of 89 posts had descriptions over 160 chars (up to 340) because the reframe session's title-length rule was never paired with an equivalent description rule. Check with: `python3 -c "import re,glob; [print(len(re.search(r'^description:\s*\"(.*)\"\s*$', open(f).read(), re.MULTILINE).group(1)), f) for f in glob.glob('content/blog/*.md')]"` and flag anything outside 25-160.

---

## LLM / sidecar

**OpenAI node output shape in n8n**
The output path is `output[0].content[0].text`, not `message.content`. This has bitten multiple sessions. Verify with the MCP tools or live execution before wiring up an AI node.

**LLM expansion is fire-and-forget for the first request**
`primeExpansion(query)` is awaited in `searchWorker.ts` which means it blocks the search until expansion resolves (or times out at 5s). The timeout is intentional — first-request latency is bounded. Subsequent searches for the same query hit the in-memory cache instantly.

**Do not add per-listing LLM calls**
The only LLM calls in the search hot path are: (1) expansion via `/expand-query` (once per unique query, cached 7d), (2) Tier 2 fallback extraction when Tier 1 structured fails. Adding LLM calls per-listing would make a 9-platform search cost $0.009 × 90 listings = $0.81/search. Check COGS before adding any new LLM call.

**DeepSeek V4 models burn heavy hidden reasoning tokens on small extraction tasks — tested 2026-08-13, not recommended as primary provider**
`_PROVIDER_KEY_ENV` in `main.py` was missing a `"deepseek"` entry — any missing key silently resolves to `None` (the same sentinel `ollama` uses for "no key required"), so `resolve_llm()` would skip reading `DEEPSEEK_API_KEY` entirely rather than validating it. Fixed (added the mapping). But live A/B testing (`deepseek/deepseek-v4-flash` vs `openai/gpt-4o-mini`, same real listing pages, same prompts/schema) found DeepSeek is **not a straight upgrade despite its lower headline per-token price**: it generates 5-20x more output tokens (`reasoning_tokens` in the usage payload) even on trivial JSON-schema extraction, which made it ~21% more expensive on `/scrape` Tier 2 extraction and ~5x more expensive on `/expand-query` in practice, plus 1.5-4x slower wall-clock. On `/expand-query` specifically it twice exceeded the endpoint's 12s timeout in a 4-query sample (would silently degrade to empty enrichment in prod, per the fire-and-forget behavior above). Tried `reasoning_effort="low"` and `thinking={"type":"disabled"}` — neither reduced reasoning-token volume for this provider via litellm; if DeepSeek is revisited, this needs a provider-specific fix (not just a `LLM_PROVIDER` swap) before it's viable for latency-sensitive calls. Extraction accuracy itself was on par with gpt-4o-mini (5/5 correct prices across StockX/Poshmark test listings).
