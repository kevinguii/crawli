# Pitfalls & Lessons Learned

> **Maintenance rule:** this file is for lessons that are STILL RELEVANT — things a future session could get wrong. When a problem is fully resolved and the fix is obvious from the code, remove or summarize the entry. Do not log historical explorations here; put them in git commit messages.

---

## SEO / indexing

**IndexNow key file must stay in `public/` (added 2026-07-01)**
`public/421d3af41bc04a0439069010586fcb56.txt` is Bing's domain-ownership proof — its name AND contents must equal `INDEXNOW_KEY`. Delete it or change the env without updating both and IndexNow submissions silently 403. Submissions (`lib/indexnow.ts`) are **best-effort and never throw** — a failed ping must not break a deploy or the compare cron, so callers don't need try/catch. Locally you'll see `ok:false` / a 4xx in logs because the API rejects `localhost` URLs; that's expected, it works in prod. IndexNow is Bing/Yandex/Naver only — it does nothing for Google (Google indexing is driven via GSC, not code).

**Sitemap `lastmod` must reflect real dates, not `new Date()` (fixed 2026-07-01)**
`app/sitemap.ts` used to stamp every URL with "now", which makes Bing/Google distrust the freshness signal. It now derives real dates: posts `updated||date`, compare pages `scraped_at` (`getCompareLastUpdated()`), static pages last-git-commit (`lib/gitLastModified.ts`). The git helper shells out to `git log` and only works because prod is a persistent `git pull` clone — it falls back to build time if `.git` is absent. If you add a new static page to the sitemap, give it a `gitLastModified("app/<route>/page.tsx")` entry, not a bare `new Date()`.

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

---

## Payments + Supabase

**RLS alone is not enough**
Every public table also needs explicit `GRANT SELECT/INSERT/UPDATE/DELETE ON public.<table> TO authenticated, service_role`. Without GRANTs, every request returns Postgres `42501 permission denied` — not a helpful error message. This applies to any new table you create.

**Realtime subscriptions need the table in the publication**
A new table is NOT automatically streamed over Supabase Realtime. A client `.on('postgres_changes', …)` subscription silently never fires until you `ALTER PUBLICATION supabase_realtime ADD TABLE public.<table>`. The initial `.select()` load still works, so the symptom is "data is right on refresh but the badge/list never updates live." `notifications` was added 2026-06-30 for the nav bell; `saved_searches` was already in it. Check with `select tablename from pg_publication_tables where pubname='supabase_realtime'`.

**Realtime channel names must be unique per subscriber (fixed 2026-07-02)**
`supabase.channel('<name>')` with a hardcoded name throws `cannot add 'postgres_changes' callbacks for realtime:<name> after subscribe()` if two components subscribe with the same name at once. `useTotalUnreadAlerts` used a fixed `'alert-badge'` channel — fine while only `AuthButton` called it, but the new app shell had both `AppShell` (mobile badge) and `AppSidebar` (nav badge) mount it simultaneously → crash. Fixes applied: (1) subscribe once in `AppShell` and pass `unread`/`plan` down as props, and (2) the hook now suffixes the channel name with `${userId}-${random}`. If you add another realtime subscriber, give it a unique channel name (see `SearchAlertsTab`'s `search-alerts-tab-${user.id}-${Date.now()}`).

**Alert recurrence is a server crontab line, not Vercel Cron**
The app is self-hosted (systemd on Hetzner), so `/api/cron/run-alerts` has nothing triggering it unless a crontab line on `5.78.187.97` calls it. It was missing for ~28 days → every alert's `next_run_at` froze in the past and the UI showed a stale "next check" date (looked like a frontend/timezone bug; it was an ops gap). The line: `*/15 * * * * curl -sf -H "Authorization: Bearer <CRON_SECRET>" https://thecrawli.com/api/cron/run-alerts >> /var/log/crawli-alerts.log 2>&1`. If alerts look stuck, `crontab -l` first.

**`nextAnchoredRunAt` ignored `cadenceHours` until 2026-06-30**
`lib/alertSchedule.ts`'s `ANCHOR_HOURS` was `(_cadenceHours) => [9]` — the param was accepted but never used, so the function only ever found "the next occurrence of 9 AM" regardless of cadence. This produced correct daily behavior by coincidence (24h cadence = next-9AM is always right), but adding weekly (168h) would have silently fired it daily too. Fixed by computing a `daySpan = Math.round(cadenceHours / 24)` and rolling forward that many days before landing on 9 AM, instead of branching on hour-of-day alone. Lesson: a function whose parameter is silently unused is a landmine for the next cadence value — grep for params before assuming "it already handles N" just because the signature accepts N.

**Admin client vs user client**
`createAdminClient()` uses the service role key and bypasses RLS entirely. Use it only in server-side routes and cron jobs. Never expose service role key to client components.

**Credit pack prices are provisioned in Stripe by the owner**
`STRIPE_PRICE_PACK_SMALL/MEDIUM/LARGE` env vars must be set. If unset, the credits route returns 503 (dormant, no broken checkout). Don't create Stripe prices yourself — the owner provisions them and signs off on the dollar amounts in `lib/creditPacks.ts`.

**Stripe webhooks never reach localhost — credits won't grant in `npm run dev`**
A test credit-pack purchase completes on Stripe but `profiles.search_credits` stays 0 in dev, because Stripe can't POST `checkout.session.completed` to `localhost`. Making the price $0 does NOT help — same undelivered webhook. Two ways to test billing locally: (1) `stripe listen --forward-to localhost:3000/api/webhooks/stripe`, copy the printed `whsec_…` into `.env` as `STRIPE_WEBHOOK_SECRET`, restart dev, then buy with test card `4242…`; or (2) deterministic, no browser: `node --env-file=.env scripts/test-credit-webhook.mjs <USER_ID> [small|medium|large]` posts a correctly-signed event straight to the webhook. Prod works because it has a real public URL + registered endpoint.

**Stripe webhook is idempotent via `stripe_webhook_events`**
The webhook claims each `event.id` (PK insert) before processing and skips duplicates (Stripe delivers at-least-once; the credit grant is a non-idempotent read-modify-write). On processing failure the claim is deleted so Stripe's retry re-runs. New table `public.stripe_webhook_events`, service_role-only. Migration: `docs/migrations/stripe-webhook-idempotency.sql`.

---

## Infrastructure

**Streaming endpoints buffer in dev mode**
Test `/api/search` streaming with `curl -N http://localhost:3000/api/search` to bypass Next.js dev proxy buffering. The browser works fine; the proxy is dev-only.

**CSS theming: use `[data-theme="dark"]` not Tailwind `dark:`**
The app sets `data-theme="dark"` on `<html>`. Tailwind's `dark:` variant uses `prefers-color-scheme` by default and won't respond to the attribute without config changes. All dark-mode CSS must use `[data-theme="dark"] .class { ... }`.

**Mobile horizontal overflow comes from `justify-between` label/value rows, not the page shell**
The page shells (`mx-auto max-w-* px-6` + nav) are all mobile-safe; public pages never overflow. Offenders are inner `flex items-center justify-between` rows where one side can't shrink: a long unbroken string (email — needs `break-all`), a fixed-width control (`w-48` quota bars), or a `shrink-0` text run (the profile recent-search platform list) colliding with a sibling. Fix pattern: stack the row on mobile (`flex-col gap-… sm:flex-row sm:items-center sm:justify-between`), give the text side `min-w-0`, and either `break-all`/`truncate` long strings or `hidden sm:inline` secondary text. Detect by loading at 360px and checking `document.documentElement.scrollWidth > clientWidth` — `scrollWidth` over viewport = real overflow; per-element `right > vw` inside an `overflow-x:auto`/marquee container is by-design (Hero search chips, platform logo marquee). Protected pages need auth to view; a throwaway routable page (NOT `_`-prefixed — Next treats `_dir` as private/404) rendering the real prop-driven components with worst-case data verifies them without logging in.

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
