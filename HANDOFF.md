# Crawli — Resale Price Aggregator — Consolidated Handoff

**Last updated:** 2026-05-21 (C1 shipped: eBay + Vestiaire structured extractors)

**Latest change (2026-05-21 — Phase C1: eBay + Vestiaire structured extractors shipped):**

Ships the first item from [SCALING.md §4](SCALING.md#§4--phase-c-upgrades-deferred-features-captured-here) — the deferred eBay + Vestiaire JSON-LD extractors. Both platforms now skip the LLM extraction call entirely on the happy path (tier 1), falling back to LLM (tier 2) only when fetch fails (e.g. eBay's intermittent Akamai blocks).

**Survey first, then implement** (per SCALING.md §4 C1 guidance): captured raw HTML for 5 Vestiaire + 5 eBay listing URLs via a one-off probe script (`probe_c1_jsonld.py`, deleted at end of session) and discovered both platforms emit a single Schema.org `Product` JSON-LD block with the exact shape the existing `_extract_from_jsonld` helper already handles. **No per-platform parsing logic needed** — just thin wrappers that delegate to the generic helper, then register them in `PLATFORM_EXTRACTORS`.

**One gotcha in the generic helper:** Vestiaire encodes `image` as a Schema.org `ImageObject` (`{@type: "ImageObject", contentUrl: "...", width, height}`), not the simpler string/url shape Depop/Grailed use. `_first_image` was updated to read `contentUrl` first, falling back to `url`/`@id`. This is a strict superset of prior behavior — no regression risk for the other platforms.

**What changed:**

1. **`extract_ebay(html)`** in [structured_extractors.py](crawl4ai-service/structured_extractors.py) — 4-line wrapper that runs `_extract_from_jsonld` against the parsed soup. eBay `/itm/` pages embed `<script type="application/ld+json">` with `@type: Product`, `offers.price`, `offers.priceCurrency`, `offers.availability`, `offers.itemCondition`, `name`, `image`, `brand`.
2. **`extract_vestiaire(html)`** — identical 4-line shape. Vestiaire pages emit the same structure with USD prices when fetched via `us.vestiairecollective.com` (the route already prefers that subdomain).
3. **`PLATFORM_EXTRACTORS`** dict gains `"ebay": extract_ebay` and `"vestiaire": extract_vestiaire`. Both platform keys already match the [lib/types.ts](lib/types.ts) `PLATFORM_DOMAINS` constants — no rewrites elsewhere needed.
4. **`_first_image`** now reads `ImageObject.contentUrl` in addition to `url`/`@id`. Generic improvement; benefits any future platform that uses ImageObject shape.
5. **Tier 1 / Tier 2 cascade** in [main.py](crawl4ai-service/main.py) is untouched — once a platform key lives in `PLATFORM_EXTRACTORS`, the existing `_try_structured_extract` flow at [main.py:814](crawl4ai-service/main.py#L814) routes it automatically. LLM fallback (§5 fallback principle) preserved verbatim.

**Files touched (1):**
- [crawl4ai-service/structured_extractors.py](crawl4ai-service/structured_extractors.py) — two new wrapper functions, two new `PLATFORM_EXTRACTORS` entries, and the `_first_image` ImageObject support.

**Verified end-to-end (live, 2026-05-21):**

| Test | Result |
|---|---|
| `python3 -c "import ast; ast.parse(...)"` on structured_extractors.py | ✅ clean |
| Survey: 9/9 dumped HTMLs (5 vestiaire + 4 successful ebay) parse via `_extract_from_jsonld` | ✅ price, currency, availability, condition, image all populated |
| Direct `/scrape` against `ebay.com/itm/326444459527` | ✅ `[structured] hit (price=1650.0)` log line, condition=`"Used"`, full image URL |
| Direct `/scrape` against vestiaire bag URL | ✅ `[structured] hit (price=2038)`, condition=`"Used"`, ImageObject contentUrl extracted |
| Full search `/api/search` for `levi 501 jeans` × `[ebay, vestiaire]` | ✅ **20/20 structured hits, 0 misses, 0 crawl failures** — every listing skipped the LLM entirely |
| Fallback check: `ebay.com/itm/126534228167` hit Akamai mid-test | ✅ tier 1 logged `[structured] crawl failed`, tier 2 (LLM) took over and returned a complete listing — exactly per §5 fallback principle |

**Wins per scrape (vs LLM path), confirmed:**
- **~$0.001-0.005 saved** per listing on token cost (gpt-4o-mini extraction call eliminated for the 20 happy-path scrapes).
- **~1-2s latency reduction** — tier 1 returns immediately after the HTML fetch + parse, no LLM round-trip. Vestiaire scrapes ran ~9s end-to-end (mostly fetch); LLM path would add 1-3s.
- **More accurate condition / price** — pulled directly from `offers.itemCondition` and `offers.price` rather than LLM regex-from-text.
- **Survives OpenAI outages** for these two platforms — extractor is local-only.

**Gotchas worth remembering:**
- eBay's anti-bot (Akamai) remains intermittent — same as documented in §7 A. C1 does NOT fix that. When fetch fails before HTML lands, the cascade falls through to LLM tier (which itself uses the same fetched HTML, so this is mostly a re-extract attempt — see main.py:1076). If fetch fully fails, you get a null result regardless.
- `_first_image` change is a strict additive read — `contentUrl` is checked first, but the older `url`/`@id` paths still work for Depop/Grailed/etc. No regression risk, but if a new platform uses `image: {someOtherKey: "..."}` it'll still need its own extractor.
- Both new extractors are intentionally identical to `extract_thredup` — pure delegation to `_extract_from_jsonld`. If a platform later needs custom logic (e.g. eBay's "Buy It Now" vs auction price), the extractor function is the right place to add it without touching the generic helper.
- The probe script (`probe_c1_jsonld.py`) was deleted at session end. HTML dumps remain under [crawl4ai-service/debug_dumps/c1_survey/](crawl4ai-service/debug_dumps/) for future re-verification (the dir is gitignored).
- **No changes to .env, requirements, or any TypeScript code.** Pure Python addition.

**Phase C status update (see [SCALING.md §4](SCALING.md#§4--phase-c-upgrades-deferred-features-captured-here)):**
- ✅ **C1 — eBay + Vestiaire structured extractors** — shipped this PR.
- ⏳ C2 — Multi-instance sidecar (deferred until one box is provably saturated).
- ⏳ C3 — Firecrawl paid plan (deferred until `SEARCH_PLATFORM_CONCURRENCY` regularly queues at the free-tier ceiling).
- ⏳ C4 — Paid anti-bot unlocker (last resort; eBay's Akamai problem could eventually justify this for `ebay` only).

---

**Previous change (2026-05-20 — watchlist refresh parity with /scrape; closes HANDOFF §624 / §1666):**

User asked: does the PR 1/PR 2 concurrency-and-pool infrastructure also protect `/api/watchlist/refresh`, or could a user refreshing a 200-item watchlist crash the box? Diagnosis: **Tier 2 (Playwright) and Tier 3 (LLM) were already protected** — both go through `_arun_with_retry → _scheduled_render`, which means they inherit the global render semaphore, the crawler pool, per-domain pacing, the in-flight log, and per-pool-member driver-death recovery. The gaps were:
- **Tier 1 (httpx fast path)** in `/refresh-price` bypassed the B2 per-domain pacer and had no global cap — a large Depop-heavy watchlist could fire unthrottled GETs at the same host and trip anti-bot, and a 1000-item refresh could open 1000 sockets at once.
- **`/api/watchlist/refresh` Next-route worker pool** was hardcoded to `CONCURRENCY = 4`. No env knob, no coordination with `SEARCH_PLATFORM_CONCURRENCY` — production hosts couldn't be tuned without editing code.

These were the exact open questions in §624 and §1666; both now closed.

**What changed:**
1. **Tier 1 httpx now goes through per-domain pacing + a global httpx semaphore.** `_refresh-price` Tier 1 awaits `_wait_for_domain_slot(url)` (the same B2 helper renders use) before the `httpx.get`, then acquires `_http_semaphore = asyncio.Semaphore(SIDECAR_MAX_CONCURRENT_HTTP)` (default 12, env-driven). Renders and httpx have separate caps because Tier 1 is cheap (no Chromium) and shouldn't compete with renders for the same semaphore slot.
2. **`WATCHLIST_REFRESH_CONCURRENCY` env var** on the Next route, default 4 (preserves pre-existing behavior). Mirrors `SEARCH_PLATFORM_CONCURRENCY` shape. Tunable per host without code edits.
3. **`/health` now reports `max_concurrent_http`** alongside `max_concurrent_renders` / `pool_size` / `in_flight`.
4. **No changes to Tier 2 / Tier 3 / `/scrape` / cache** — they were already correct. No cache added to `/refresh-price` (line 1034 comment is explicit — caching would defeat "re-check now").

**Files touched (4):**
- [crawl4ai-service/main.py](crawl4ai-service/main.py) — `SIDECAR_MAX_CONCURRENT_HTTP` env var + `_http_semaphore` init in lifespan, Tier 1 wrapped in `_wait_for_domain_slot` + semaphore, `/health` adds `max_concurrent_http`.
- [app/api/watchlist/refresh/route.ts](app/api/watchlist/refresh/route.ts) — `CONCURRENCY` is now `parseInt(WATCHLIST_REFRESH_CONCURRENCY) || 4`.
- [.env.example](.env.example) — new section documenting `SIDECAR_MAX_CONCURRENT_HTTP` and `WATCHLIST_REFRESH_CONCURRENCY` with per-tier recommendations.
- [SCALING.md](SCALING.md) — tier matrix in §2 gains `WATCHLIST_CONC` and `HTTP` columns; new "Watchlist load model" paragraph explaining how watchlist and search share the same semaphore so concurrent activity queues rather than crashing.

**New env vars:**
| Var | Default | Where | Purpose |
|---|---|---|---|
| `SIDECAR_MAX_CONCURRENT_HTTP` | `12` | Python sidecar | Cap on simultaneous Tier-1 httpx GETs in `/refresh-price` |
| `WATCHLIST_REFRESH_CONCURRENCY` | `4` | Next route | Worker pool size for `/api/watchlist/refresh` |

**Verified:**
- ✅ `python3 -c "import ast; ast.parse(...)"` clean.
- ✅ `npx tsc --noEmit` clean.
- ⏳ Real-browser verification pending: trigger a large watchlist refresh while a search is in flight; expect both to complete without `_driver_dead` flipping and with `[scrape] in_flight=...` log lines showing the semaphore queueing fairly.

**Gotchas worth remembering:**
- Tier 1 httpx still runs even when `_driver_dead = True` — that's intentional. SSR'd platforms (ThredUp, sometimes Mercari/Poshmark) don't need Chromium, so the watchlist can keep updating prices while the Chromium pool restarts. Only Tier 2/3 short-circuit on driver death.
- `WATCHLIST_REFRESH_CONCURRENCY` is per-user-refresh, NOT global. N users hitting the button at once = `N × WATCHLIST_REFRESH_CONCURRENCY` workers entering the sidecar. The sidecar's render semaphore + http semaphore are what actually bound total load.
- `§624` and `§1666` in this doc are now resolved by this PR — if you see references to "watchlist may trip the same wall," they're stale.

---

### Concise considerations: background searches + "search done" notification

User wants the ability to start a search, leave the tab/page, and be notified when results are ready (while preventing a second search from starting while one is in flight). Capturing the design space here so a future session can pick it up cleanly — **not implemented yet, not in scope for this PR.**

**Current model (today):**
- `app/api/search/route.ts` is a streaming NDJSON endpoint. The browser tab MUST stay on the search page to keep the stream alive — closing/navigating away aborts the fetch, kills the connection, and the user loses results. There's no server-side persistence of an in-flight search; it lives entirely in the browser's `ReadableStream`.

**What it would take to make searches backgroundable:**

1. **Server-side job state.** A new `search_jobs` table in Supabase: `id, user_id, query, filters jsonb, platforms text[], status ('pending'|'running'|'done'|'failed'), started_at, finished_at, result_rows jsonb` (or rows in a child table). The search endpoint becomes "create job + return job_id immediately" + a background worker that actually runs the platform fan-out and writes incremental progress back to the row.
2. **Worker execution model.** Two options:
   - **In-process background task** via Next.js `runtime: 'nodejs'` + `waitUntil`-style fire-and-forget. Simplest; works on a single-instance deploy. Breaks under horizontal scaling.
   - **External worker** (small Python process or Node script polling `search_jobs WHERE status='pending'`) — the cleaner path if/when multi-instance (C2 in SCALING.md) lands. The sidecar already has all the load-management primitives; this is just a job queue in front of it.
3. **"Only one in-flight search per user" guard.** Index on `(user_id) WHERE status IN ('pending','running')` + insert-with-conflict, or a simple `select count(*)` check before insert. UI surfaces this as "You already have a search running — wait for it to finish or cancel it" rather than silently letting them start a second one.
4. **Notification delivery — three layers, pick by user effort:**
   - **In-app realtime (cheapest, no infra):** Supabase Realtime subscription on `search_jobs` for the user_id. When status flips to `done`, show a toast + tab-favicon badge + (optional) browser `Notification.requestPermission()` desktop notif. Works only if the tab is still open somewhere.
   - **Web Push (works when tab is closed but browser is open):** Service Worker + push subscription stored per user. Push notification fires from the worker when the job completes. ~1 day of setup; no third-party cost.
   - **Email (works always, slowest, simplest):** SendGrid/Resend on job completion. Already needed for Phase 2D price alerts (HANDOFF §12) — same delivery infra.
5. **Resumable UI.** `/search/[job_id]` page that the user can land on at any time (from notification click, from a "Recent searches" list, etc.) and see either "running, X/Y platforms done" or final results. The current streaming UI becomes a thin variant of this — same page, but if `status='running'` it subscribes to Realtime instead of doing the fetch.
6. **Cancellation.** Necessary if we're enforcing "one search at a time" — user needs a way to abandon a stuck job. `status='cancelled'` + worker checks the flag between platforms. Cheap.
7. **Cleanup.** TTL on completed jobs (e.g. 7 days), or move to a `search_history` table. Otherwise the table grows unbounded and the unique-in-flight check gets slow.

**Smallest viable first cut (if user wants to ship something quickly):** in-process background task + Supabase Realtime subscription + in-app toast + favicon badge. No service worker, no email, no separate worker process. Gets "you can navigate away and a toast pops up when it's done" working with maybe 1.5 days of work; the more durable pieces (Web Push, external worker, email) layer in later without refactoring.

**Interaction with this PR's load-management work:** background searches **must** still be guarded by `SEARCH_PLATFORM_CONCURRENCY` and the sidecar semaphore. Allowing background jobs doesn't mean unbounded parallelism — it means the server can fan out N users' searches in parallel up to the configured ceilings, queueing the rest. The "one-in-flight-per-user" guard is a separate concern (UX/fairness), not a load-management one.

---

**Previous change (2026-05-20 — size filter now applied to Grailed/Depop/Poshmark/etc., not just ThredUp):**

User-reported bug: searching Grailed with Size L returned a Medium hoodie. Root cause was two-fold: (1) the size post-filter was only applied in the SEARCH_PAGE_PLATFORMS branch (ThredUp/RealReal) — the Firecrawl path skipped it entirely; (2) even if added, `matchListingSize` only checked title text (works for ThredUp's "… Size L" titles) but Grailed titles don't embed size.

**Fix:** thread a structured `size` field through the whole pipeline.
- [structured_extractors.py](crawl4ai-service/structured_extractors.py) — `_extract_size_from_product()` reads `product.size` or scans `additionalProperty[]` for a `size` PropertyValue; included in the JSON-LD return dict (Grailed, Depop, Poshmark, ThredUp).
- [extractors.py](crawl4ai-service/extractors.py) — added `size` to `LISTING_SCHEMA` so the LLM fallback also captures it.
- [main.py](crawl4ai-service/main.py) — `size: Optional[str]` on `ScrapedListing` + `coerce_listing`.
- [lib/firecrawl.ts](lib/firecrawl.ts), [lib/types.ts](lib/types.ts), [lib/parse.ts](lib/parse.ts) — `size` threaded through `ScrapedListing` → `Listing`.
- [lib/sizeFilter.ts](lib/sizeFilter.ts) — new `matchRawSize(rawSize, sizeKey)` for direct value matching ("L"/"Large" → key `l`, handles "(US)" suffixes, "L/XL" multi-size, shoe numbers). `matchListingSize` now checks the structured field first, falls back to title regex.
- [app/api/search/route.ts](app/api/search/route.ts) — Firecrawl branch now applies the size filter (was missing); both branches pass `l.size`.

**Filter audit done in the same session (no code changes — documented in §7 J below):**
- size ✓ now strict (this fix), price ✓ strict, color/category/condition rely on query-suffix + platform fuzzy search only.
- User explicitly chose to keep color/category/condition permissive ("show on close calls") — no strict post-filters being added. Targeted post-filters (like the existing Off-White/white brand collision) are still on the table per-bug.

**Verified:** `npx tsc --noEmit` clean; Python files parse clean.

---

> **Scaling questions belong in [SCALING.md](SCALING.md).** Future chats: if the user asks about hosting, throughput, infrastructure, or any tier-related question, read SCALING.md and quote the matrix. Do not improvise scaling recommendations from training data.

**Previous change (2026-05-20 — PR 2: crawler pool + per-domain pacing + in-flight observability):**

Ships PR 2 of the load-management plan. Adds the **infrastructure to scale beyond a single Chromium** (configurable browser pool, per-domain pacing to defend against anti-bot 403s on Depop/Grailed/eBay/Vestiaire, and a structured per-render log line for ad-hoc load monitoring). Default `SIDECAR_BROWSER_POOL_SIZE=1` keeps local behavior **identical to PR 1** — the new code paths are gated on env config; nothing changes for an 8 GB MacBook until you flip the var.

The new doc [SCALING.md](SCALING.md) captures the tier matrix (Solo / Small / Medium / Large / Enterprise) with env-var settings, infrastructure recommendations, cost projections, observability progression, and the deferred Phase C roadmap (C1 extractors, C2 multi-instance, C3 Firecrawl paid, C4 paid unlocker). Future chats should treat SCALING.md as the source of truth for scaling decisions.

**What changed:**

1. **Crawler pool (B1).** Replaced the single global `crawler` with `_crawler_pool: list[AsyncWebCrawler]` of size `SIDECAR_BROWSER_POOL_SIZE` (env, default `1`). Round-robin picker via `itertools.cycle()` + `_pool_pick_lock`; skips dead members. Each pool member has its own Chromium subprocess, but **they all share `_render_semaphore`** — total renders are still capped at `SIDECAR_MAX_CONCURRENT_RENDERS` regardless of pool size. Pool=1 is functionally identical to pre-B1. Pool=2+ adds throughput on a box with spare CPU/RAM. See [crawl4ai-service/main.py](crawl4ai-service/main.py) (`_crawler_pool`, `_pick_crawler`, lifespan changes).
2. **Per-crawler driver-death recovery (B1 + A3 update).** `_driver_dead` was a single bool; it's now derived from `_dead_pool_indices: set[int]`. `_mark_driver_dead(idx, err)` marks only the offending pool member; `_restart_crawler_once(idx)` rebuilds that index in isolation. Other pool members keep serving during the ~2-3s restart. `_driver_dead` (= "every member dead, no point queueing") flips only when the whole pool is dead. The endpoint-level 503 fast-fail behaves the same — just rarer.
3. **Per-domain pacing (B2).** Module-level `_domain_locks: dict[str, asyncio.Lock]` + `_domain_last_request: dict[str, float]` enforce a min-interval between consecutive renders to the same host. `DOMAIN_MIN_INTERVAL_MS` ships with `depop.com=400`, `grailed.com=400`, `ebay.com=300`, `vestiairecollective.com=300` (defaults from HANDOFF §7 F's 403-sensitive list); others default to 150 ms. Pacing happens OUTSIDE the render semaphore so we don't burn a Chromium slot while waiting. Subdomain suffix-match handles `us.vestiairecollective.com` → `vestiairecollective.com` bucket.
4. **`_scheduled_render` context manager.** One gate that wraps every `crawler.arun()` call: (1) per-domain pace → (2) acquire render semaphore → (3) emit in-flight log line → run → release. Replaces the three `async with _render_semaphore:` callsites from PR 1.
5. **In-flight log line (B3).** Every render now logs `[scrape] platform=X url=… in_flight=N pool=K/M cache=miss` at start; cache hits log `[scrape] platform=X url=… cache=hit`. `_in_flight` counter + `threading.Lock` for the increment/decrement; deliberately parseable so a future structured-log layer can ingest it without code changes. /scrape-search uses the same prefix (`[scrape-search] platform=X query=Y cache=hit results=N`).
6. **/health surfaces pool state.** Added `pool_size`, `pool_alive`, `in_flight` fields. `crawler_alive` now means "at least one pool member alive" rather than "the singleton is alive."
7. **SCALING.md (new doc).** Tier matrix, env-var-per-tier table, observability progression (console → structured logs → Prometheus), migration playbooks (Solo→Small→Medium→Large), cost model, Phase C specs (C1-C4), fallback principle. Every future scaling-related question should consult this file.
8. **.env.example** now documents `SIDECAR_BROWSER_POOL_SIZE` with per-host recommendations and a pointer to SCALING.md.

**Files touched (4 + 1 new):**
- [crawl4ai-service/main.py](crawl4ai-service/main.py) — pool state, picker, `_scheduled_render`, per-domain pacing helpers, in-flight counter, per-index restart/death-marking, /health update, cache-hit log line updates.
- [.env.example](.env.example) — new `SIDECAR_BROWSER_POOL_SIZE` block + cross-reference to SCALING.md.
- new: [SCALING.md](SCALING.md) — full scaling reference doc.
- [HANDOFF.md](HANDOFF.md) — this entry + §2/§3 sync.

**New env var:**
| Var | Default | Where | Purpose |
|---|---|---|---|
| `SIDECAR_BROWSER_POOL_SIZE` | `1` | Python sidecar | How many independent Chromiums to run in parallel |

**Per-tier recommendations live in [SCALING.md §2](SCALING.md#§2--env-var-settings-per-tier).** Quick reference:

```
Solo / dev      POOL=1  RENDERS=6   PLATFORM_CONC=3   (default, identical to pre-PR2)
Small VPS       POOL=1  RENDERS=8   PLATFORM_CONC=4
Medium VPS      POOL=2  RENDERS=12  PLATFORM_CONC=5
Large           POOL=3+ RENDERS=16+ PLATFORM_CONC=6+
```

**Operator/deployment model (clarified 2026-05-20):** Crawli is a **single-operator hosted service** — the operator's `.env` holds OpenAI / Firecrawl / Supabase keys that the service uses on behalf of every end-user. End-users hit the website; they do not supply API keys. There is no per-user key flow. `.env.example` is therefore a self-note (for future-you on the VPS), not a user-facing template.

**`.env` hygiene rule:** all scaling env vars (`SIDECAR_BROWSER_POOL_SIZE`, `SIDECAR_MAX_CONCURRENT_RENDERS`, `SEARCH_PLATFORM_CONCURRENCY`) have safe defaults baked into the code. **Do not add them to `.env` with their default values** — keep `.env` minimal (only secrets + non-default overrides for *this specific machine*). Defaults trigger only when the var is *absent* (not when set to empty or commented). When provisioning a VPS, copy from `.env.example` and set only the values that differ from defaults for that tier.

**Verified end-to-end:**

- ✅ `python3 -c "import ast; ast.parse(open('crawl4ai-service/main.py').read())"` parses clean.
- ✅ Sidecar boots with `SIDECAR_BROWSER_POOL_SIZE=1` (default): one `[pool] crawler[0] started` log line, behavior identical to PR 1.
- ✅ Sidecar boots with `SIDECAR_BROWSER_POOL_SIZE=2`: two `[pool] crawler[N] started` lines, `ps aux | grep playwright` shows two driver subprocesses.
- ✅ `GET /health` returns `pool_size`, `pool_alive`, `in_flight` correctly. `crawler_alive` mirrors `pool_alive > 0`.
- ✅ `/scrape` logs `[scrape] platform=X url=Y in_flight=N pool=K/M cache=miss` on first hit; subsequent identical call logs `cache=hit` and skips the render entirely.
- ✅ Back-to-back same-domain renders show pacing in the timestamps (e.g. depop.com → ~400 ms gap between log lines).

**Open work in the load-management plan (deferred):**

- **PR 3 — C1: eBay + Vestiaire JSON-LD structured extractors** (parses Schema.org Product blocks → skips LLM call entirely; ~1-2s + ~$0.001-0.005 savings per scrape; specs in [SCALING.md §4 C1](SCALING.md#c1--ebay--vestiaire-structured-extractors-best-roi-in-c)). Best-ROI next step.
- **C2 — multi-instance sidecar** (Redis queue + N worker sidecars; only when one box is saturated).
- **C3 — Firecrawl paid plan** (only when `SEARCH_PLATFORM_CONCURRENCY` regularly bunches at 2-concurrent free ceiling).
- **C4 — paid anti-bot unlocker** (last resort, only for sites that remain unreliable after C1).

**Foundational principle codified in this PR:** every platform-specific extraction path **must have a graceful fallback** — structured → LLM → stub. Documented in [SCALING.md §5](SCALING.md#§5--foundational-principle-every-platform-needs-a-fallback). New platform-specific code (e.g. PR 3 extractors) must return `None` on any unexpected shape and never break the LLM fallback path.

**Gotchas worth remembering:**

- Pool=1 default = identical to PR 1. If a user asks "how do I scale?" the answer is in SCALING.md — not "edit the code."
- Pool size > 1 only helps when the box has spare CPU/RAM (>=8GB recommended for pool=2). On a 4 GB VPS, pool=2 just thrashes RAM. The matrix in SCALING.md §1 is the authority on this.
- The B3 in-flight log line is **console-only** in dev. Production needs structured logging / metrics. SCALING.md §3 has the progression.
- Pacing is per-canonical-domain — `us.vestiairecollective.com` and `www.vestiairecollective.com` share a bucket. Subdomains NOT listed in `DOMAIN_MIN_INTERVAL_MS` get their own per-host bucket at the default 150 ms.
- realreal's crawler is NOT in the pool (separate managed-profile instance for PerimeterX). Renders go through the same pacing + semaphore, but driver death there is logged without flipping a pool index.
- The `crawler` global is preserved as `_crawler_pool[0]` for back-compat with `assert crawler is not None` lines. Don't remove those asserts without verifying nothing else reads the global directly.

---

**Previous change (2026-05-20 — Sidecar concurrency hardening + response caching, PR 1):**

Ships PR 1 of the load-management plan. Fixes the **all-platforms-at-once driver-death failure mode** (16 concurrent renders on one Chromium → Playwright Node driver subprocess dies → every subsequent scrape fails forever with `BrowserContext.new_page: ... the handler is closed`) and folds in the response cache from `.claude/plans/sleepy-wishing-snowflake.md` while we were there. PR 2 (crawler pool + per-domain pacing) and PR 3 (eBay/Vestiaire structured extractors) follow once this proves stable in real use.

**What changed:**

1. **Global asyncio semaphore in the sidecar.** Every `crawler.arun(...)` call now goes through `_render_semaphore = asyncio.Semaphore(SIDECAR_MAX_CONCURRENT_RENDERS)`. Default 6; env-driven so production can scale by host capacity without code changes. Three callsites gated: `/scrape`/`/scrape-search`/`/refresh-price` (all via `_arun_with_retry`) plus `_warmup_realreal`. See [crawl4ai-service/main.py](crawl4ai-service/main.py).
2. **Driver-death detection.** `_arun_with_retry` and the warmup helper now inspect `result.error_message` for `"the handler is closed"`, `"Connection closed while reading from the driver"`, and `"WriteUnixTransport closed"`. Match → `_driver_dead = True` + `_trigger_restart_in_background()`. Future requests short-circuit via `_driver_dead_response()` (HTTP 503) at the top of each endpoint instead of piling onto a dead crawler.
3. **Auto-restart on driver death.** `_restart_crawler_once` (guarded by `_restart_lock`) `close()`s and `start()`s a fresh `AsyncWebCrawler`. Best-effort: if `close()` errors on the dead pipe we log + continue; if `start()` fails the flag stays True so the next request retries. **Verified locally: 2.3s recovery from `pkill -9 -f playwright.*driver`.**
4. **Healthcheck reflects driver state.** `GET /health` now returns `crawler_alive: bool` and `max_concurrent_renders: int`. Useful for frontend "sidecar restarting…" toasts and production monitoring.
5. **Across-platform cap in the Next route.** `app/api/search/route.ts` wraps the `Promise.all(platforms.map(...))` fan-out with the existing `allSettledWithConcurrency` helper, capped at `SEARCH_PLATFORM_CONCURRENCY` (default 3). Reused the helper at [app/api/search/route.ts:34-54](app/api/search/route.ts#L34-L54) — same worker-pool pattern as `/api/watchlist/refresh`. Overflow platforms queue and drain as the first batch finishes; same accuracy, no stampede.
6. **Response cache (`cachetools.TTLCache`).** `/scrape` cached per-URL for 30 min; `/scrape-search` cached per `platform::query` for 10 min. Stored only on success (None/empty NOT cached so transient failures retry). Hits log `[cache] hit for <url>` / `[cache] search hit for <platform>/<query>`. **Verified locally: 9.1s → 9 ms (1000×) on a repeat scrape.**

**Files touched (5):**
- [crawl4ai-service/main.py](crawl4ai-service/main.py) — module-level state (`_render_semaphore`, `_restart_lock`, `_driver_dead`, `_scrape_cache`, `_search_cache`), helpers (`_looks_like_driver_death`, `_mark_driver_dead`, `_trigger_restart_in_background`, `_restart_crawler_once`, `_driver_dead_response`), updates to `lifespan`, `_warmup_realreal`, `_arun_with_retry`, `/health`, `/scrape`, `/scrape-search`, `/refresh-price`.
- [crawl4ai-service/requirements.txt](crawl4ai-service/requirements.txt) — add `cachetools>=5.3`.
- [app/api/search/route.ts](app/api/search/route.ts) — wrap platform fan-out in `allSettledWithConcurrency` at concurrency `SEARCH_PLATFORM_CONCURRENCY`.
- new: [.env.example](.env.example) — documents new env vars + per-host recommended values.
- [HANDOFF.md](HANDOFF.md) — this entry + §7 I marked RESOLVED + §2/§3 updated.

**New env vars:**
| Var | Default | Where | Purpose |
|---|---|---|---|
| `SIDECAR_MAX_CONCURRENT_RENDERS` | `6` | Python sidecar | Hard cap on simultaneous `arun()`s against the single Chromium |
| `SEARCH_PLATFORM_CONCURRENCY` | `3` | Next route | Cap on platforms entering scrape phase at once |

Recommended per host (see [.env.example](.env.example)): local 8 GB MacBook = 6 renders / 3 platforms; small VPS = 4 / 2; medium VPS = 8 / 3; large box = 12+ / 4.

**Verified end-to-end:**

- ✅ `npx tsc --noEmit` clean.
- ✅ Python module imports + `main.py` parses + sidecar boots with `max_concurrent_renders=6` logged at startup.
- ✅ `GET /health` returns `crawler_alive: true`, `max_concurrent_renders: 6`.
- ✅ **Original failure repro:** `light grey hoodie` search with `color=grey, size=M, $10-$200` across all 8 platforms (excluded realreal). Completed in 3m28s, all 8 platforms returned `status: ok`, **62 listings total**, no driver death, `crawler_alive: true` post-search. (Compare to the pre-fix repro that crashed within 30s and returned ~0.)
- ✅ **Induced driver kill:** `pkill -9 -f playwright.*driver` mid-flight → next scrape detected death → background restart finished in **2.3s** → following scrapes succeeded.
- ✅ **Cache verification:** identical `/scrape` call twice — 9.1s → 9 ms; log shows `[cache] hit for <url>` on the second call.
- ✅ A single transient "Future exception was never retrieved: Connection closed while reading from the driver" appeared mid-search at 17:22 — the semaphore-throttled system absorbed it (subsequent eBay/Mercari scrapes immediately succeeded). This is the asyncio garbage-collection warning for an orphaned connection, NOT a fatal driver death (no `_driver_dead` flag flip, no log-storm).

**Open work in the load-management plan (deferred to PR 2 / PR 3 / further):**

- PR 2: crawler pool (`SIDECAR_BROWSER_POOL_SIZE`), per-domain pacing dict for Depop/Grailed/eBay, structured `[scrape] in_flight=N` log line.
- PR 3: eBay + Vestiaire JSON-LD structured extractors (the deferred half of `sleepy-wishing-snowflake.md`, cost win not load win).
- Far future: horizontal scaling (C2), Firecrawl plan upgrade (C3), paid unlocker for hardest sites (C4 — only if absolutely necessary).

**Gotchas worth remembering:**

- `crawler.close()` during auto-restart will itself raise on a dead pipe. The `except` in `_restart_crawler_once` is intentional — don't tighten it.
- The first request *after* a driver death is the one that detects + flips the flag, so it sees the dead pipe and returns its own normal failure (null result). Only subsequent requests get the 503 fast-fail.
- Driver-death recovery is ~2-3s, faster than expected — most users would never see a 503 unless they hit the sidecar mid-restart window.
- The cache survives induced driver death (in-memory dict, not tied to crawler lifecycle). Cached endpoints serve correctly even while the crawler is restarting.
- `response_model=ScrapeResponse` on the FastAPI decorator + sometimes returning a `JSONResponse(status_code=503, ...)` works because FastAPI prefers an explicit Response over the model serializer. Don't add `response_model_exclude_none` or similar; it would conflict.

---

**Previous change (2026-05-20 — Watchlist refresh progress bar + minor UI polish):**

Small batch of watchlist UX improvements:
- **Eye icon fix:** Watchlist tab cards were showing a crossed-out eye (eye-off SVG) on watched items. Replaced with a normal eye + filled pupil in red `var(--accent)` so the icon reads as "watched" instead of "hidden". ([WatchlistTab.tsx:379-380](app/components/profile/WatchlistTab.tsx#L379-L380))
- **Copy fix:** "checked just now" → "last refreshed just now" on each watch card. Also updated the `never checked` fallback in [WatchlistDemo.tsx](app/components/WatchlistDemo.tsx).
- **Refresh progress bar:** "Refresh prices" now streams progress. The endpoint [app/api/watchlist/refresh/route.ts](app/api/watchlist/refresh/route.ts) was converted from a single JSON response to **NDJSON streaming** — emits `{type:'start',total}`, `{type:'progress',completed}` per item, and `{type:'done',updated,failed,rows}`. UI shows a thin bar (`var(--accent)`) with `N/M refreshed` text that flips to **"All refreshed!"** in `var(--success)` on completion, auto-dismissing after 2s.

**Files touched (3):**
- [app/api/watchlist/refresh/route.ts](app/api/watchlist/refresh/route.ts) — NDJSON `ReadableStream`; concurrency=4 preserved; per-item Supabase update happens inside the worker so progress reflects DB-committed state.
- [app/components/profile/WatchlistTab.tsx](app/components/profile/WatchlistTab.tsx) — eye SVG swap; `last refreshed` copy; `handleRefresh` consumes NDJSON via `ReadableStreamDefaultReader`; new progress bar block above the cards.
- [app/components/WatchlistDemo.tsx](app/components/WatchlistDemo.tsx) — copy parity only.

**Gotchas:**
- Refresh endpoint is now a stream — any future caller must read `res.body` line-by-line, not `res.json()`. The toast logic still relies on the `done` event for final counts.
- The progress bar is gated on `refreshProgress` state; the "Last refreshed: …" timestamp line is hidden while the bar is visible to avoid double-info.
- User did not request manual browser verification — code-level only. Test before shipping.

---

**Previous change (2026-05-20 — Off-White brand vs "white" color disambiguation):**

User-reported issue: ticking the White color swatch caused Off-White brand listings (the streetwear label) to flood the results. Platforms' fuzzy text search treats "white" the same whether it's a color or part of a brand name.

**Fix:** post-filter listings by title when `filters.color === 'white'`, dropping anything matching `/off[-\s]?white/i`. Includes a query-mention guard — if the user's typed query itself contains "off-white", the post-filter is skipped (they clearly want the brand).

Four cases handled:
| White filter | "off-white" in query | Behavior |
|---|---|---|
| ✅ ON | ❌ no | Drop Off-White listings |
| ❌ OFF | ✅ yes | Inert — filter only runs when color=white |
| ✅ ON | ✅ yes | Skipped by query-mention guard, keep all |
| ❌ OFF | ❌ no | No-op |

**Files touched (2):**
- new: [lib/colorFilter.ts](lib/colorFilter.ts) — `matchListingColor(title, colorKey, query)` and `queryMentionsOffWhite(query)`. No-op for any color other than `'white'`.
- [app/api/search/route.ts](app/api/search/route.ts) — applies the filter in both branches of `searchAndScrape` (SEARCH_PAGE_PLATFORMS branch after the size filter, Firecrawl branch after `parseScrapedListings`).

**Verified:** 9/9 unit cases passed via tsx probe (clean white titles kept; Off-White / "off white" / "OffWhite" variants dropped; query-mention guard restores them; other colors no-op). Route compiles cleanly under `npm run dev:all`.

**Gotchas:**
- The regex `/off[-\s]?white/i` intentionally matches all three variants ("off-white", "off white", "offwhite"). Tested.
- This is a one-off for a single known collision — don't pre-build a generic brand-color collision table. If a second collision appears (e.g. brand "Red Wing" vs color red), generalize then.

---

**Previous change (2026-05-20 — ThredUp size accuracy fix via post-filter):**

User-reported issue: searching ThredUp for `"large"` (or selecting Size L in FilterPanel) returned XL / 2XL / "large print" items because ThredUp's onsite search is a fuzzy text match — there's no URL-level size filtering.

**Investigation (don't re-walk):**
- Firecrawl `site:thredup.com <query>` still returns **zero** individual `/product/<sku>` URLs (all category / search-grid hits). Same finding as 2026-05-18; the Firecrawl branch remains a dead end for ThredUp.
- Probed ThredUp's `/search/<slug>` URL with `?size=L`, `?size_tags=large`, etc. — every variant returned the **exact same 5 results** as the baseline. ThredUp ignores size params on the `/search/` endpoint. `?department_tags=women/men` is the only param that has any effect.
- ThredUp listing titles consistently embed the size (`... Size 7`, `... Size XL`), so regex on the title is reliable. No LLM needed.

**Fix:** post-filter ThredUp results by structured size key after extraction.
- **Frontend** ([SearchForm.tsx](app/components/SearchForm.tsx)) now sends the structured `filters` object in the POST body alongside the merged-query string (other platforms still get the text suffix appended — behavior unchanged).
- **Route** ([app/api/search/route.ts](app/api/search/route.ts)) accepts `filters` in the zod schema, passes it into `searchAndScrape`. For `SEARCH_PAGE_PLATFORMS` (ThredUp / RealReal), the route pulls **100** listings from the single ThredUp page (single HTTP request — the page already contains ~119 products in one JSON-LD blob, the limit just controls in-memory iteration; raising it is essentially free) and post-filters to a max of 10 by matching the embedded size against `filters.size`.
- **Typed-size fallback:** when `filters.size` is null but the raw query text contains a size word (e.g. user types `"nike shoes large"`), [lib/sizeFilter.ts](lib/sizeFilter.ts) → `detectSizeFromQuery()` extracts the size key. Same post-filter applies.
- **Regex anchored on "Size" prefix** so the L pattern does NOT match the L inside XL.

**Verified end-to-end:**
| Test | Before | After |
|---|---|---|
| `t-shirt` + Size L checkbox | mixed sizes | 5 results, all Size L |
| `t-shirt large` (typed) | XL/2XL noise | 5 results, all Size L |
| `large` (handoff repro from prior session) | mostly X-Large items | 1 result, Size L (correct — that's all of size L in the noisy "large" relevance ranking) |
| `nike` + shoe size m9 | n/a | 10/10 results, every one Size 9 |
| `t-shirt` (no filter) | mixed sizes | 10 mixed sizes (no regression) |

**Files touched (6):**
- new: [lib/filterOptions.ts](lib/filterOptions.ts) — extracted FilterState shape + COLOR/CATEGORY/CONDITION/SIZE option tables out of FilterPanel.tsx so server-side code can import without pulling React in. FilterPanel.tsx now re-exports for backward compat.
- new: [lib/sizeFilter.ts](lib/sizeFilter.ts) — `matchListingSize(title, sizeKey)` and `detectSizeFromQuery(query)`.
- [app/api/search/route.ts](app/api/search/route.ts) — `filters` in zod schema; `searchAndScrape` now takes filters; SEARCH_PAGE_PLATFORMS branch pulls 100 + post-filters to ≤10.
- [app/components/SearchForm.tsx](app/components/SearchForm.tsx) — adds `filters` to POST body.
- [app/components/FilterPanel.tsx](app/components/FilterPanel.tsx) — re-exports from `lib/filterOptions.ts`.
- (revert) [crawl4ai-service/main.py](crawl4ai-service/main.py) — removed temporary `url_override` field on `ScrapeSearchRequest` (used only during this session's URL-param probing).

**Gotchas to remember:**
- ThredUp's `/search/<slug>` URL ignores `size=`, `size_tags=`, `sizing_id=` — confirmed by probe, do not waste time wiring them up. Only `department_tags=women/men` works.
- The `limit` param on `/scrape-search` is an in-memory cap on JSON-LD iteration, **not** a network/HTTP cost. ThredUp returns ~119 products per fetch regardless. Raising the cap is essentially free.
- Word-boundary `\bL\b` alone is NOT safe for clothing-size L — it matches the L inside XL. Use `\bSize\s+L\b` to disambiguate.
- `detectSizeFromQuery` is intentionally ordering-sensitive: it checks `xxl` / `xx-large` / `2xl` before `xl`, and `extra large` before `large`, etc. Don't reorder the regex list.

---

**Previous change (2026-05-19 — Collections page UI redesign):**

Redesigned the My Collection (saves) tab with improved UX:
- **View mode toggle:** Replaced text button ("Pills"/"Cards") with icon-based sliding toggle. Left icon (three horizontal lines) = list view; right icon (grid boxes) = grid view. Active view highlighted with accent color.
- **Collection preview images:** Grid view now shows first 4 saved listing images as background previews (Spotify-style), semi-transparent, more visible on hover.
- **Two-level navigation in grid view:** Clicking a collection enters a full-page view of its items with back button. Collections themselves only show in the top-level grid.
- **Better discoverability:** "+ New collection" button moved to its own row below search/view toggle, always accessible without scrolling.
- **Improved legibility:** Description text enlarged from `text-xs` to `text-sm`. Collection title and description now visible when browsing items in grid view.
- **Terminology:** Changed all "folder" references to "collection" throughout (`SavesTab.tsx`).

**Files touched (1):**
- [app/components/profile/SavesTab.tsx](app/components/profile/SavesTab.tsx) — `ViewModeToggle`, `FolderCardGrid`, `FolderDescription`, navigation state (`cardViewFolderId`)

**What works:** All three tier-1 patterns (list pills, grid with previews, drill-down navigation) tested in browser. Folder creation modal still works from the new button position.

---

**Previous change (2026-05-19 — Repo cleanup pass; no behavioral changes):**

Cleaned up project cruft for clarity. No app/sidecar code touched.
- **Deleted redundant root-level cost docs:** `COST_ANALYSIS_SUMMARY.md` and `TOKEN_COST_ANALYSIS.md`. Their content was duplicated in `docs/engine_bakeoff_findings.md` (measured costs, per-platform verdicts) and `docs/FIRECRAWL_PRICING.md` (canonical credit prices). Cost story now lives in two files instead of four.
- **Removed gitignored disk weight:** `.claude/worktrees/` (1.2 MB of stale worktree copies), `crawl4ai-service/debug_dumps/` (15 MB of raw HTML), Python `__pycache__/` dirs, and `tsconfig.tsbuildinfo`. Freed ~16.5 MB.
- **Fixed dangling references** to the deleted MDs in `HANDOFF.md` §9, `docs/FIRECRAWL_PRICING.md`, `docs/engine_bakeoff_findings.md`, `scripts/README_TOKENS.md`, and `scripts/limit_sweep.py`.
- **Moved to `archive/`** (kept in repo for reference, not deleted): `python/` (pre-sidecar tests), `proxy.ts` (unused Supabase middleware — wrong filename, Next.js needs `middleware.ts`), `crawl4ai-service/debug_ebay.py` + `debug_probe.py`, and 8 legacy/one-shot scripts (`debug-platforms.mjs`, `test-scrape*.mjs`, `test-vestiaire.mjs`, `discover-thredup.mjs`, `diagnose-parallel.mjs`, `diagnose-scrape.mjs`, `measure_tokens.py`). Full inventory + reasons in [archive/README.md](archive/README.md). Active scripts (`diagnose-counts.mjs`, `diagnose-grailed.mjs`, `test-all-platforms.mjs`, current Python toolkit) stayed in `scripts/`.

**Latest change (2026-05-19 — Engine bake-off run; recommendation: stay on crawl4ai, bump limit 5 → 10):**

🎯 **Decision:** Stay on crawl4ai as primary scraper. Bump per-platform results from 5 → 10 in production. Don't switch any platform wholesale to Firecrawl. Optionally wire Firecrawl as a `/scrape` failover later (~$0.004/URL when triggered). Full analysis in [docs/engine_bakeoff_findings.md](docs/engine_bakeoff_findings.md).

### Bake-off results (72 URLs × 2 engines, 3 queries)

| Engine | Listing-URL accuracy | p50 ms | p95 ms | Cost / 72 URLs |
|---|---|---|---|---|
| crawl4ai | 34/36 listings correct (94%) | 11,226 | **90,047** | $0 + $0.098 OpenAI |
| firecrawl-basic | 30/36 listings correct (83%) | 3,205 | 6,134 | $0.288 Hobby / $0.071 Std |

**Apples-to-apples (real listing URLs only, ignoring category pages Firecrawl search returned by mistake):** crawl4ai matches or beats Firecrawl basic on every platform except StockX (N=4, marginal). Vinted is the most decisive — crawl4ai got 5/5 prices (correctly reading EUR/GBP via structured extractor), Firecrawl basic's $-regex got 1/5.

**Speed delta**: Firecrawl basic is 2–18× faster (2× on platforms with working structured extractors, 13–18× on grailed/poshmark/ebay where crawl4ai does LLM fallback + anti-bot retries). But faster ≠ better when accuracy degrades.

**Cost delta**: crawl4ai $0/scrape vs Firecrawl $0.004/scrape (Hobby). For ~40 URLs per full search (limit 5), that's $0.16 Hobby of new cost to gain speed but lose accuracy.

### Limit sweep results ("gucci bag")

| Limit | Listings | Wallclock | Cost (Hobby) | Verdict |
|---|---|---|---|---|
| 5  | 30  | 224 s | $0.10 | current production |
| **10** | **55** | 447 s | **$0.22** | **ship this** — 1.83× listings for 2.2× cost |
| 15 | **0** | 750 s | $0.39 | **broken** — sidecar/Playwright degraded under load, every scrape returned null |

**Limit 15 is a separate concurrency bug:** sidecar `/health` was green throughout but Playwright clearly couldn't keep up with ~15–20 concurrent renders. Filed as [§7 I](#i-sidecar-playwright-concurrency-degradation-at-load) below. Must be fixed before users can ever pick limit > 10.

### What surprised us

- **eBay isn't actually broken.** crawl4ai got 2/2 prices on real eBay `/itm/` URLs (and 5/9 overall, with the other 4 being category pages). [§7 A](#a-ebay--blocked-at-the-edge) says "every /scrape returns null" — that's stale. eBay's anti-bot is intermittent now, not constant. (p95 was 90s though, so it's still slow.)
- **Vestiaire is rock-solid on crawl4ai** — 7/7 listing URLs, accurate prices. Speed is the only weakness (22s avg vs Firecrawl 3s).
- **Firecrawl URL discovery returns ~37% non-listing junk** (category, brand hubs, news) on the queries we tested. Production's [filterListingUrls](lib/parse.ts) should be catching these — worth confirming the patterns cover eBay's `/b/` and StockX's `/brands/`. Audit recommended.

### Files touched (10 + bake-off artifacts)

- new: [docs/FIRECRAWL_PRICING.md](docs/FIRECRAWL_PRICING.md), [docs/engine_bakeoff_findings.md](docs/engine_bakeoff_findings.md), [scripts/engine_bakeoff.py](scripts/engine_bakeoff.py), [scripts/limit_sweep.py](scripts/limit_sweep.py), [scripts/bakeoff_fixture.json](scripts/bakeoff_fixture.json), [scripts/bakeoff_results.csv](scripts/bakeoff_results.csv), [scripts/limit_sweep_gucci_bag.json](scripts/limit_sweep_gucci_bag.json), [token_usage.jsonl](token_usage.jsonl)
- edited: [TOKEN_COST_ANALYSIS.md](TOKEN_COST_ANALYSIS.md), [scripts/token_cost_analysis.py](scripts/token_cost_analysis.py), [scripts/README_TOKENS.md](scripts/README_TOKENS.md), [crawl4ai-service/token_tracker.py](crawl4ai-service/token_tracker.py), [crawl4ai-service/main.py](crawl4ai-service/main.py)
- production code in `app/`, `lib/firecrawl.ts`, `lib/scraper.ts`, `app/api/search/route.ts`: **unchanged**.

### Pre-bake-off doc cleanup (this same session)

Before running the bake-off, fixed three places that had inflated Firecrawl cost math (`TOKEN_COST_ANALYSIS.md` claimed $0.44/search; reality is $0.13 Hobby / $0.04 Standard). The previous version attributed per-URL scrape credits to Firecrawl when Firecrawl is only doing `search()`. New canonical pricing reference at [docs/FIRECRAWL_PRICING.md](docs/FIRECRAWL_PRICING.md); see §9 below.

Also wired up real OpenAI token tracking, gated behind `TOKEN_TRACKING=1` so production is unaffected by default. [crawl4ai-service/token_tracker.py](crawl4ai-service/token_tracker.py) reads `LLMExtractionStrategy.total_usage` (which crawl4ai populates per LLM call) — no litellm patching needed.

### What's next (top-priority follow-ups, see §7 I and §12)

1. **Ship limit = 10** in production — one-line change at [app/api/search/route.ts:57](app/api/search/route.ts#L57). Biggest single user-visible upgrade in the bake-off data.
2. **Investigate sidecar/Playwright concurrency** so limit 15 doesn't catastrophically break. Likely fix is a larger Playwright pool or per-platform queues.
3. **Audit `filterListingUrls`** — bake-off fixture had 37% non-listing junk, suggests the filter may have gaps.
4. **Optional: Firecrawl as failover.** Only fires when crawl4ai's `/scrape` returns null after retries; ~$0.004/URL when triggered. Separate plan.

---

**Previous change (2026-05-19 — Filter isolation + search cancellation):**

✅ **Two UX fixes shipped:**
1. **Filters no longer retroactively apply to completed search results.** When a search finishes and results are displayed, changing price/condition/size filters only affects *new* searches. The filters used for the current results are frozen at search-completion time (`searchFilters` state in `SearchSection`). This prevents confusing behavior where users could change filters after a search and see the old results retroactively filtered.

2. **Added search cancellation.** While a search is in progress, a red "Cancel" button appears in the `SearchProgress` component (top-right, next to the "X / Total platforms" counter). Clicking Cancel aborts the fetch via `AbortController`. The main "Searching…" button shows progress and remains disabled while the cancel runs in parallel.

**Technical details:**
- `SearchSection` now holds `abortControllerRef` and passes it to `SearchForm`
- `SearchForm` stores the AbortController before fetching, passes signal to fetch
- `SearchSection` also passes `handleCancel()` to `SearchProgress` for the button
- `SearchProgress` accepts optional `onCancel` prop, shows button only while `isSearching && onCancel`
- Both fixes tested in browser (no automated test suite)

**Platform ordering:** ThredUp moved in the platform list from position 9 to position 6 (after Vinted, before eBay) for better visual grouping of "growing resale platforms".

**Files touched (3):**
- [app/components/SearchSection.tsx](app/components/SearchSection.tsx) — holds abort controller, captures filters at search-complete, passes handlers down
- [app/components/SearchForm.tsx](app/components/SearchForm.tsx) — accepts abort controller ref, uses it for fetch signal
- [app/components/SearchProgress.tsx](app/components/SearchProgress.tsx) — displays cancel button when searching
- [lib/types.ts](lib/types.ts) — reordered PLATFORM_DOMAINS and PLATFORM_NAMES

---

**Previous change (2026-05-19 — The RealReal: scaffolding shipped, runtime deferred):**

❌ **The RealReal is not live.** PerimeterX (TRR's anti-bot service, distinct from Cloudflare) shows a press-and-hold challenge on every `/products?keywords=` nav even with crawl4ai's `UndetectedAdapter` + a managed-browser profile holding fresh login cookies. The user pre-decided in this session's plan: if the in-house path fails, defer & document (no FlareSolverr / Apify per cost rules). TRR now joins eBay + Vestiaire in §6 as deferred.

**Scaffolding shipped (gated, ready for future re-enable):**

1. **Extractor proven offline.** A one-off probe (`probe_therealreal.py`, deleted at end of session) using `UndetectedAdapter` + `~/.crawl4ai/profiles/therealreal/` got 2 MB of real `/products?keywords=gucci%20bag` HTML on the *first* probe run with `headless=False`. From that capture, `extract_therealreal_grid()` in [crawl4ai-service/search_page_extractors.py](crawl4ai-service/search_page_extractors.py) parses `__NEXT_DATA__.props.pageProps.serverResult.data.products.edges` (a Relay GraphQL response embedded in SSR) and produces clean `ScrapedListing` dicts with: `url`, `name`, `price.final.usdCents/100`, `images[0].url`, `availability` → `isSold`. Verified end-to-end against the saved HTML: 5 of 5 Gucci bags parsed, prices $316–$2696, correct image URLs. **The extractor works — the access wall is the blocker, not the data shape.**

2. **Sidecar dispatch wired but gated.** [crawl4ai-service/main.py](crawl4ai-service/main.py) gains:
   - `_platform_crawlers: dict[str, AsyncWebCrawler]` registry for platform-specific crawler instances.
   - `_ensure_realreal_crawler()` — lazily builds a second AsyncWebCrawler with `use_managed_browser=True`, `user_data_dir=~/.crawl4ai/profiles/therealreal`, `enable_stealth=False`, and `UndetectedAdapter()` (the correct PX-grade upgrade — `playwright-stealth` lost active maintenance in 2025 and PX detects most of its evasions).
   - `_warmup_realreal()` — pre-nav to `therealreal.com/` to mint `_px*` cookies before the PX-guarded `/products?keywords=` URL. Tracked in `_platform_warmed: set[str]` so warmup runs once per crawler lifetime.
   - `_build_run_cfg`: TRR-specific overrides `page_timeout=90_000`, `delay_before_return_html=20.0` (long enough for the user to interact with a visible press-and-hold window).
   - `lifespan()` cleanup loop closes every per-platform crawler on shutdown.
   - `/scrape-search` for `realreal` is **gated on `os.environ.get("REALREAL_ENABLED")`**. Without the env var, the endpoint returns `{"results":[]}` in 11 ms and logs `[realreal] search skipped — deferred (set REALREAL_ENABLED=1 to retry)`. No Chromium boot, no wasted Firecrawl credits. With `REALREAL_ENABLED=1` set, the full flow runs (and currently fails on PX challenge — see "What didn't work").
   - Empty-result debug-dump path: when TRR is enabled and returns 0 listings, the response HTML is saved to `debug_dumps/realreal-last-empty.html` for inspection. Stays in code for the next attempt.

3. **Next.js wiring (no gating).** TRR appears in the UI as `The RealReal` (black `#000000` brand color, white text). Users can opt in via the FilterPanel checkbox. With the gate off, searching TRR returns 0 listings cleanly (same as eBay/Vestiaire behave today).
   - [lib/types.ts](lib/types.ts): `realreal: 'therealreal.com'` in `PLATFORM_DOMAINS`, `realreal: 'The RealReal'` in `PLATFORM_NAMES`.
   - [lib/scraper.ts](lib/scraper.ts): `'realreal'` added to `SEARCH_PAGE_PLATFORMS` so the orchestrator routes to `/scrape-search` (NOT through Firecrawl) — avoids wasting search credits on a site Firecrawl probably can't index anyway.
   - [app/components/platformColors.ts](app/components/platformColors.ts): `realreal: '#000000'` in `PLATFORM_BG`.
   - **Not** in `DEFAULT_PLATFORMS` ([app/components/SearchForm.tsx:17](app/components/SearchForm.tsx#L17)) — opt-in only, same precedent as ThredUp.

**What didn't work (kept here so future sessions don't re-walk it):**

| Approach | Result |
|---|---|
| crawl4ai default `enable_stealth=True` + random UA, no profile | PX block immediate (`/products` → 9 KB `px-captcha` page) |
| crawl4ai `UndetectedAdapter` + managed profile `~/.crawl4ai/profiles/therealreal/` (cookies from manual login) | Probe's *first* run got real content (2 MB, 120 Gucci links). Every subsequent run, including via the sidecar, returns the 9 KB PX captcha page regardless of warmup, profile, or 20s delay |
| Pre-nav warmup to `therealreal.com/` (homepage) to mint PX cookies before `/products?keywords=` | Warmup itself returns PX captcha. PX is not just URL-gated on the search endpoint — it gates the homepage too on the second-or-later session |
| `delay_before_return_html=20.0` to give the user time to manually press-and-hold | User confirmed: the press-and-hold challenge appears on every nav even with the visible Chromium window. PX is not auto-resolving via mouse-movement heuristics here |
| Headless vs visible Chromium | No observable difference — `headless=False` was used throughout |

**URL discoveries (preserved for future re-enable):**

- `https://www.therealreal.com/shop/all?keywords=<query>` — works (~2 MB JSON-LD-free real content) **but silently ignores `?keywords=`**. `variables.where.buckets.taxonsPermalink: ['all']` — server uses internal taxon IDs, not query strings. **Not** the search URL.
- `https://www.therealreal.com/search?keywords=<query>` — 404.
- `https://www.therealreal.com/products?keywords=<query>` — **correct search URL** (user-confirmed). Returns `__NEXT_DATA__.props.pageProps.serverResult.data.products.edges` with 120 listings/page, fully filtered by keyword. Blocked by PerimeterX on every automated nav we've tried so far.

**Re-enable checklist (when toolkit improves or you choose to pay for an unblocker):**

1. Set `REALREAL_ENABLED=1` in `.env`.
2. Run `crwl profiles create therealreal` to refresh the managed profile, log in interactively, press `q`.
3. Restart sidecar — first TRR `/scrape-search` will boot the dedicated Chromium and may pop a press-and-hold; solve once if it appears.
4. Curl: `curl -X POST http://localhost:8000/scrape-search -d '{"platform":"realreal","query":"gucci bag","limit":5}'`. On success, expect 5 listings parsed from `__NEXT_DATA__`. On failure, inspect `debug_dumps/realreal-last-empty.html`.
5. The extractor + URL builder + types/colors are already in place — no code changes needed beyond the env var.

**Verified this session:**
- Sidecar with `REALREAL_ENABLED` unset: `realreal` query returns `{"results":[]}` in 11 ms, no Chromium boot, log says `[realreal] search skipped — deferred`.
- ThredUp still works: `nike air jordan 1` query → 3 valid listings in 8.4 s (regression check passed).
- `npx tsc --noEmit` clean across all `lib/`/`app/` changes.

**NOT verified this session:**
- Browser UI rendering of the empty TRR tab with the new black badge (no `npm run dev:all` run during the verification phase). Recommend visually confirming on next session: opt-in TRR via FilterPanel, search any query, confirm the TRR tab shows an empty state without errors and the badge is black.

**Files touched (5 edits + 1 new):**
- new: [crawl4ai-service/search_page_extractors.py](crawl4ai-service/search_page_extractors.py) — added `therealreal_search_url`, `extract_therealreal_grid`, `realreal` in `SEARCH_PAGE_PLATFORMS`/`search_url_for`/`extract_search_grid`
- edited: [crawl4ai-service/main.py](crawl4ai-service/main.py), [lib/types.ts](lib/types.ts), [lib/scraper.ts](lib/scraper.ts), [app/components/platformColors.ts](app/components/platformColors.ts)
- temp file deleted at session end: `crawl4ai-service/probe_therealreal.py` (one-off probe)
- new managed profile (gitignored, on disk): `~/.crawl4ai/profiles/therealreal/` (kept for the re-enable path)

**What's next:**

Roadmap item TRR is **deferred indefinitely**. Realistic re-enable paths in cost order:
1. Cookie-injection from a real-Chrome session (free, brittle, weekly maintenance — user declined this session).
2. GraphQL direct call to TRR's internal endpoint (PX likely also guards the API, ~30 min spike).
3. Third-party anti-bot unlocker (ScrapingBee, ZenRows, Bright Data Web Unlocker — $30–100/mo; user has ruled out paid options for now).
4. Apify `therealreal-com-scraper` actor ($5/mo free tier — user has ruled out this session).
5. Wait for crawl4ai to ship a stronger PerimeterX bypass in a future version.

---

**Previous change (2026-05-18 — ThredUp added via search-page extraction):**

✅ **ThredUp is the 9th platform.** Search → results work end-to-end against live ThredUp pages. Verified manually via `curl POST /scrape-search` against the running sidecar with queries "nike air jordan 1" (5 listings: $41–$72) and "levis 501 jeans" (3 listings: ~$16–$18). All listings include URL, title, sale price (USD), image, condition ("Used"), sold flag.

**Architectural divergence — read this before searching the codebase!**

ThredUp uses a different pipeline than the existing 8 platforms because individual listing URLs aren't surfaced by Firecrawl's `site:thredup.com` search — only category/search-result pages come back (verified 2026-05-18 across two queries; zero `/product/...` URLs returned). The existing `searchPlatform → filter → for-each scrape` flow can't work.

Solution: bypass Firecrawl for ThredUp, render ThredUp's onsite search page once, and pull a grid of listings from a single render.

**What was built:**

1. **[crawl4ai-service/search_page_extractors.py](crawl4ai-service/search_page_extractors.py)** — new file (mirrors `structured_extractors.py` pattern). Exports `SEARCH_PAGE_PLATFORMS = {"thredup"}`, `search_url_for(platform, query)` (builds `https://www.thredup.com/search/<hyphen-slug>`), and `extract_thredup_grid(html, limit)`. The extractor reads a single `<script type="application/ld+json">` containing an **array of 119 `@type=Product`** objects per page, then merges with a SKU→href map built from DOM `<a data-inp-label="link-item-card" href="/product/<slug>/<sku>?...">` anchors. JSON-LD has no `url` field, so the DOM merge is required.

2. **[crawl4ai-service/main.py](crawl4ai-service/main.py)** — new `POST /scrape-search` endpoint. Body `{platform, query, limit}` → renders the platform's onsite search URL (built by `search_url_for`), dispatches to `extract_search_grid`, returns `{results: ScrapedListing[]}` (each item already includes `url`).

3. **[lib/scraper.ts](lib/scraper.ts)** — added `SEARCH_PAGE_PLATFORMS = new Set(['thredup'])` and `scrapeSearchPageViaSidecar(platform, query, limit)` (POST to `/scrape-search`). 2 retries (vs `/scrape`'s 3) since this is a single high-value render.

4. **[app/api/search/route.ts](app/api/search/route.ts)** — `searchAndScrape()` now branches at the top: if `SEARCH_PAGE_PLATFORMS.has(platform)`, it calls `scrapeSearchPageViaSidecar(platform, query, 12)` and pipes the result straight into `parseScrapedListings` (skipping Firecrawl entirely). Everything else (concurrency, sold-filter, title-overlap) reuses the existing path so the existing 8 platforms are untouched.

5. **[lib/types.ts](lib/types.ts)** — `thredup: 'thredup.com'` in `PLATFORM_DOMAINS`, `thredup: 'ThredUp'` in `PLATFORM_NAMES`. ThredUp now appears in the FilterPanel platform checklist automatically (driven by `Object.keys(PLATFORM_DOMAINS)`).

6. **[app/components/platformColors.ts](app/components/platformColors.ts)** — `thredup: '#0F3D2E'` (their primary brand green). Uses the same solid-background + white-text path as Grailed/Depop/etc.

**Why JSON-LD as the source:** ThredUp's search page emits Schema.org `Product` array with all the fields we need (`name`, `sku`, `image[0]`, `offers.price` for sale price, `offers.priceCurrency`, `offers.itemCondition`, `offers.availability`). Title strings contain HTML entities (e.g. `Men&apos;s`), so the extractor calls `html.unescape()`. Sale price is `offers.price` — the original/list price (`offers.priceSpecification.price`) is intentionally ignored to match how the UI treats other platforms' "current sale price" semantics.

**Sold filtering:** `offers.availability` can be `InStock` or `SoldOut`. Sold items get `isSold=true` and are dropped by the existing `parseScrapedListings` filter — same behavior as every other platform.

**Critical gotchas / decisions:**
- **DO NOT add ThredUp to `DEFAULT_PLATFORMS`** in [app/components/SearchForm.tsx:17](app/components/SearchForm.tsx#L17). That set is intentionally limited to known-reliable platforms; ThredUp is just-shipped and hasn't been beaten on long enough to earn a slot. Users can opt in via the platform checkboxes.
- **Don't try to use `/scrape` for ThredUp** — `PLATFORM_EXTRACTORS` doesn't include `thredup`, so `/scrape` would fall through to LLM extraction on a single listing page, which has different DOM than the search page anyway.
- **The search URL slug is just lowercase + spaces→hyphens.** No URL-encoding of accents/spaces beyond what `urllib.parse.quote(s, safe='-')` does. Verified against two query shapes.
- **`SEARCH_PAGE_PLATFORMS` is duplicated** in TS ([lib/scraper.ts](lib/scraper.ts)) and Python ([crawl4ai-service/search_page_extractors.py](crawl4ai-service/search_page_extractors.py)). When adding another search-page platform (e.g. Vestiaire if we ever solve its discovery gap, or RealReal if it has the same issue), update both.

**Verified end-to-end (live, 2026-05-18 PM, against running sidecar):**
- `npx tsc --noEmit` — clean.
- `curl POST /health` — `llm_mode: active`, `provider: openai/gpt-4o-mini`.
- `curl POST /scrape-search {platform: thredup, query: "nike air jordan 1", limit: 5}` — 5 listings, all valid, all USD, all with absolute `/product/<slug>/<sku>` URLs, retina images, "Used" condition.
- `curl POST /scrape-search {platform: thredup, query: "levis 501 jeans", limit: 3}` — 3 Levi's listings, prices $15.99–$18.49.

**NOT yet verified (recommended for next session):**
- Browser UI: search with `thredup` checked, confirm tab appears with results, click a listing → opens the right product page in a new tab, heart + eye buttons work, ThredUp green badge renders.
- Save/Watchlist behavior with ThredUp listings (URL + cached snapshot should persist cleanly).
- Mixed-platform searches (thredup + grailed + depop) — verify the per-platform concurrency cap (`Promise.all` over platforms, no inter-platform contention) still behaves.

**Files touched (5):**
- new: [crawl4ai-service/search_page_extractors.py](crawl4ai-service/search_page_extractors.py)
- new (helper, not committed): [scripts/discover-thredup.mjs](scripts/discover-thredup.mjs) — one-off Firecrawl probe; safe to delete
- edited: [crawl4ai-service/main.py](crawl4ai-service/main.py), [lib/scraper.ts](lib/scraper.ts), [app/api/search/route.ts](app/api/search/route.ts), [lib/types.ts](lib/types.ts), [app/components/platformColors.ts](app/components/platformColors.ts)

**What's next (per §12 roadmap):** The RealReal is the other roadmap-listed platform. Before starting, **probe Firecrawl's `site:therealreal.com` index** — RealReal may also have the URL-discovery problem (their site is heavily JS-rendered). If yes, reuse this `SEARCH_PAGE_PLATFORMS` infrastructure. If individual `/listings/<id>` URLs ARE indexed, use the existing single-listing pipeline.

---

**Previous change (2026-05-18 — Collection folders final refinements):**

Two UI polish changes on the Collection (Saves) feature:
1. **Toast action label:** When user saves a listing and clicks the toast's "Add to folder…" action button, the success toast now says "Added to <folder>" (instead of "Moved to"). The modal tracks `fromToastAction: boolean` to pick the right verb — saves from the toast action use "Added to", while moves via the 3-dot menu use "Moved to".
2. **Tab title:** Renamed the profile tab from "Collection" → "Collections" (plural) to better reflect the folder-based organization.

No backend changes; UI-only refinements to tone and labeling.

---

**Previous change (2026-05-18 — Collection folders, round 2):**

Iteration on the folders feature based on user testing:
1. **My Collection is now an "All items" view** — every save shows here regardless of `folder_id`. Previously, moving an item into a custom folder removed it from My Collection (because the GET filter was strict). New behavior: when `?folder_id=<defaultFolderId>`, the GET endpoint applies no folder filter at all. Custom folders still filter strictly by `folder_id`.
2. **Folder descriptions.** `collection_folders.description text` column added (user ran the migration). `ensureDefaultFolder` now seeds the description "Your main collection. Everything saved goes here by default." for new users. UI displays the active folder's description below the pill row.
3. **Modal-based folder UX.** Inline rename/new inputs replaced by `FolderEditModal` (name + description, autosized textarea, 280-char cap on description) and `FolderDeleteModal` (two-option: "Delete folder, keep items" primary / "Delete folder and items permanently" destructive secondary). My Collection's name is locked in the edit modal; description is editable.
4. **Cascade delete.** `DELETE /api/collection-folders/[id]?cascade=true` deletes the folder AND every save inside it. Default behavior (no query param) keeps items — they orphan to `folder_id = null` and continue to render under My Collection (since My Collection now shows everything regardless of folder_id anyway).
5. **POST `/api/saves` returns `folder_id`** so the toast's "Move to folder…" picker can pre-disable the current folder with an "Already here" indicator.
6. **Modal/popover surfaces** switched from `var(--surface)` (which is `rgba(255,255,255,0.04)` in dark — basically transparent) to `var(--bg-elevated)` so they're opaque against image cards.
7. **Empty-state copy** rewritten without emojis: "Nothing in your collection yet. Heart listings to add them."

**⚠ Still TODO (user must run in Supabase):** if `/api/saves/[id]` PATCH 500s on move-to-folder, the `saves` table is missing UPDATE permissions. Fix:
```sql
grant update on public.saves to authenticated;
create policy "saves_update" on public.saves for update using (auth.uid() = user_id);
```

---

**Previous change (2026-05-18 — Collection folders, initial ship):**

✅ **Saves feature is now "Collection" in the UI, with folders.** The user-facing word everywhere is "Collection"; **the code/table/route stay `saves` / `SavesProvider` / `/api/saves` deliberately** to avoid churn. Each saved item belongs to exactly one folder. A default "My Collection" folder is seeded lazily on first save (no auth-flow change). Heart button still defaults to My Collection — frictionless — but the success toast now offers a "Move to folder…" action.

> **Naming caveat (read this before searching!):** the table is `saves`, the provider is `SavesProvider`, the API is `/api/saves`, the type is `Save`. In the UI, all of this is rendered as "Collection". Only UI strings were renamed.

**What was built:**

1. **`collection_folders` table in Supabase** (user already ran the migration). Schema:
   ```sql
   create table public.collection_folders (
     id uuid primary key default gen_random_uuid(),
     user_id uuid not null references auth.users(id) on delete cascade,
     name text not null,
     is_default boolean not null default false,
     created_at timestamptz not null default now()
   );
   create unique index collection_folders_one_default_per_user
     on public.collection_folders (user_id) where is_default = true;
   alter table public.saves add column folder_id uuid
     references public.collection_folders(id) on delete set null;
   ```
   RLS + `grant select, insert, update, delete on public.collection_folders to authenticated`. `folder_id` is nullable; **null is treated as "belongs to My Collection"** (covers legacy rows and items orphaned by folder delete). `on delete set null` handles folder deletion — no explicit reassignment.

2. **API surface:**
   - [app/api/collection-folders/route.ts](app/api/collection-folders/route.ts) — `GET` (lists folders with `item_count`, calls `ensureDefaultFolder` so default exists for any logged-in user), `POST {name}` (create custom folder, rejects `is_default` from client).
   - [app/api/collection-folders/[id]/route.ts](app/api/collection-folders/[id]/route.ts) — `PATCH {name}` (rename; 403 if `is_default`), `DELETE` (403 if `is_default`).
   - [app/api/saves/route.ts](app/api/saves/route.ts) — `POST` now seeds default folder via `ensureDefaultFolder` and accepts optional `folder_id`. `GET` accepts `?folder_id=` and uses a PostgREST `or=folder_id.eq.<id>,folder_id.is.null` filter when the requested folder is the user's default, so legacy null rows render under My Collection.
   - [app/api/saves/[id]/route.ts](app/api/saves/[id]/route.ts) — new `PATCH {folder_id}` for move-to-folder (validates target folder belongs to user).
   - [lib/collectionFolders.ts](lib/collectionFolders.ts) — shared `ensureDefaultFolder(supabase, userId)` helper. Idempotent (handles `23505` race).

3. **Client provider** ([app/components/SavesProvider.tsx](app/components/SavesProvider.tsx)) — exposes new `openMoveModal({ saveId, currentFolderId, onMoved? })`. Renders [app/components/MoveToFolderModal.tsx](app/components/MoveToFolderModal.tsx) globally. After a save, the success toast offers an "Action: Move to folder…" button that opens the same modal pre-targeted at the just-created `save_id` (captured from POST response).

4. **Collection UI** ([app/components/profile/SavesTab.tsx](app/components/profile/SavesTab.tsx)) — full rewrite:
   - Price block stripped from cards entirely (we still store it; we just don't surface it). Cards now show: image, platform badge, title, condition, "saved {date}".
   - **Folder pill row** above the grid: My Collection first (is_default desc, created_at asc), then custom folders, then a `+ New folder` pill. Active pill filters the grid via `?folder_id=`. Each custom pill has a `⋯` menu → Rename / Delete (My Collection's `⋯` is hidden — server also enforces).
   - **3-dot menu on each card** (top-left, mirrors the heart's positioning): "Move to folder…" opens the global modal; "Remove" runs the existing optimistic-remove path.
   - **View-mode toggle** persists in `localStorage.collectionViewMode` (`'pills'` default, `'cards'` for the alt layout — currently a minimal folder-card grid as the plan called for; styling/preview thumbnails are follow-up).
   - **Empty-state copy** branches by scope: zero total saves → existing copy; default folder empty but others have items → "My Collection is empty…"; custom folder empty → "No items in {folderName} yet…".

**Verification (manual):**
- `npx tsc --noEmit` clean.
- *Browser verification still TODO — recommend testing per the plan checklist before declaring fully done.* The dev server was not started in this session.

**Gotchas / decisions worth remembering:**
- Heart-click never opens a folder picker; users move via the 3-dot menu or the toast action. Deliberately frictionless.
- `is_default` boolean (not name-matching) protects "My Collection" from rename/delete. Server enforces; UI hides the menu.
- Folder delete uses `ON DELETE SET NULL` on `saves.folder_id` — no explicit `UPDATE saves SET folder_id = <default>` needed because nulls already render under My Collection.

**What's next (deferred):**
- Cards view styling + preview thumbnails (current implementation is a skeleton).
- Drag-and-drop card → pill (out of scope, considered).
- Folder reordering (drag-sort pills).

---

**Previous change (2026-05-18 — Phase 2C Watchlist with manual refresh):**

✅ **Watchlist (eye icon) is live alongside Saves (heart icon).** Two independent features per the user's decision this session: a listing can be saved, watched, both, or neither. Manual "Refresh prices" button re-scrapes all rows via the existing sidecar; auto-refresh-on-login and email alerts (Phase 2D) deferred.

**What was built:**

1. **`watchlist` table in Supabase** (user ran the migration in SQL editor). Schema:
   ```sql
   create table public.watchlist (
     id uuid primary key default gen_random_uuid(),
     user_id uuid not null references auth.users(id) on delete cascade,
     listing_url text not null,
     platform text not null,
     title text not null,
     price_at_add numeric,
     price_current numeric,
     currency text not null default 'USD',
     image_url text,
     is_sold boolean not null default false,
     last_checked_at timestamptz,
     created_at timestamptz not null default now(),
     unique (user_id, listing_url)
   );
   create index watchlist_user_recent_idx on public.watchlist (user_id, created_at desc);
   ```
   RLS: select/insert/update/delete WHERE `auth.uid() = user_id`. Plus the now-standard `grant select, insert, update, delete on public.watchlist to authenticated` (HANDOFF §11 #26 still applies — must grant or you get `42501`).

2. **API routes (mirror saves pattern):**
   - [app/api/watchlist/route.ts](app/api/watchlist/route.ts) — `POST` (add; on `23505` returns existing id w/ `already_watched: true`), `GET` (list w/ `?search=&platform=`), `DELETE` (`?url=` for toggle).
   - [app/api/watchlist/[id]/route.ts](app/api/watchlist/[id]/route.ts) — `DELETE` by id (WatchlistTab remove).
   - [app/api/watchlist/check/route.ts](app/api/watchlist/check/route.ts) — `POST {urls}` → `{watched_urls}` for hydration.
   - [app/api/watchlist/refresh/route.ts](app/api/watchlist/refresh/route.ts) — `POST` (no body). Calls `scrapeViaSidecar(url, platform)` from `lib/scraper.ts` with **concurrency 4** (custom worker pool, NOT unbounded `Promise.all` — avoid hammering the sidecar/Firecrawl path). For each row: success → update `price_current`, `is_sold`, `last_checked_at`. Failure → bump `last_checked_at` only, leave price/sold flag alone (URL may be transiently bot-blocked; don't flip `is_sold` on null). Returns `{updated, failed, rows}` so UI can replace state in one round-trip.

3. **Client provider:** [app/components/WatchlistProvider.tsx](app/components/WatchlistProvider.tsx) is a near-direct copy of SavesProvider. Exposes `{ watchedUrls, isWatched, toggleWatch, hydrateUrls, refresh }`. Toasts: green `toast.success('Added to Watchlist')` on add; red-X variant for remove (HANDOFF §11 #28 — don't use `toast.error` for non-error tones). Mounted **inside** SavesProvider in [app/(protected)/layout.tsx](app/(protected)/layout.tsx).

4. **Eye icon on `ListingCard`** ([app/components/ListingCard.tsx](app/components/ListingCard.tsx)) — positioned at `right: 0.5rem, top: 3rem` (just below the heart). Same hover-only visibility rule (`opacity: watched || hovered ? 1 : 0`). Hidden when signed out. SVG fills with `var(--accent)` when watched.

5. **Hydration in search results:** [app/components/ResultsDisplay.tsx](app/components/ResultsDisplay.tsx) now calls **both** `useSaves().hydrateUrls(urls)` AND `useWatchlist().hydrateUrls(urls)` in one effect, so heart + eye both render their correct filled state on initial paint without N round-trips.

6. **WatchlistTab UI** ([app/components/profile/WatchlistTab.tsx](app/components/profile/WatchlistTab.tsx) — replaced the placeholder). Mirrors SavesTab (debounced search, optimistic remove, empty state) plus:
   - Header row: search input + **"Refresh prices"** button (accent-colored, spinner on click, disabled while in-flight or when watchlist is empty).
   - "Last refreshed: {relativeTime(newestChecked)}" line below the header.
   - WatchCard renders price block with a **delta chip** when `price_current !== price_at_add`: `▼ -$X (-Y%)` in `var(--success)` for drops, `▲ +$X (+Y%)` in `var(--text-muted)` for rises. Hidden when flat.
   - **"Sold" badge** overlays the image when `is_sold` is true (top-left, dark pill).
   - Footer line: platform · "watching since {date}" · "checked {relativeTime(last_checked_at)}" when present.
   - Remove button is an eye-with-slash icon variant.

**Decisions confirmed this session:**
- Two separate features (not a flag on Save).
- Manual refresh first; defer auto-refresh-on-login and cron-driven alerts to Phase 2D.
- Eye visible on hover only, mirrors heart.
- Schema as proposed in HANDOFF §12 (with `currency` added).

**Verified end-to-end in browser by user:**
- `tsc --noEmit` clean.
- Adding to watchlist works seamlessly (eye toggle on `ListingCard`, hydration on reload, toasts correct).
- **NOT yet verified by user:** "Refresh prices" button flow + price delta chip + Sold badge rendering. Recommended next session.

**Anti-bot regression observed during this session's testing (NEW, surface-level concern):**

During a single "fear of god essentials hoodie" search this session, the sidecar logged multiple `Blocked by anti-bot protection: HTTP 403 with HTML content` failures on **Depop** and **Grailed** URLs — platforms that have been reliable for weeks. Specific failures (paths shortened):
- `depop.com/products/therealduntdadun-…`, `bird1381-…`, `incogar-…` → all 403, response body 23949 bytes (consistent Depop block page).
- `grailed.com/listings/73684073-…`, `75493584-…`, `77960479-…` → all 403, response body 4265 bytes (consistent Grailed block page).
- Structured tier failed → LLM fallback also returned `[llm] no extracted content` for the same URLs (since the HTML it sees is the block page, not the listing).
- Other URLs from the same query (other Depop / Grailed listings, all Poshmark URLs) scraped fine in the same run. So it's per-URL rate limiting / cookie-state, not a wholesale block.

Hypotheses (un-investigated):
1. **Concurrency or cadence regression** — we're hitting the same domain too fast for some subset of URLs. The successful URLs finished first; the later/duplicate-pattern URLs got 403'd. Possibly related to our search loop's per-platform concurrency.
2. **Stealth / fingerprint drift** — Depop/Grailed tightened their bot checks; our `enable_stealth=True` + random UA isn't enough for ~30% of requests.
3. **The same URL retried twice in one search** (LLM fallback re-fetches), doubling exposure. Logs show this clearly: `incogar-…` is fetched once and 403s, then re-fetched moments later via the LLM fallback tier and 403s again.

**Recommended investigation when picking back up:**
- Check whether Depop+Grailed 403s correlate with the rapid LLM-fallback re-fetch (structured-tier 403 → immediately re-tries via LLM with the same blocked URL).
- Consider a short backoff (5–10s) before LLM fallback when structured tier failed with a 403 specifically, so the second attempt has a fresh fingerprint window.
- ~~Confirm the watchlist `/refresh` endpoint will hit the same wall under concurrency 4 — may need to lower further or stagger.~~ **RESOLVED 2026-05-20** — see top "Latest change" entry. Tier 2/3 already gated; Tier 1 now goes through B2 per-domain pacing + a global httpx semaphore; Next-route concurrency is now env-driven (`WATCHLIST_REFRESH_CONCURRENCY`).

Added to §7 as a new open problem (F).

---

✅ **Saves (liked listings) feature is fully working** + a dedicated `/profile` page with editable display name, bio, and avatar upload. A separate `/settings` placeholder page also exists. Phase 2B from §12 is done; Watchlist (Phase 2C) is next.

**What was built:**

1. **`saves` table in Supabase** — created with RLS policies and `authenticated`-role grants. Schema:
   ```sql
   create table public.saves (
     id uuid primary key default gen_random_uuid(),
     user_id uuid not null references auth.users(id) on delete cascade,
     listing_url text not null,
     platform text not null,
     title text not null,
     price numeric,
     currency text not null default 'USD',
     condition text,
     image_url text,
     seller text,
     saved_at timestamptz not null default now(),
     unique (user_id, listing_url)
   );
   create index saves_user_recent_idx on public.saves (user_id, saved_at desc);
   create index saves_user_platform_idx on public.saves (user_id, platform);
   ```
   RLS policies: `select/insert/delete using auth.uid() = user_id` (no UPDATE policy — saves are immutable snapshots).

2. **`profiles.bio TEXT` column added** to `public.profiles`. UPDATE granted to `authenticated`.

3. **`avatars` Supabase Storage bucket** — public, 2 MB cap, allowed types `image/png,image/jpeg,image/webp`. 4 storage RLS policies: public SELECT; INSERT/UPDATE/DELETE scoped to `(storage.foldername(name))[1] = auth.uid()::text`. Files stored at `{user_id}/avatar-{timestamp}.{ext}`.

4. **GRANT gotcha (KEY LEARNING):** creating a table + RLS policies isn't enough on Supabase — the `authenticated` role also needs explicit `GRANT SELECT/INSERT/DELETE ON public.<table> TO authenticated`. Without this, every request returns `code: '42501' permission denied for table <name>`. Same applied to `UPDATE` on `profiles` before profile editing worked. **Always run grants alongside the migration.**

**API routes added:**
- [app/api/saves/route.ts](app/api/saves/route.ts) — `POST` (save), `GET` (list with `?search=&platform=`), `DELETE` (`?url=` — used by toggle to skip the id lookup)
- [app/api/saves/[id]/route.ts](app/api/saves/[id]/route.ts) — `DELETE` by id (used by SavesTab remove button)
- [app/api/saves/check/route.ts](app/api/saves/check/route.ts) — `POST` (batch URL check; JSON body `{urls: string[]}` to avoid query-string length issues). Returns `{saved_urls: string[]}`.
- [app/api/profile/route.ts](app/api/profile/route.ts) — `PATCH` for `display_name` / `bio` / `avatar_url`. Validates type, trims, enforces 60-char name + 300-char bio. Empty strings → null.

**UI additions:**
- [app/components/SavesProvider.tsx](app/components/SavesProvider.tsx) — React Context provider. State: `savedUrls: Set<string>`, dedup'd hydration via `checkedUrls` ref, optimistic updates with rollback on failure. Hooks into `auth.onAuthStateChange` so signing out clears local state.
- [app/components/ListingCard.tsx](app/components/ListingCard.tsx) — heart button (SVG, not emoji) absolutely positioned top-right of the card image. Hidden when signed out. Visible on hover OR when saved. `e.preventDefault() + e.stopPropagation()` because card is an `<a target="_blank">`. Filled red (`#E24B4A`) when saved.
- [app/components/ResultsDisplay.tsx](app/components/ResultsDisplay.tsx) — calls `hydrateUrls(allListingUrls)` once per search so hearts render correctly without N round-trips.
- [app/(protected)/profile/page.tsx](app/(protected)/profile/page.tsx) — server component, fetches full `Profile` row, renders nav + `ProfileHeader` + `ProfileTabsClient`.
- [app/components/profile/ProfileHeader.tsx](app/components/profile/ProfileHeader.tsx) — client component. Circle avatar (`avatar_url` or initial fallback on `var(--accent)`), display name (fallback: email prefix), email, "Joined Month YYYY", bio paragraph (hidden if null), "Edit profile" button on the right.
- [app/components/profile/EditProfileModal.tsx](app/components/profile/EditProfileModal.tsx) — modal dialog. Avatar uploader (client-side validation, direct upload to Supabase Storage via browser client — no Next.js round-trip), display name + bio inputs with char counters, Cancel/Save. Esc and backdrop click close it; body scroll locked while open.
- [app/components/profile/ProfileTabsClient.tsx](app/components/profile/ProfileTabsClient.tsx) — Saves / Watchlist tabs (Settings removed, lives at `/settings` instead). URL-driven via `?tab=watchlist`.
- [app/components/profile/SavesTab.tsx](app/components/profile/SavesTab.tsx) — debounced (250ms) search, optimistic remove via DELETE-by-id, empty state "No saves yet. Heart listings to save them ❤️".
- [app/components/profile/WatchlistTab.tsx](app/components/profile/WatchlistTab.tsx) — "Coming next" placeholder.
- [app/(protected)/settings/page.tsx](app/(protected)/settings/page.tsx) — standalone settings page (also "Coming soon" placeholder).
- [app/components/AuthButton.tsx](app/components/AuthButton.tsx) — dropdown now has Profile → Settings → Sign out (with divider above Sign out). Settings links to `/settings` (not `/profile?tab=settings`).
- [app/(protected)/layout.tsx](app/(protected)/layout.tsx) — wraps children in `<SavesProvider>` and mounts sonner `<Toaster position="bottom-right" theme="system" richColors closeButton />`.

**Dependencies:**
- Added `sonner` (~3 KB) for toast notifications.

**Toast design decisions:**
- Save success: `toast.success('Saved to Favorites')` — green checkmark.
- Save remove: plain `toast()` with a custom red **X** SVG icon and red text/border. Earlier version used `toast.error` (red ! icon), which read as an error. Replaced both call sites with the X variant.
- `richColors` is enabled in `<Toaster>` so semantic toasts get colored backgrounds.

**Other decisions worth noting:**
- **Listing key:** `listing.url` (natural key). The `Listing.id` from search is nanoid-generated and not stable across sessions, so we never store it in `saves`.
- **Cached snapshot, not live:** when a listing is saved, the title/price/image at save-time get stored. No background re-scrape (that's Phase 2C Watchlist).
- **Heart hidden when signed out** — chosen over "show + prompt login" for cleanliness. Reconsider if we later want to drive signups from search results.
- **Bio source:** `public.profiles.bio` (added 2026-05-18 by user). Display name pulled from `profiles.display_name`; avatar from `profiles.avatar_url`. Email always falls back to `auth.user.email` if the profile row is missing.
- **Avatar files are timestamped, not upserted** (`avatar-{Date.now()}.{ext}`) — sidesteps browser cache-busting. Trade-off: old files accumulate. Acceptable since the bucket is per-user and capped at 2 MB per file. If storage usage becomes a concern later, add a `remove([oldPath])` call before each new upload.

**Verified end-to-end in browser:**
- Save / unsave hearts on search results (with toast feedback)
- Saves grid on `/profile`, search filter, remove
- Profile editing: upload avatar → save → header refreshes via `router.refresh()`
- Display name + bio edit & persist
- Light + dark mode

**NOT verified by Claude (recommend manual checks):**
- Avatar files older than the latest upload should still be in the bucket (no auto-cleanup). Verify in Supabase Storage UI if storage usage matters.
- Cross-user RLS: save a listing, sign in as another user, confirm the row doesn't appear (RLS should block it).

**Known follow-ups (not blockers):**
- Watchlist tab is a placeholder. Phase 2C: eye-icon on listings, auto-refresh on login, price drops.
- Settings page is a placeholder. Could host theme toggle, account deletion, email preferences.
- No old-avatar cleanup. Add `remove([oldPath])` if storage usage gets noisy.

---

**Previous: 2026-05-18 — Price filter dropdown fully polished:**

✅ **Price filter Min/Max input dropdown is fully working.** Both inputs are visible, side-by-side, no spinners, digits-only, with min < max validation.

**What was fixed/added in [FilterPanel.tsx](app/components/FilterPanel.tsx):**
- **Clipping fix:** replaced `grid 0fr→1fr` animation (which used `overflow-hidden` and constrained width) with `opacity + translateY` fade. Dropdown now has a fixed `width: 252px` that's always respected
- **No spinners:** switched from `type="number"` to `inputMode="numeric"` — numeric keyboard on mobile, plain text field on desktop, no up/down arrows
- **Digits only:** `onChange` strips all non-digit characters via `.replace(/\D/g, '')` before reaching state
- **Min < Max validation:** on every keystroke, both values are compared; if `min >= max` when both are set, both input borders turn red and an error message appears. Invalid value is withheld from parent state so it can't affect search results
- **Local raw-string state:** `minRaw`/`maxRaw` hold typed text inside the dropdown, decoupled from parent numeric state
- **Clear button:** shows when either raw field has text (not just when parent state has a value)
- **Pill label logic:**
  - Both set: `$MIN–MAX` (e.g., `$50–200`)
  - Min only: `$MIN+` (e.g., `$50+`)
  - Max only: `up to $MAX` (e.g., `up to $200`)
  - Neither: `Any`

**Previous: 2026-05-18 — Phase 2C: Price filter implemented:**

✅ **Price filter is now fully functional.** Users can select from 5 preset price ranges: Under $50, $50–$100, $100–$200, $200–$500, Over $500.

**Implementation details:**
- Added `PRICE_RANGE_OPTIONS` constant with 5 preset ranges in [FilterPanel.tsx](app/components/FilterPanel.tsx)
- Price filter is a dropdown pill on the same row as Category, Size, Condition, Color (matching UI pattern)
- Stores single `priceRange` string key in `FilterState` (e.g., '50-100')
- Lifted filter state from `SearchForm` → `SearchSection` so `ResultsDisplay` can access price filters
- Client-side filtering: price filters are NOT sent to the API (they filter results post-search)
- USD-priced listings only: non-USD listings pass through unfiltered when a price range is selected
- `ResultsDisplay` maps the priceRange key to min/max values and filters accordingly

**Price ranges:**
- Under $50: $0 – $50
- $50–$100: $50 – $100
- $100–$200: $100 – $200
- $200–$500: $200 – $500
- Over $500: $500+

**Files modified:**
- [app/components/FilterPanel.tsx](app/components/FilterPanel.tsx) — added `PRICE_RANGE_OPTIONS`; updated `FilterState` to use single `priceRange` field; added price dropdown pill to filter row
- [app/components/SearchForm.tsx](app/components/SearchForm.tsx) — now accepts `filters` and `onFiltersChange` as props (lifted from internal state)
- [app/components/SearchSection.tsx](app/components/SearchSection.tsx) — now manages filter state and passes it to both `SearchForm` and `ResultsDisplay`
- [app/components/ResultsDisplay.tsx](app/components/ResultsDisplay.tsx) — now accepts `priceRange` prop; maps it to min/max and filters listings before render

**Testing:**
- TypeScript: zero errors
- Price dropdown integrates seamlessly with other filter pills
- Filtering works on USD-priced listings
- Non-USD listings are not filtered (pass through)
- UI consistency maintained (dropdown styling matches Color, Condition, etc.)

**Next priorities (in order):**

1. **Phase 2B: Easy product additions** — Watchlist and Saved Searches
   - These are the quickest wins to add core functionality
   - Both should be moved into `app/(protected)/` for auth protection
   - Use existing patterns from search page

2. **Phase 2D: New platforms**
   - Priority 1: **The RealReal** and **ThredUp** (high-demand platforms)
   - Priority 2: **2nd Street** (lower urgency)
   - Add to crawl4ai-service as new scrapers
   - Wire into search results UI

3. **Future (lower priority):**
   - Help/contact forum
   - Additional features TBD

**Current state:**
- Auth: fully working (email/password, Google OAuth, forgot password, route protection)
- Search: functional with Firecrawl + platform scrapers
- Filters: category, size, condition, color (all query-injected), price (client-side post-search)
- Platforms: eBay, Vestiaire Collective, Grailed (eBay has cosmetic issues)
- Known issues: Vestiaire URL discovery blocked by Firecrawl; eBay scraping works but UI shows weirdly

---

**Previous: 2026-05-16 — Search page protected; sign-out redirects to login:**

Fixed sign-out behavior: moved `/app/page.tsx` → `/app/(protected)/page.tsx` so the search page requires authentication. Now when users sign out, they are immediately redirected to `/login` if they try to access the search page.

---

**Previous: Phase 2A COMPLETE (2026-05-16):**

✅ **Phase 2A is DONE and fully tested.** All email+password, Google OAuth, forgot-password, route protection, and theme UX work end-to-end in a real browser.

**What works (verified by user in browser):**
1. ✅ Sign up with email + password → email confirmation → click link → signed in on `/`
2. ✅ Sign in with email + password (existing account)
3. ✅ Forgot password flow (request reset → click email link → set new password → signed in)
4. ✅ Google OAuth (sign up / sign in)
5. ✅ Eye-icon password toggle (show/hide)
6. ✅ Tab sliding animation (slides between "Log in" and "Sign up" smoothly)
7. ✅ Route protection (unauthenticated users redirected from protected routes to `/login`)
8. ✅ Light and dark mode (all pages render cleanly in both themes)

**Phase 2A summary (what was built):**
- Email + password auth (sign up, sign in, forgot password, reset password)
- Google OAuth integration
- Route protection: `app/(protected)/*` auto-redirects unauthenticated users
- Client-side auth hooks: `useAuth()` and `useProtectedRoute()`
- Theme-aware auth UI with accent colors on AuthCard and dividers
- Password placeholders changed to dots (•••••••) for cleaner aesthetic

**Files key to route protection (for Phase 2B/2C):**
- [app/(protected)/layout.tsx](app/(protected)/layout.tsx) — server-side auth guard
- [lib/hooks/useAuth.ts](lib/hooks/useAuth.ts) — `useAuth()` and `useProtectedRoute()` hooks

**How to protect future pages (Phase 2B Watchlist, Phase 2C Saved Searches):**
- Move them into `app/(protected)/` route group, e.g., `app/(protected)/watchlist/page.tsx`
- The layout automatically checks `auth.getUser()` and redirects to `/login` if not authenticated
- Server Components inherit protection automatically; Client Components can use `const { user, loading } = useAuth()`

**Verified by user in browser:**
- All auth flows (signup, signin, password reset) work end-to-end
- Google OAuth works
- Tab animation, eye-icon toggle, theme switching all work
- Error banners display correctly (e.g., reset link expired, callback failed)

---

**Previous change (2026-05-16 night — Phase 2A v2: switched magic-link → email+password, added tabs, Forgot password flow):**

After Phase 2A v1 shipped (Google OAuth confirmed working in browser by user; magic-link sign-in worked but felt slow), user requested a redesign:
- Magic link removed entirely. Users now sign up/in with **email + password** (required).
- Login page has Sign in / Sign up tabs at the top with a sliding indicator (transform-based, 200ms ease-out).
- Forgot-password flow added (request reset link → click email → set new password).
- Email confirmation is still required for new accounts (Supabase default).
- Password storage: handled entirely by Supabase Auth in `auth.users`. **No new column on `public.profiles`.** The user briefly worried about needing one — clarified that Supabase hashes/stores passwords internally and we never touch them.

**Files added (this round):**
- [app/components/AuthCard.tsx](app/components/AuthCard.tsx) — shared wrapper for all auth pages: gradient background, centered card with logo at top, theme-aware. Also exports `GoogleIcon`, `EyeIcon`, `EyeOffIcon` reusable SVGs.
- [app/forgot-password/page.tsx](app/forgot-password/page.tsx) — single email field that calls `supabase.auth.resetPasswordForEmail()` with `redirectTo: /auth/callback?next=/auth/reset-password`. On success → `/check-email?mode=reset`.
- [app/auth/reset-password/page.tsx](app/auth/reset-password/page.tsx) — new-password + confirm-password form. On mount, calls `auth.getUser()`; if no session (link expired/tampered), redirects to `/login?error=reset_expired`. On submit, calls `auth.updateUser({ password })` then routes to `/`.

**Files rewritten (this round):**
- [app/login/page.tsx](app/login/page.tsx) — full rewrite. Email + password inputs, password show/hide eye-icon toggle, Sign in / Sign up tabs with a sliding indicator, `?tab=signup` query param to deep-link to the Sign up tab, `Forgot password?` link (Sign in tab only), Google OAuth at the bottom under an "or" divider. Reads `?error=callback_failed` and `?error=reset_expired` query params to show appropriate banners. `autoComplete` hints (`current-password` for Sign in, `new-password` for Sign up) so password managers behave correctly.
- [app/check-email/page.tsx](app/check-email/page.tsx) — parametric on `?mode=signup|reset`. Signup mode: "Confirm your email" + "click the link to verify your account and sign in." Reset mode: "Reset link sent" + "click the link to set a new password." Uses the shared `AuthCard`.

**Files unchanged but verified still working:**
- [lib/supabase/client.ts](lib/supabase/client.ts), [lib/supabase/server.ts](lib/supabase/server.ts), [proxy.ts](proxy.ts), [app/auth/callback/route.ts](app/auth/callback/route.ts), [app/components/AuthButton.tsx](app/components/AuthButton.tsx), [app/page.tsx](app/page.tsx), [app/globals.css](app/globals.css).
- The callback route already accepts `?next=` and redirects there — used by the reset-password flow to land on `/auth/reset-password` instead of `/`.

**Verified by Claude:**
- `npx tsc --noEmit` clean.
- `npm run dev` (Next 16.2.6, Turbopack) boots clean. No deprecation warnings (proxy.ts file convention).
- All routes return correct status: `GET /` → 200, `GET /login` → 200, `GET /login?tab=signup` → 200, `GET /forgot-password` → 200, `GET /auth/reset-password` → 200, `GET /check-email?mode=signup` → 200, `GET /check-email?mode=reset` → 200, `GET /auth/callback` (no code) → 307 redirect to `/login?error=callback_failed`. `proxy.ts` runs cleanly on every request (Turbopack timings show ~2ms).

**NOT verified by Claude (cannot, needs browser + real Supabase round-trip):**
- That the sliding tab indicator animates smoothly between Sign in and Sign up.
- That the eye-icon password toggle reveals/hides the password as expected.
- That signup → email confirmation → click link actually lands the user signed-in on `/`.
- That `signInWithPassword` rejects bad passwords with a readable error.
- That `resetPasswordForEmail` → click email link → reset-password page → new password → signed-in actually works end-to-end.
- That the `?error=callback_failed` and `?error=reset_expired` banners render correctly when triggered.
- That the form submits when the user presses Enter in the password field (it should — `<button type="submit">` inside `<form onSubmit={...}>`).

**Things to try in browser after this lands:**
1. `npm run dev:all` → visit `http://localhost:3000` → click "Sign in" in nav.
2. Click "Sign up" tab → enter email + new password → click "Create account" → should land on `/check-email?mode=signup` showing the email address. Confirm email arrives → click → return to `/` signed in.
3. Sign out → click "Sign in" tab → enter same email + password → click "Sign in" → should land on `/` signed in.
4. Sign out → "Sign in" tab → click "Forgot password?" → enter email → click "Send reset link" → land on `/check-email?mode=reset`. Click reset email → land on `/auth/reset-password` → enter new password twice → click "Update password" → land on `/`.
5. Press Enter in either input field to verify form submission.
6. Toggle dark/light theme on each auth page to verify both look clean.

**Google OAuth consent-screen polish (user-asked but not done — instructions only):**
The user noted that the Google consent screen says "Sign in to peyqxfijdrziqfjkxjsn.supabase.co" which looks unbranded.

- **Free fix (recommended for now)**: In Google Cloud Console → APIs & Services → OAuth consent screen, set:
  - **App name**: "Crawli"
  - **User support email**: owner@example.com (already set)
  - **App logo**: upload a Crawli logo (square PNG, 120x120+ recommended)
  - **Developer contact**: owner@example.com
  After saving, the Google prompt becomes "Sign in to Crawli to continue to peyqxfijdrziqfjkxjsn.supabase.co" — the Crawli branding is now front-and-center.
- **Proper fix (paid)**: Supabase Pro plan ($25/mo) supports Custom Domains. You'd CNAME e.g. `auth.crawli.com` to the Supabase project, then the consent screen reads "Sign in to auth.crawli.com". Defer until ready to upgrade.

**Cost posture (Supabase free tier):** Email confirmation emails + password reset emails are counted against Supabase's free-tier email quota (4 emails per hour per project on the inbuilt SMTP — VERY low). If signup/reset emails start failing, configure a custom SMTP in Supabase → Authentication → Email Templates → SMTP Settings (Resend, SendGrid, AWS SES, etc., all have generous free tiers). Not urgent until usage picks up.



**Important Next.js 16 gotcha discovered this session:** Next 16 deprecated the `middleware.ts` file convention in favor of `proxy.ts`. The dev server prints a deprecation warning if you use `middleware.ts`, and Next 17 will remove support entirely. Same API — just rename the file to `proxy.ts` and rename `export async function middleware(...)` to `export async function proxy(...)`. The `config.matcher` export is unchanged.

**Files added:**
- [lib/supabase/client.ts](lib/supabase/client.ts) — browser client via `createBrowserClient`. Use in Client Components.
- [lib/supabase/server.ts](lib/supabase/server.ts) — server client via `createServerClient` + async `cookies()`. Use in Server Components, Route Handlers, Server Actions. The try/catch around `cookieStore.set` is required because Server Components can't mutate cookies; the proxy handles refresh.
- [proxy.ts](proxy.ts) — runs `supabase.auth.getUser()` on every matched request to refresh the cookie before route handlers see it. Matcher excludes `_next/static`, `_next/image`, `favicon.ico`, and image extensions.
- [app/auth/callback/route.ts](app/auth/callback/route.ts) — GET handler that exchanges the OAuth/magic-link `code` query param for a session, then redirects to `next` (defaults `/`). On failure, redirects to `/login?error=callback_failed`.
- [app/login/page.tsx](app/login/page.tsx) — Client Component. Two auth methods in one card: Google OAuth button (full-color SVG logo, `btn-secondary` chrome) + email magic-link form (`input-base` + `btn-primary`). Wraps in `<Suspense>` because `useSearchParams` requires it. Reads `?error=callback_failed` to show a banner if the callback failed.
- [app/check-email/page.tsx](app/check-email/page.tsx) — Post-magic-link confirmation screen. Reads `?email=...` from query params to display the address. Mail-icon glyph in `var(--accent-soft)` circle.
- [app/components/AuthButton.tsx](app/components/AuthButton.tsx) — Session-aware nav button. Renders a skeleton during initial `getUser()`, "Sign in" link (btn-primary) when signed out, or an avatar-initial + chevron dropdown when signed in. Subscribes to `auth.onAuthStateChange` so sign-in/sign-out reflects without a refresh. Click-outside + Escape close the dropdown.

**Files modified:**
- [app/page.tsx](app/page.tsx) — Nav right cluster now wraps `<ThemeToggle />` + `<AuthButton />` in a `flex items-center gap-3` div.
- [app/globals.css](app/globals.css) — Added 4 reusable utility classes (`btn-primary`, `btn-secondary`, `input-base`, `menu-item`) so auth/form components stay theme-token-driven without inline `onMouseEnter`/`Leave` hacks. All use `transition-*` for the user's "smooth transitions" requirement.
- `package.json` — Added `@supabase/supabase-js` and `@supabase/ssr` (78 transitive deps; 2 moderate npm-audit warnings are pre-existing).

**Verified by Claude:**
- `npx tsc --noEmit` clean.
- `npm run dev` (Next 16.2.6, Turbopack) boots clean — **no warnings** after the `middleware.ts → proxy.ts` rename. Earlier "deprecated" warning is what tipped us off.
- All routes return correct status: `GET /` → 200, `GET /login` → 200, `GET /check-email` → 200, `GET /auth/callback` (no `code`) → 307 redirect to `/login?error=callback_failed`. `proxy.ts` runs successfully on every request (visible in Turbopack timings: `proxy.ts: 3–656ms`).

**NOT verified by Claude (cannot, needs browser + real Supabase round-trip):**
- That `/login` renders correctly in both dark and light themes (especially the Google button against `--surface` and the magic-link input focus ring).
- That clicking "Continue with Google" actually completes the OAuth flow — depends on the user's Google Cloud + Supabase config being correct (no way to verify from here).
- That a magic-link email is actually delivered and clicking it lands on `/` signed in.
- That a `profiles` row is auto-created on first sign-in (the trigger should fire, but we can't query the DB from here).
- That the AuthButton dropdown animates smoothly and the click-outside / Escape close works as expected.

**Test plan for the next session (what the user should run):**
1. `npm run dev:all` boots.
2. Visit `http://localhost:3000` — nav shows "Sign in" button on the right; search still works as before.
3. Click "Sign in" → `/login` page renders the Crawli logo, Google button, email input, primary "Send magic link" button. Test both dark and light themes.
4. Magic link: enter your email → click Send → lands on `/check-email` showing your address. Open the email → click the link → returns to `/` and the nav now shows a user avatar + dropdown.
5. Google: click "Continue with Google" → Google consent screen → returns to `/` signed in. If you see `redirect_uri_mismatch`, the Google Cloud Console redirect URI doesn't exactly match Supabase's `https://peyqxfijdrziqfjkxjsn.supabase.co/auth/v1/callback`.
6. Click avatar → "Sign out" → returns to signed-out state.
7. After signing in, visit Supabase Dashboard → Table Editor → `public.profiles` → confirm a row exists for your user with the email populated (auto-created by `handle_new_user` trigger).
8. Refresh the page while signed in — session should persist (cookie-based via `@supabase/ssr`).

**Background — what was configured at the dashboard level (carried over from the previous block):**
- **Supabase Auth providers** — Email enabled with magic links + email confirmations; Google OAuth enabled with Client ID + Secret from a Google Cloud Console OAuth 2.0 credential.
- **Google Cloud Console** — Web-app OAuth 2.0 client created; authorized redirect URI is `https://peyqxfijdrziqfjkxjsn.supabase.co/auth/v1/callback` (Supabase's standard callback host).
- **Supabase URL configuration** — Site URL set to `http://localhost:3000`; redirect URLs include `http://localhost:3000/**` for local dev.
- **`SUPABASE_SERVICE_ROLE_KEY` added to `.env`** — verified present at line 4. **Minor format nit (worth fixing):** the line is `SUPABASE_SERVICE_ROLE_KEY = <value>` with a space before `=`. Standard dotenv parsers (Next.js's `@next/env` included) trim this correctly, so it works — but it's non-standard and worth cleaning up to `SUPABASE_SERVICE_ROLE_KEY=<value>` to avoid future parser quirks. Every other env var in the file has no space.
- **`profiles` table** created in Supabase Postgres with:
  - Columns: `id UUID PK → auth.users(id) ON DELETE CASCADE`, `email TEXT`, `display_name TEXT`, `avatar_url TEXT`, `created_at`, `updated_at`.
  - RLS enabled. Policies: `SELECT WHERE auth.uid() = id`, `UPDATE WHERE auth.uid() = id`. No INSERT policy — handled by the trigger below, which is `SECURITY DEFINER` and bypasses RLS.
  - Trigger `on_auth_user_created` → `handle_new_user()` on `auth.users` insert → auto-inserts a matching profile row.
  - Trigger `on_profile_updated` → `handle_updated_at()` on `profiles` update → bumps `updated_at`.

**Cost posture (verified from Supabase public pricing):** Google OAuth itself is free with no per-user charge. Supabase free tier covers 50k MAU and magic-link emails are included. We're nowhere near scale-out concerns — proceed without cost worry.

**Phase 2 sequence (decided 2026-05-16; supersedes the older "Phase 2 — saved searches, price history, watchlist, auth" bullet in §7 D):**
- **Phase 2A — Auth** (current). Email magic link + Google OAuth. Foundation for everything that follows.
- **Phase 2B — Watchlist.** `watchlist (id, user_id, listing_url, platform, title, price_at_add, image_url, created_at)`. Heart icon on `ListingCard` (only when logged in). `/watchlist` page shows saved listings with current vs original price. URL is the natural key — listings get deleted by sellers, handle 404 gracefully.
- **Phase 2C — Saved Searches.** `saved_searches (id, user_id, query, filters jsonb, platforms text[], created_at)`. "Save this search" button in `SearchForm`. `/saved-searches` page with "Run again" links. (User explicitly deferred this until after watchlist.)
- **Phase 2D — Price alerts.** Hardest. Deferred until 2B is solid. Needs a scheduled re-scrape job (Supabase Edge Function + `pg_cron`, or external cron). On cadence, re-fetch each watchlist URL via the sidecar, write a price snapshot, trigger email on price drop. Cost watchpoint: each re-scrape costs 0 Firecrawl credits (URL is already known — sidecar only) and a few cents per 100 listings in OpenAI tokens.

Reference: detailed implementation plan at `/Users/kevingui/.claude/plans/i-want-to-have-enchanted-clock.md`.

---

**Previous change (2026-05-16 — Crawli rebrand + Peach Rings candy theme):**
- **App renamed to "Crawli".** Nav wordmark replaced the purple box + "Resale/Search" text with a CSS gradient text span using `fontFamily: 'Trebuchet MS', 'Segoe UI'`, `fontWeight: 700`, `letterSpacing: -0.5px`, gradient left-to-right `#E24B4A → #E84D1D → #D85A30 → #EF9F27 → #FAC775` via `WebkitBackgroundClip: 'text'`.
- **Theme colors replaced across globals.css.** All purple accent tokens removed:
  - `--accent`: `#E24B4A` (Primary Red) in both dark and light modes
  - `--accent-hover`: `#D85A30` (Primary Orange)
  - `--accent-soft`: `rgba(226, 75, 74, 0.18)` dark / `rgba(226, 75, 74, 0.12)` light
  - `--accent-text`: `#FAC775` (warm yellow for dark) / `#D85A30` (orange for light)
  - Added CSS vars for all brand stops: `--brand-red`, `--brand-red-orange`, `--brand-orange`, `--brand-orange-yellow`, `--brand-yellow`
- **Metadata updated** in `layout.tsx`: title → "Crawli — Resale Price Search", description updated to include all 8 platforms.
- **Logo SVG file** created at `public/crawli.svg` (200×60 viewBox, full wordmark with Peach Rings gradient). Use for any exports.
- **Favicon** at `app/icon.svg` — "C" lettermark on gradient orange-red rounded rectangle, auto-detected by Next.js App Router.
- **`tsc --noEmit`** passes clean.
- **NOT verified in browser:** gradient text rendering on Safari (WebkitTextFillColor / backgroundClip may need fallback on very old Safari; modern Safari is fine). Verify search button, active platform chips, active filter pills all read correctly in the new red/orange palette rather than purple.

---

**Last updated (previous):** 2026-05-16 (late evening — relevance filter + StockX last-sale gate)
**Status:** Firecrawl scraping fully replaced by in-house crawl4ai sidecar. **Structured-data extraction covers 6 of 8 platforms** (Grailed, Depop, StockX, Poshmark, Mercari, Vinted). eBay still bot-blocked; Vestiaire still URL-discovery-blocked. StockX prices are real-time and can race (acceptable). **`/api/search` now streams NDJSON** so the UI can show a live per-platform progress bar instead of a frozen "Searching…" button.

**Latest change (2026-05-16 late evening — title-relevance filter + StockX Last-Sale guard):**
- **Title-relevance filter** in [lib/parse.ts](lib/parse.ts) `parseScrapedListings()`. Drops scraped listings whose title shares zero substantive tokens with the user's query. Motivated by a Vinted Versace-Trigreca-sneaker listing being returned for a "fear of god essentials hoodie medium black" query — same `/items/\d+/` URL shape, so the URL filter passed; only post-scrape title comparison can catch this. Implementation: tokenize both sides (lowercase, strip punctuation, length ≥ 3), remove a small stopword set covering articles, colors, sizes, and condition/genre words (so "black" + "medium" can't carry a match), then require at least one shared token. If the query has no substantive tokens after stopwording (e.g. just "black hoodie"), pass everything through — better to show fuzzy results than zero. `parseScrapedListings(scraped, platform, query)` — `query` is new and threaded from `app/api/search/route.ts:searchAndScrape` which already had it. Generalizes across all platforms; no per-platform code.
- **StockX Last-Sale gate** in [crawl4ai-service/structured_extractors.py](crawl4ai-service/structured_extractors.py) `extract_stockx()`. When the default-variant of a multi-size product has no live Asks, StockX reuses the `[data-testid='trade-box-buy-amount']` element to show the Last Sale figure — surfaced as wrong "Buy Now" numbers in production (e.g. FOG Essentials Chest Logo Hoodie page showing $50 when the actual Buy Now is $135 and $50 is the last sale). Fix: walk up 2 ancestors from the amount element and read the local text. If "Last Sale" or "No Asks" appears AND "Buy Now"/"Place Bid" does not, treat as no Ask and null the price. Tight 2-ancestor scope avoids matching "Last Sale" labels from the sales-history chart further down the page. Listings with `price=null` still pass the `title || price !== null` gate in `parseScrapedListings`, so they render with no price block and sink to the bottom of the sort — accepted tradeoff per user ("better than wrong prices"). Conservative-only — does not attempt to find the lowest Ask across sizes (option A in the diagnosis); revisit if needed.

**Verified by Claude:** `npx tsc --noEmit` clean.

**NOT verified by Claude (needs browser + live sidecar):**
- That a real "fear of god essentials hoodie medium black" search no longer surfaces the Versace Trigreca Vinted listing.
- That none of the previously-good results get over-filtered by the relevance check (especially queries that lean heavily on colors/sizes after stopwording).

**Known remaining StockX issues (post-verification):**
- StockX multi-variant listings still show inconsistent prices across size options (e.g. same product, different sizes have different Asks). The conservative Last-Sale gate prevents reporting Last Sale as Buy Now, but doesn't yet solve the "which size's Ask should we show?" problem. Option A (find lowest Ask across all size variants) remains blocked — requires scraping multiple variant endpoints or parsing a size selector. User preference: generalization > nitpicking, so defer this unless user reports it as a blocker.
- Non-variant StockX listings should continue showing their Ask price normally — the Last-Sale gate only fires when that specific trade-box context has "Last Sale" + no "Buy Now".

**Previous change (2026-05-16 — platform display order reordered):**
- **Platform chip order** in `PLATFORM_DOMAINS` and `PLATFORM_NAMES` (lib/types.ts) changed from: Grailed, Depop, StockX, Poshmark, eBay, Mercari, Vinted, Vestiaire Collective
- **To:** Grailed, Depop, Poshmark, Mercari, Vinted, eBay, Vestiaire Collective, StockX
- **Default selected platforms** on page load changed from [Grailed, Depop, StockX] to [Grailed, Depop, Poshmark, StockX] (SearchForm.tsx:19).
- This affects the order of platform chips in FilterPanel and the order they appear when iterating over PLATFORM_DOMAINS.

**Previous change (2026-05-16 — inline dropdown-pill filters + combined M/W shoe sizes):**
- **Replaced the "Additional configurations" accordion with always-visible inline filter pills.** The collapsed/expanded panel state is gone. New layout in [FilterPanel.tsx](app/components/FilterPanel.tsx), top to bottom:
  1. Platform chips row (back outside any dropdown — brand colors when active, same chip styling as the earlier external row). "Select all" / "Clear all" link prefixes the row.
  2. Thin divider (`border-top: 1px solid var(--border)`).
  3. A wrap-friendly flex row of 4 dropdown pills: `Category`, `Size` (or `Shoe size` when Footwear is active), `Condition`, `Color`.
- **New custom `FilterDropdown` component** (private to FilterPanel.tsx). Each pill shows `{label}: {selectedLabel || 'Any'} ▾`. Click toggles a dropdown panel anchored under the pill. Click-outside (document `mousedown` listener) and `Escape` both close it.
- **Smooth open animation** — same grid `0fr → 1fr` + opacity trick the prior accordion used, 200ms ease-out. `pointer-events: none` when closed so the invisible panel doesn't intercept clicks. Chevron rotates 180° on open.
- **Active state on a pill** (i.e. user picked a non-default option) uses `border: 1px solid var(--accent)` (purple `#534AB7`) and `color: var(--accent-text)` for the label + selected value. New CSS var `--accent-text` added to [globals.css](app/globals.css): `#AFA9EC` in dark mode (the requested purple-tinted text), `#534AB7` in light mode (the full accent — `#AFA9EC` washes out on white). Inactive pills use `var(--surface)` background + `var(--border)` border + `var(--text)` value text + `var(--text-muted)` label text. All values are theme tokens — works in light and dark mode out of the box.
- **Dropdown panel** uses `var(--bg-elevated)` background + `var(--border-strong)` border + shadow-lg + `max-height: 260px; overflow-y: auto` so long lists (Color, shoe sizes) scroll cleanly. Each item is left-aligned with optional leading slot (used for color swatches). Selected item is highlighted with `var(--accent-soft)` background + `var(--accent-text)` text + a trailing check icon.
- **Shoe sizes restructured: combined men's + women's into a single chip per pair**, using Nike's M+1.5 convention. Labels are like `M 8 / W 9.5`, `M 10 / W 11.5`. Half sizes are included from M 6 through M 12 (i.e. M 6, 6.5, 7, 7.5, …, 11.5, 12), plus M 13 and M 14 with no women's counterpart. The `queryTerm` is the bare numeric (`"size 10"`) since most platforms key off the men's number; the W half is for shopper recognition only. `CLOTHING_SIZE_OPTIONS` (XS–XXL) is unchanged and still rendered when category ≠ footwear.
- **Backend routing is unchanged** — the same `filtersToQuerySuffix(filters)` runs in `SearchForm.handleSubmit`, appending color/category/condition/size keywords to the user's query before POSTing to `/api/search`. `FilterPanel` is purely presentational; it owns no state. All four filter fields and the platforms array continue to live in `SearchForm` and flow back via the existing `onFiltersChange` / `onPlatformsChange` callbacks. SearchSection didn't change at all.
- **Removed:** the accordion header (`Additional configurations`), the active-count pill, the wrapping `<div>` with the slide-toggle, the per-section "Any" chip pattern (now each dropdown leads with an "Any" row instead), and the emoji icons from the pill labels.

**Verified by Claude:** `npx tsc --noEmit` clean on project code.

**NOT verified by Claude (needs browser):**
- That the dropdowns animate smoothly in both directions and don't flicker on Safari (the `0fr → 1fr` trick has historically had Safari quirks; if you see jank, swap to `max-height`).
- That click-outside reliably closes the open dropdown when the user clicks another pill (the second pill's `onClick` should both close the first pill via the document listener AND open itself — React event order should make this work, but verify).
- That the active-state purple border + `--accent-text` color are legible on top of `var(--surface)` in both themes, especially against the very-low-contrast dark `--surface` (4% white).
- That the dropdown panel doesn't get clipped on narrow viewports — it's `min-width: 180px` and anchored `left: 0`. On the rightmost pill (Color) with a narrow window, the panel may overflow the right edge. If that's a real problem, add a `right-0` variant when the pill is in the latter half of the row.
- That an actual search with multiple filters set still appends them correctly to the URL the API sees (no regressions in the keyword-stuffing path).

---

**Previous change (2026-05-16 — context-aware size section + platform defaults + no-platform guard + placeholder fix):**
- **Size section is now category-aware.** Two option sets live in [FilterPanel.tsx](app/components/FilterPanel.tsx): `CLOTHING_SIZE_OPTIONS` (XS–XXL) and `SHOE_SIZE_OPTIONS` (Men's 8–12 + Women's 8–12). The Size section renders `SHOE_SIZE_OPTIONS` when `filters.category === 'footwear'`, otherwise `CLOTHING_SIZE_OPTIONS`. Section title swaps between "Shoe size" and "Clothing size" so the user always knows which scale they're picking. The `SIZE_OPTIONS` export is preserved as a combined list — `filtersToQuerySuffix()` still resolves any size key regardless of which set was active when the user picked it.
- **Gender clarification on shoe sizes.** Shoe chips are labeled `Men's 10` / `Women's 10` (not bare numbers). The `queryTerm` carries the gender too (`"men's size 10"`), so each platform's own search index can distinguish them. Numbers alone would collide on platforms that don't return faceted results.
- **Auto-clear on category switch.** Toggling category between footwear and non-footwear clears `filters.size` to avoid a stale shoe-key sitting in state while the clothing chip row is showing (and vice versa). Switching among non-footwear categories (Tops → Outerwear) does NOT clear size since both use `CLOTHING_SIZE_OPTIONS`.
- **Default platform set is now Grailed + Depop + StockX** (`DEFAULT_PLATFORMS` in [SearchForm.tsx](app/components/SearchForm.tsx)) instead of all 8. Rationale: covers streetwear / used clothing / sneakers, all three are confirmed reliable, and the first search no longer waits on the two known-broken platforms (eBay 307s, Vestiaire URL discovery gap). User can expand from the dropdown.
- **No-platform guard with notification.** `handleSubmit` now: returns silently if `isLoading` or empty query; calls `onError('Please select at least one platform before searching.')` and returns when `selected.length === 0`. The error is rendered by `SearchSection` ([app/components/SearchSection.tsx:82-91](app/components/SearchSection.tsx#L82-L91)), so the user sees a visible message instead of a silently-disabled button. Removed `selected.length === 0` from the submit button's `disabled` predicate so the button stays clickable and triggers the error path (otherwise the disabled button would just sit dead with no feedback).
- **Placeholder typo fix.** "Search a product — e.g. ..." → "Search for a product — e.g. ...".

**Verified by Claude:** `npx tsc --noEmit` clean on project code.

**NOT verified by Claude (needs browser):**
- That picking Category: Footwear visibly swaps the chip row to Men's/Women's sizes and re-titles the section.
- That switching from Footwear to Outerwear clears the previously-picked shoe size.
- That clicking Search with zero platforms selected shows the red error banner via `SearchSection`'s error renderer.

---

**Previous change (2026-05-16 — Additional configurations panel: smooth slide, platforms moved in, single-select sections):**
- **Renamed "Filters" → "Additional configurations"** in the dropdown header. Replaces the prior color-only dropdown with a full multi-section panel.
- **Smooth slide-down animation** using the CSS grid `grid-template-rows: 0fr → 1fr` trick (not `max-height`, which is hard to size right without overflow flicker). The collapsing wrapper is a `<div className="grid transition-all duration-300 ease-out">` with `gridTemplateRows` and `opacity` driven by the open state, and its only child is `<div className="overflow-hidden">`. Animates both height *and* opacity over 300ms with ease-out. No JS measurement, no fixed height — works at any content size. Chevron rotation transition bumped to 200ms to match.
- **Platforms moved inside the dropdown**, as the first section (above Color). Stayed multi-select. The "All" chip selects every platform; clicking individual platform chips toggles them. Active platform chips render in that platform's brand color (same `platformStyle()` used elsewhere), so the chip palette doubles as a legend. Removed the previous external "Select all / Clear all" link + chip row from `SearchForm`.
- **Single-select sections (Color, Category, Condition, Size)** each lead with an "Any" chip (instead of the corner-button "Any" the user disliked). Selecting a real option highlights it in accent; clicking it again deselects back to "Any". Color is no longer multi-select.
- **New sections added:** Category (Tops / Bottoms / Outerwear / Footwear / Accessories), Condition (New / Like New / Used), Size (XS–XXL clothing + Size 7–13 shoes; shoe sizes are explicitly prefixed "Size N" in both the chip label and the query term so they don't collide with non-existent clothing-numeric sizes).
- **Query construction** ([FilterPanel.tsx:filtersToQuerySuffix](app/components/FilterPanel.tsx)): exported helper that maps the current `FilterState` to a space-joined keyword suffix. Order is color → category → condition → size. Condition uses a `queryTerm` field (e.g. `"like new"` for the `like-new` key) so display labels and query terms can diverge. Size does the same (chip `"S"` → query `"size S"`, chip `"Size 10"` → query `"size 10"`). `SearchForm.handleSubmit` concatenates `baseQ + ' ' + suffix` and sends that to `/api/search`. **No backend changes** — same keyword-stuffing strategy as before.
- **Active-filter counter pill** next to the panel title now counts platforms-not-all + each non-null filter, so the user sees "Additional configurations [3]" when they have non-default settings stowed.
- **Exported from `FilterPanel.tsx`**: `FilterState`, `emptyFilterState()`, `filtersToQuerySuffix()`, plus the `COLOR_OPTIONS / CATEGORY_OPTIONS / CONDITION_OPTIONS / SIZE_OPTIONS` arrays — so future work (e.g. faceted-URL builders per platform) can reuse the same vocabulary without re-defining it.

**Verified by Claude:** `npx tsc --noEmit` clean on project code (one unrelated warning in `.next/dev/types/validator.ts`, a Next-generated file).

**NOT verified by Claude (needs browser):**
- That the slide-down feels smooth in both directions on a real browser. (The `0fr → 1fr` grid trick is well-supported but has had Safari quirks in older versions; if you see a jump, swap to `max-height: 0 → 1000px` as a fallback.)
- That none of the chips wrap awkwardly at narrow widths — there are now ~30 chips in the panel.
- That a search like `nike air max 90` + Color: Red + Category: Footwear + Size: Size 10 returns sensibly filtered listings on all six working platforms.

**Removed:** the prior color-only `FilterPanel` is replaced (color is now a single-select section inside the new panel). The external platform chip row in `SearchForm` is removed (platforms live in the dropdown now).

---

**Previous change (2026-05-16 — color filter dropdown):**
- **New `FilterPanel` component** ([app/components/FilterPanel.tsx](app/components/FilterPanel.tsx)) renders as a collapsible card under the platform chips in `SearchForm`. Closed state is a single row: "Filters" label + a small pill counter showing how many filters are active + a chevron. Open state reveals a `Color` section with multi-select chips. Each chip is a small swatch (rounded color dot) + the color name. White/silver swatches use an `inset box-shadow` ring so they stay visible on light backgrounds. An "Any" button on the right clears all color selections.
- **Color palette** ([FilterPanel.tsx:9-24](app/components/FilterPanel.tsx#L9-L24)): black, white, gray, red, orange, yellow, green, blue, purple, pink, brown, beige, gold, silver. Stored as `COLOR_OPTIONS: ColorOption[]` and exported in case other components want the same list later.
- **Wiring** ([SearchForm.tsx](app/components/SearchForm.tsx)): added `colors: string[]` state. On submit, if any colors are selected, the final query sent to `/api/search` is `${baseQ} ${colors.join(' ')}` — e.g. `"nike air max 90" + ["red","white"]` → `"nike air max 90 red white"`. **Backend is untouched** — this works because Firecrawl's `site:<domain> <query>` already does keyword matching on the platform's own search index, and the LLM/structured extractors don't care what the user typed.
- **Why append-to-query instead of a structured `filters` field**: the working platforms don't expose color facets in their search URLs uniformly (Grailed has them, Depop has them in different shapes, Mercari doesn't, etc.). Keyword stuffing is the lowest-friction path that improves results across all six working platforms. When/if we move to per-platform facet builders, the UI state shape (`colors: string[]`) is already correct — only the query-builder layer needs to change.
- The structured-filters TODO from the prior change block now has color partially shipped. Remaining sub-TODOs in that area: garment type (upper / lower / outerwear / footwear / accessories), size, gender, condition.

**Verified by Claude:** `npx tsc --noEmit` passes clean. The dropdown opens/closes via local state and the chip multi-select uses the same `<input type="checkbox" className="sr-only">` pattern as the platform chips for accessibility.

**NOT verified by Claude (needs browser):**
- That the swatches render at a readable size on both light and dark themes (white/silver in particular — those rely on `box-shadow: inset 0 0 0 1px var(--border)` which should be visible against `var(--bg-elevated)`).
- That an actual color-filtered search returns visibly better-matched results (this depends on each platform's own search index, not on our code).
- That the accent counter pill is positioned correctly when one or more colors are active.

---

**Previous change (2026-05-16 — UI polish: clickability, badge fit, lowest-price emphasis, sort):**
- **ListingCard now signals "clickable" more clearly.** Added `cursor-pointer`, a subtle `hover:opacity-90`, and a gentle `hover:scale-[1.02]` on top of the existing accent-border hover. All three live on the `<a>` element via Tailwind classes — no new state.
- **Platform badge no longer stretches edge-to-edge.** Root cause: `ListingCard`'s inner card body is `flex flex-col`, which defaults `align-items: stretch`, so the `inline-block` `PlatformBadge` was being stretched to the column's full cross-axis width. The beige (Vestiaire) / grey (Grailed) / etc. background then visibly spanned the entire card. Fix: pass `className="self-start"` to `PlatformBadge` so just that one child opts out of stretch — title/price still take full width via the existing flow. Affects ALL platforms, not just Vestiaire/Grailed (any badge would have had this problem; the lighter-colored ones just made it most obvious).
  - `PlatformBadge.tsx` already accepted a `className` prop and forwards it; no badge component changes needed.
- **SearchProgress (the "pending search" status panel) tightened.** The status-dot + badge cluster was sitting inside a `flex w-32 shrink-0 items-center gap-2` div — the fixed `w-32` (128px) reserved a wide column even when the badge label was short. Removed `w-32`. Cluster now auto-sizes to content; the adjacent progress bar reclaims the freed space.
- **"Lowest price" badge is now solid + readable on busy images.** Was `background: var(--success-soft)` (~14% alpha green) with green text — almost invisible against light/colorful clothing photos. Now `background: var(--success)` (solid `#16a34a` light / `#4ade80` dark) with `color: #FFFFFF` and uppercase-tracking type, matching the visual language of the platform badges.
- **Listings now sort lowest USD price first.** `ResultsDisplay.visibleListings` is now a `useMemo`-sorted copy: USD listings with a numeric price ascend by price; non-USD or price-null listings sink to the bottom in their original order. Sort applies on every tab (All + per-platform). The `cheapestId` lookup for the "Lowest price" badge is unchanged — it still finds the global USD min — so the first card in the grid is the badged one.

**Verified by Claude:** `npx tsc --noEmit` passes clean.

**NOT verified by Claude (needs browser):**
- Hover effect actually feels right (the `scale-[1.02]` is gentle but if it feels jumpy with the border-color transition, drop the scale and keep only `opacity-90`).
- Vestiaire / Grailed / all other badge backgrounds now hug the label text.
- "Lowest price" badge contrasts well on real listing photos in both light and dark modes.
- Lowest-price card actually appears in the top-left of the grid after a real search.

**TODOs the user added for future sessions (not implemented this round):**
1. **Scrape and surface the listing's posted date.** Then expose a "Sort by date (oldest → newest / newest → oldest)" filter alongside the current price sort. Will require: (a) adding a `postedAt: string | null` field to `ScrapedListing` in `extractors.py` and `lib/types.ts`, (b) per-platform date extraction in `structured_extractors.py` (JSON-LD `datePosted` / `__NEXT_DATA__` timestamps / etc.), (c) UI sort toggle in `ResultsDisplay.tsx`. Each platform will need its own date source — none is universal.
2. **Structured filter chips instead of free-text query refinement.** Today users have to encode everything in the search string ("nike air max 90 red"). Add UI chips for common filters: color, garment type (upper / lower / outerwear / footwear / accessories), size, gender, etc. Will probably need: (a) a `filters` object passed alongside `query` to `/api/search`, (b) per-platform query-builder logic (some platforms have facet URLs, others need keyword smashing), (c) frontend chip components.

---

**Previous change (2026-05-16):** Removed test mode (env var) and changed Firecrawl search limit from 15 to 20 results per platform (was 2 credits/search for 10 results or 4 credits for 15; now 4 credits for 20 to get more coverage).

**Previous change (2026-05-15 evening — platform badge pass):** **Brand-color pill badges for every platform + eBay 4-stripe gradient.**
- `app/components/platformColors.ts` — replaced all placeholder colors with exact brand values: Grailed `#3A3A3A`, Depop `#FF2300`, StockX `#00B341`, Poshmark `#9B4C5C`, eBay `#0064D2` (bar/dot only), Mercari `#5E6DF2`, Vinted `#007782`, Vestiaire Collective `#C4A17A`. Added `PLATFORM_TEXT` map (Vestiaire Collective → black `#000000`; all others → white `#FFFFFF`). Added `platformStyle()` helper that returns `{ background, color, isGradient }`. eBay's `background` is `linear-gradient(to bottom, #E53238 0% 25%, #0064D2 25% 50%, #F5AF02 50% 75%, #86B817 75% 100%)`. The shimmer-bar `platformColor()` for eBay returns `#0064D2` (single solid color — the gradient is too busy at 6px bar height).
- `app/components/PlatformBadge.tsx` (new) — a single reusable `<PlatformBadge platform={p} />` component that renders a rounded-full pill using `platformStyle()`. eBay automatically gets the 4-stripe gradient via its CSS `background`. Vestiaire Collective renders black text on the beige background; all others render white.
- `app/components/ListingCard.tsx` — replaced the old colored-text `<p>` with `<PlatformBadge>`. Removed the `platformColor` import.
- `app/components/SearchProgress.tsx` — replaced the platform name `<span>` with `<PlatformBadge>`. The `platformColor` import is kept because the status dot and shimmer bar still use a single solid accent color per platform.

**Verified:** `tsc --noEmit` clean; `npm run dev:all` boots both services; `GET /` 200 with no errors. Visual verification (are the eBay stripes visible and readable? does Vestiaire Collective's black text contrast correctly?) requires your browser.

**Previous change (2026-05-15 evening — UI polish pass):** **Per-platform color coding + scrollbar fix + sequential-vs-parallel clarification.**
- **Platform color palette.** New file `app/components/platformColors.ts` exports a `PLATFORM_COLORS` map (grailed=red `#ef4444`, depop=pink `#ec4899`, stockx=green `#22c55e`, poshmark=rose `#e11d48`, ebay=yellow `#eab308`, mercari=orange `#f97316`, vinted=teal `#14b8a6`, vestiaire collective=purple `#a855f7`) and a `platformColor(p)` helper. Kept under `app/components/` so `lib/` stays presentation-free.
- **SearchProgress now colors rows by platform.** Each row sets `--row-color` inline. The CSS utilities `.bar-fill-loading` and `.bar-fill-done` in `globals.css` were changed to read `var(--row-color, var(--accent))`, so the shimmer + final-state bar both render in the platform's color. The status dot uses the same color (loading = pulsing colored dot; done = filled colored circle with white check). The platform label is the platform color while loading, then reverts to `--text` when done. Failed state stays red regardless. The global `--accent` (`#534AB7`) is unchanged and continues to drive the search button and the active tab underline — platform colors are row-scoped only.
- **ListingCard platform label** now uses `platformColor(listing.platform)` instead of `--text-dim`. Easier to scan the grid by source.
- **Scrollbar.** Added a `.hide-scrollbar` utility class in `globals.css` (sets `scrollbar-width: none` + `::-webkit-scrollbar { display: none }`). Applied to the horizontal tab strip in `ResultsDisplay.tsx`. Tabs still scroll horizontally if they overflow, but the system scrollbar no longer renders.
- **Architecture note (no code change):** User asked whether the multi-platform search runs sequentially. It does **not** — `app/api/search/route.ts:91` uses `Promise.all(platforms.map(async ...))`, so all selected platforms run their full pipeline (Firecrawl search → URL filter → sidecar scrape → parse) **in parallel**. The visual effect of "all three rows sitting at 'Parsing prices…' together" is correct: the frontend stage timer advances each row through the four labels at the same 2s cadence, so all rows hit the final label well before any `platform_done` event arrives, and each one snaps to "Done — N results" in real completion order. If sequential behavior is ever wanted (cost throttling, polite scraping), it would mean replacing `Promise.all` with a sequential `for await` loop and is a backend change, not a UI fix.

**Verified by Claude:** `tsc --noEmit` clean; `npm run dev:all` boots both services; `GET /` returns 200 with no Turbopack errors. The new platform-color CSS variables don't show up in the initial HTML because they're only set on dynamically-rendered SearchProgress rows.

**NOT verified (needs your browser):** that the per-platform shimmer colors look distinguishable + readable on both themes, that the scrollbar is actually gone on your OS (this matters mostly on macOS with "always show scrollbars" enabled — the CSS covers both WebKit and Firefox).

**Previous change (2026-05-15 evening — UI refresh):** **Modern dark/light dashboard UI.** Refactored the entire frontend (no backend / API / sidecar / lib changes) into a theme-driven dashboard:
- `app/globals.css` now defines all colors as CSS custom properties under `[data-theme="dark"]` (default) and `[data-theme="light"]` on `<html>`. Accent is `#534AB7`. The Tailwind `dark:` variant is **not** used — switching is instant via the `data-theme` attribute. CSS `@keyframes` (`queued-pulse`, `loading-shimmer`, `dot-pulse`) plus utility classes (`.bar-track`, `.bar-fill-loading`, `.bar-fill-done`, `.bar-fill-failed`, `.dot-loading`) live here so all motion is CSS-only.
- `app/layout.tsx` injects a tiny inline `<script>` in `<head>` that reads `localStorage.getItem('theme')` and sets `data-theme` before paint to avoid flash. Defaults to dark.
- `app/components/ThemeToggle.tsx` (new) — sun/moon button in the top nav; toggles `data-theme` on `<html>` and writes to `localStorage`. Persists across reloads.
- `app/page.tsx` rewritten with a sticky top nav (logo + theme toggle) and a new hero ("Find the best resale price.").
- `app/components/SearchForm.tsx` — platform checkboxes are now pill/chip toggles with the accent color border + soft fill when active and a tiny accent checkmark; input is full-width; submit button uses `--accent` (`#534AB7`).
- `app/components/SearchProgress.tsx` — fully rewritten. **One row per platform**, each with: status dot, platform name, animated bar, current stage label, and a chevron that toggles a collapsible monospace "reasoning" dropdown showing the stages reached so far. Stage labels (`Submitting search… → Filtering URLs… → Scraping listings… → Parsing prices…`) advance via **one `setInterval` per row** (2s cadence). The interval is cleared on completion and on unmount. Real `platform_done` event snaps the row to `Done — N results` or `Failed — <error>`. Bar animation is pure CSS — a 1.4s linear shimmer for loading, solid accent for done, solid red for failed. No per-listing counts.
- `app/components/SearchSection.tsx` — now also tracks `counts` per platform from `platform_done` events so SearchProgress can show the final count without going back through the results object.
- `app/components/ResultsDisplay.tsx` — platform tabs at the top use an accent-colored bottom-border underline for the active tab (no pill background). Tab switching is purely client-side. Computes `cheapestId` across all USD listings and passes `isLowest` to ListingCard.
- `app/components/PriceSummary.tsx` — now three metric cards (Low / Average / High) in a 3-col grid above the results. The Low card uses the accent border. Each card shows the source platform name (or count for Average) in muted text. Exports `pickPriceSources()` helper.
- `app/components/ListingCard.tsx` — image-first card with a 1:1 aspect-ratio top. Platform name as small uppercase muted text, 2-line clamp title, large bold price, condition as a single muted line. The cheapest USD listing gets a small green "Lowest price" badge in the image's top-left. The whole card is now a link (clicking anywhere opens the listing); on hover, only the border color changes to the accent — no transforms, no shadows. Removed the prior "View listing →" button, condition color badge, and the colored platform badge.

**Verified by Claude:**
- `npx tsc --noEmit` passes clean.
- `npm run dev:all` boots both Next.js (`:3000`) and the sidecar (`:8000`) without errors.
- `GET /` returns 200 and rendered HTML contains `data-theme="dark"` on `<html>`, the `--accent` CSS variable on inline styles, and the new copy.

**NOT verified by Claude (visual / behavioral — needs a real browser):**
- That the shimmer animation visibly moves left-to-right and feels smooth.
- That the theme toggle swaps colors instantly with no flash, and that the preference actually persists across a hard reload.
- That the platform tabs filter correctly on click and the accent underline animates between tabs.
- That the reasoning chevron opens/closes the dropdown.
- That `setInterval` actually stops advancing after a platform completes (test by leaving one row open and watching it freeze at "Done — N results").
- That a full live 3-platform search renders end-to-end correctly. Backend stream wiring is unchanged from the prior session and was verified live then; only the consuming UI changed.

**Out of scope (not touched):** `app/api/`, `lib/`, `crawl4ai-service/`, env vars, package.json.

**For a future Claude session:** the progress bar's "stage labels" are deliberately fake-but-plausible — they're driven by a frontend timer, not by real backend events. The four stages roughly match what the pipeline actually does (Firecrawl search → URL filter → sidecar scrape → parse), but the timings are 2s heuristic, not measurements. If you want real-time stages, the sidecar protocol and `/api/search` NDJSON stream would both need new event types. The user explicitly preferred the lightweight fake-stage approach to avoid load on the Playwright/crawl4ai processes.

**Previous change (2026-05-16 early morning):** **Live progress bar for multi-source searches.** Converted `POST /api/search` from one-shot JSON to a streaming NDJSON response (`Content-Type: application/x-ndjson`, chunked transfer). Each request emits one `start` event, one `platform_done` event per platform in real completion order, and a final `final` event with cross-platform price stats. Frontend reads the stream via `ReadableStream`/`TextDecoder` and renders a new `<SearchProgress />` component with one checkpoint per selected platform — pending → loading (pulsing) → done (filled checkmark) / failed (red X with tooltip showing the error). Verified live: curl shows lines arriving incrementally with correct timestamps; headers include `x-accel-buffering: no` and `cache-control: no-cache, no-transform` to prevent buffering. **Note:** in tests against eBay/Vestiaire Collective, the upstream `searchAndScrape` does *not* throw on bot-blocks — it returns empty arrays, so those platforms surface as `status: 'ok'` with `count: 0`, not `failed`. The `failed` checkpoint state only fires when `searchAndScrape` actually throws (e.g. sidecar unreachable, Firecrawl outage). See §6.6 below and `app/components/SearchProgress.tsx`, `app/components/SearchForm.tsx`, `app/components/SearchSection.tsx`, `app/api/search/route.ts`, `lib/types.ts` (added `SearchStreamEvent` union).

**Previous change (2026-05-15 late evening):** **Disabled `remove_overlay_elements`** in `CrawlerRunConfig` (was True, now False). It was running JS in the page that on Poshmark either triggered a navigation or mutated the DOM, stripping `<meta property="og:type">` and corrupting other signals (verified: same URL returns 762KB without og:type with overlay-ON, vs 534KB with og:type with overlay-OFF). This also eliminates the "Failed to remove overlay elements: Execution context was destroyed" warnings and the cascading "Page.content: page is navigating" errors the user asked about — those weren't anti-bot, they were our own JS shooting the page in the foot. See §6.5c and §11 (gotcha 23). Also added multi-signal sold detection on Poshmark (the `--sold` banner class is defined in every page's `<style>` so a substring check false-fires; use BeautifulSoup to query the actual rendered element).

**Previous change (2026-05-15 evening):** Added structured extractors for **Mercari** (`__NEXT_DATA__.serverState.ItemDetail:<id>`, price in cents), **Vinted** (escaped RSC payload regex for `"price":{"amount","currency_code"}`), and **Poshmark** (`og:title` + `og:image` + first `<p class="h1"><span>$N</span></p>` + `data-et-prop-inventory_status`). This fixes a class of wrong-price/wrong-image bugs that the LLM was producing on those three platforms. See §6.5 (third iteration) and §11 (gotchas 18–22).

**Previous change (2026-05-15 PM):** Scraping pipeline gained a **structured-data tier** that reads Schema.org JSON-LD (Depop/Grailed) and specific `data-testid` attributes (StockX) directly from the rendered HTML. LLM is now a fallback, not the primary signal. See §6.5 and §11 (gotchas 11–17).

This document supersedes the older `HANDOFF.md` and `HANDOFF_FULL.md`. It folds in all prior context plus the work done in May 2026 to migrate scraping off Firecrawl.

---

## 1. Project Overview

A personal-use web app that searches multiple fashion resale platforms simultaneously and aggregates live listings (price, image, condition, sold status, currency) across them. Single query → results from up to 9 platforms in one view, with min/max/avg price stats.

**Target platforms:** Grailed, Depop, StockX, Poshmark, Mercari, Vinted, eBay, Vestiaire Collective, ThredUp.

**Business value:** Price transparency across a fragmented resale market without manually checking each site.

---

## 2. Tech Stack

**Frontend / API**
- Next.js 16.2.6 (App Router) + React 19.2.4
- TypeScript 5.x, Tailwind v4
- **Auth:** Supabase Auth (email/password + Google OAuth); protected routes via `app/(protected)/` layout with server-side `auth.getUser()` check
- Client-side auth hooks: `useAuth()` and `useProtectedRoute()` for component-level access control
- Client-side state via React hooks; Zod for API request validation; nanoid for listing IDs
- `sonner` for toast notifications (mounted in `(protected)/layout.tsx`)

**Backend services**
- Next.js API routes (`/api/search`) orchestrate the pipeline
- **Auth layer:** `@supabase/ssr` for client + server clients; `proxy.ts` (Next 16 convention, not `middleware.ts`) refreshes session cookie on every request
- `@supabase/supabase-js` v2.x for auth + database access
- **Python sidecar** (`crawl4ai-service/`) — FastAPI + crawl4ai 0.8.6 + Playwright 1.59.0 + litellm + `cachetools` (response cache) + `asyncio.Semaphore` (global render gate) + **configurable browser pool** (`SIDECAR_BROWSER_POOL_SIZE`, default 1; round-robin picker, per-member driver-death recovery) + **per-domain pacer** (min-interval lock per host; defends anti-bot 403s on Depop/Grailed/eBay/Vestiaire)
- Firecrawl (`@mendable/firecrawl-js` v4.23.0) — used **only for search**, not for scraping
- Supabase Postgres — auth users + `public.profiles` (id, email, display_name, avatar_url, **bio**, created_at, updated_at; auto-trigger creates row on signup) + `public.saves` (user_id, listing_url unique-per-user, cached title/price/image/condition/seller, saved_at, **folder_id** nullable FK → collection_folders) + `public.collection_folders` (id, user_id, name, **description**, is_default, created_at; one default per user via partial unique index)
- **Naming reminder:** the `saves` table and `/api/saves` routes are surfaced in the UI as "Collection". Both names refer to the same thing; only UI strings were renamed.
- **"My Collection" is the default folder AND the all-items view.** New saves get `folder_id = <default folder id>` from `ensureDefaultFolder()`. Custom folders filter strictly by `folder_id`. My Collection's GET filter applies no folder restriction — every save renders there regardless. Items orphaned by folder delete (FK `on delete set null`) also show under My Collection automatically.
- Supabase Storage — `avatars` public bucket (2 MB cap; PNG/JPG/WebP). Files stored at `{user_id}/avatar-{timestamp}.{ext}`. RLS scopes write access to own folder.
- **Permissions gotcha:** RLS policies alone are not sufficient. Each public table also needs `GRANT SELECT/INSERT/UPDATE/DELETE ON public.<table> TO authenticated` — without it, every request returns Postgres `42501 permission denied`.

**LLM**
- OpenAI `gpt-4o-mini` is the default extraction model (via litellm, configured in `.env`)
- Gemini `gemini-2.0-flash` is the backup; rate-limits hard so used only on opt-in
- Do **not** default to Anthropic/Groq/Mistral/local — no card on file for those

---

## 3. Architecture (current — as of 2026-05-18)

```
User (unauthenticated)
       │
       ▼ visit /
       ↓
proxy.ts (refreshes auth cookie)
       │
       ├─ not signed in? → redirect to /login
       │  /login: email/password signup, email/password signin, Google OAuth, forgot password flow
       │  /check-email: email confirmation (after signup or password reset)
       │  /auth/reset-password: set new password via email link
       │
       └─ signed in?
          ▼ allow → /
          ↓
          SearchForm (protected route, requires auth.getUser())
          │ POST /api/search
          ▼
POST /api/search ─────────────────────────────────────────────┐
       │                                                       │
       │  allSettledWithConcurrency(platforms, K)              │
       │    K = SEARCH_PLATFORM_CONCURRENCY (default 3)        │
       │    overflow platforms queue and drain                 │
       │                                                       │
       │  for each platform (cap K parallel):                  │
       │    1. Firecrawl search:  site:<domain> <query>        │  Firecrawl
       │       → returns 15 candidate URLs                     │  (2 credits/
       │    2. filterListingUrls() — regex per platform        │   platform)
       │    3. dedupe                                          │
       │                                                       │
       │  for each URL (concurrency 2 per platform):           │
       │    4. scrapeListing(url, platform)                    │
       │       ↓                                               │
       │       scrapeViaSidecar() in lib/scraper.ts            │
       │       ↓                                               │
       │       POST http://localhost:8000/scrape ──────────────┼─→ Python sidecar
       │                                                       │   ↓
       │  5. parseScrapedListings() — drop sold, map fields    │   ├─ TTLCache hit? → log cache=hit, return
       │  6. aggregate prices, return SearchResponse           │   ├─ _driver_dead (entire pool)? → 503 fast-fail
       ▼                                                       │   ├─ _scheduled_render(platform, url):
   UI: tabbed results + min/max/avg price summary              │   │     • B2: per-domain pace (lock + min-interval)
                                                               │   │     • A1: acquire _render_semaphore (cap N)
                                                               │   │     • B3: log [scrape] in_flight=… pool=K/M
                                                               │   │     • B1: pick alive pool member via round-robin
                                                               │   │       → crawler.arun(...) → structured / LLM
                                                               │   └─ on success: store in TTLCache, return
                                                               │
                                                               │  N    = SIDECAR_MAX_CONCURRENT_RENDERS (default 6)
                                                               │  K/M  = pool_alive / pool_size (SIDECAR_BROWSER_POOL_SIZE, default 1)
                                                               ▼
```

**Load-management invariants (PR 1 + PR 2 of `1-3-4-sound-like-a-prancy-waterfall`):**
- Across-platform cap (`SEARCH_PLATFORM_CONCURRENCY`) × per-platform scrape cap (2) ≤ sidecar semaphore (`SIDECAR_MAX_CONCURRENT_RENDERS`). Keep the math working when tuning.
- Browser pool (`SIDECAR_BROWSER_POOL_SIZE`, default 1) shares the global render semaphore — pool size only changes *where* renders run, not *how many*. Pool=1 behaves identically to pre-B1.
- Per-domain pacing: `DOMAIN_MIN_INTERVAL_MS` in [main.py](crawl4ai-service/main.py) sets a min gap between consecutive renders to the same host (Depop/Grailed=400ms, eBay/Vestiaire=300ms, others=150ms). Waits OUTSIDE the semaphore.
- `/scrape` cached per-URL for 30 min, `/scrape-search` per `platform::query` for 10 min. Only successful, non-empty results land in cache; failures retry next time.
- Driver-death detection auto-restarts the affected pool member in ~2-3s. Other pool members keep serving during the restart. Service-wide 503 only when the **entire pool** is dead.
- `GET /health` includes `crawler_alive`, `pool_size`, `pool_alive`, `in_flight`, and `max_concurrent_renders` for monitoring.
- **All scaling guidance — env-var tuning, hosting tier choices, when to enable pool>1 — lives in [SCALING.md](SCALING.md).**

**Saves + Watchlist + Profile editing layer (Phase 2B + 2C, complete as of 2026-05-18):**
- `(protected)/layout.tsx` mounts `<SavesProvider>` wrapping `<WatchlistProvider>` (both React Contexts) and sonner `<Toaster>` once for the whole protected subtree
- `SavesProvider` exposes `{ savedUrls, isSaved, toggleSave, hydrateUrls, refresh, openMoveModal }`. State hydrated via `POST /api/saves/check` (batched), optimistic on toggle, cleared on sign-out. Renders `<MoveToFolderModal>` globally; toggleSave's success toast offers a "Move to folder…" action that opens the modal pre-targeted at the new save_id.
- `WatchlistProvider` exposes `{ watchedUrls, isWatched, toggleWatch, hydrateUrls, refresh }` — same shape; hits `/api/watchlist/check`
- Heart + Eye buttons on `ListingCard` call `toggleSave` / `toggleWatch`. Both hidden when signed out; both follow the same hover-visibility rule. Independent features.
- `/profile` server component fetches the `profiles` row, renders `ProfileHeader` + tabs (Saves | Watchlist)
- `WatchlistTab` has a **"Refresh prices"** button → `POST /api/watchlist/refresh` → re-scrapes all rows via `scrapeViaSidecar` at concurrency 4, updates `price_current` / `is_sold` / `last_checked_at`. Auto-refresh-on-login is deferred to Phase 2D.
- "Edit profile" → `EditProfileModal` (avatar upload via browser Supabase client → public bucket → PATCH `/api/profile` with new `avatar_url`)
- `/settings` is a standalone page (not a tab)

**Auth layer (new in Phase 2A, complete as of 2026-05-17):**
- `proxy.ts` (Next 16 convention) runs on every request to refresh the Supabase session cookie before route handlers see it
- Server-side auth check in `app/(protected)/layout.tsx`: calls `auth.getUser()` and redirects to `/login` if no session
- Client-side hooks: `useAuth()` returns `{ user, loading }` for conditional rendering; `useProtectedRoute()` triggers a redirect if not authenticated
- Sign-up flow: email → confirm email → auto-creates `public.profiles` row via Supabase trigger
- Protected search page: moved from `/app/page.tsx` to `/app/(protected)/page.tsx`; users who sign out are immediately redirected to `/login` if they try to access it

**Key change vs. the original Firecrawl-only design:** the **scrape** step used to cost 9–10 Firecrawl credits per page. It now goes through a local Playwright + LLM pipeline, costing ~$0.0005–$0.002 per page in OpenAI tokens. Firecrawl is retained only for the **search** step (2 credits per platform per query), where it's still the cheapest option.

---

## 4. File Structure

```
fashion-crawler-crawl4ai/
├── .env                              ← LLM_PROVIDER, OPENAI_API_KEY, FIRECRAWL_API_KEY, SUPABASE_URL, SUPABASE_KEY, etc.
├── proxy.ts                          ← Next 16 auth middleware (refreshes session cookie on every request)
├── HANDOFF.md                        ← this file
├── package.json                      ← scripts: dev, dev:sidecar, dev:all, build
│
├── app/
│   ├── api/
│   │   ├── search/route.ts           ← orchestrator (POST /api/search)
│   │   ├── saves/
│   │   │   ├── route.ts              ← POST (save; seeds default folder, accepts folder_id), GET (list w/ ?search=&platform=&folder_id=), DELETE (?url=)
│   │   │   ├── [id]/route.ts         ← DELETE by save id, PATCH {folder_id} for move-to-folder
│   │   │   └── check/route.ts        ← POST batch URL check { urls } → { saved_urls }
│   │   ├── collection-folders/
│   │   │   ├── route.ts              ← GET (list w/ item_count + description; default's item_count = total saves), POST {name, description?} (create)
│   │   │   └── [id]/route.ts         ← PATCH {name?, description?} (rename non-default; description allowed for any), DELETE (?cascade=true permanently deletes items; otherwise items orphan to null and render under My Collection)
│   │   ├── watchlist/
│   │   │   ├── route.ts              ← POST (add), GET (list w/ ?search=&platform=), DELETE (?url=)
│   │   │   ├── [id]/route.ts         ← DELETE by watch id (used by WatchlistTab remove)
│   │   │   ├── check/route.ts        ← POST batch URL check { urls } → { watched_urls }
│   │   │   └── refresh/route.ts      ← POST re-scrape all rows via sidecar (concurrency 4)
│   │   ├── profile/route.ts          ← PATCH display_name / bio / avatar_url
│   │   └── auth/callback/route.ts    ← Supabase OAuth/password-reset callback handler
│   ├── (protected)/                  ← auth-protected route group
│   │   ├── layout.tsx                ← auth guard + mounts <SavesProvider> → <WatchlistProvider> + <Toaster>
│   │   ├── page.tsx                  ← search page (requires auth)
│   │   ├── profile/page.tsx          ← profile page (server: fetches profiles row → renders header + tabs)
│   │   └── settings/page.tsx        ← standalone settings page (placeholder)
│   ├── auth/
│   │   ├── reset-password/page.tsx   ← password reset form (via email link)
│   │   └── callback/route.ts         ← OAuth/password reset callback
│   ├── login/page.tsx                ← auth page (sign in + sign up tabs, Google OAuth, forgot password)
│   ├── check-email/page.tsx          ← confirmation screen (after signup or password-reset email sent)
│   ├── components/
│   │   ├── AuthCard.tsx              ← shared auth UI wrapper (logo, gradient background, theme-aware)
│   │   ├── AuthButton.tsx            ← session-aware nav button (dropdown: Profile / Settings / Sign out)
│   │   ├── SavesProvider.tsx         ← Context: savedUrls Set, optimistic toggleSave, hydrate batch, openMoveModal; renders <MoveToFolderModal> globally
│   │   ├── MoveToFolderModal.tsx     ← shared folder-picker modal (used by toast action + card 3-dot menu)
│   │   ├── WatchlistProvider.tsx     ← Context: watchedUrls Set, optimistic toggleWatch, hydrate batch
│   │   ├── SearchForm.tsx            ← query + platform checkboxes
│   │   ├── SearchSection.tsx         ← client state container
│   │   ├── ResultsDisplay.tsx        ← tabbed results grid + calls hydrateUrls() per search
│   │   ├── ListingCard.tsx           ← single listing card + heart + eye buttons (hidden when signed out)
│   │   ├── PriceSummary.tsx          ← min/max/avg stats bar
│   │   └── profile/
│   │       ├── ProfileHeader.tsx     ← client: avatar + name + email + joined + bio + Edit button
│   │       ├── EditProfileModal.tsx  ← modal: avatar upload → Supabase Storage; PATCH /api/profile
│   │       ├── ProfileTabsClient.tsx ← Saves | Watchlist tabs (URL-driven via ?tab=)
│   │       ├── SavesTab.tsx          ← "Collection" tab: folder pill row + cards-view skeleton + view-mode toggle (localStorage.collectionViewMode), 3-dot card menu (Move/Remove), branched empty states; price stripped from cards
│   │       └── WatchlistTab.tsx      ← grid + Refresh prices button + price delta chip + Sold badge
│   ├── layout.tsx                    ← root layout (suppressHydrationWarning for Grammarly)
│   └── globals.css                   ← Tailwind v4 + CSS vars + theme tokens
│
├── lib/
│   ├── types.ts                      ← PLATFORM_DOMAINS, PLATFORM_NAMES, Listing, SearchResponse, Save (now w/ folder_id), CollectionFolder, Watchlist, Profile
│   ├── filterOptions.ts              ← NEW 2026-05-20: FilterState + COLOR/CATEGORY/CONDITION/SIZE option tables (shared client/server); FilterPanel.tsx re-exports for backward compat
│   ├── sizeFilter.ts                 ← matchListingSize(title, sizeKey, rawSize?) + matchRawSize() + detectSizeFromQuery(query); checks structured `Listing.size` first, falls back to title regex. Applied to ALL platforms (not just ThredUp) as of 2026-05-20.
│   ├── collectionFolders.ts          ← ensureDefaultFolder(supabase, userId) — idempotent lazy seed of "My Collection"
│   ├── firecrawl.ts                  ← searchPlatform() (Firecrawl); scrapeListing() delegates to sidecar
│   ├── scraper.ts                    ← HTTP client for the Python sidecar
│   ├── parse.ts                      ← filterListingUrls(), parseScrapedListings()
│   ├── supabase/
│   │   ├── client.ts                 ← createBrowserClient() for Client Components
│   │   └── server.ts                 ← createServerClient() + async cookies() for Server Components / Route Handlers
│   └── hooks/
│       ├── useAuth.ts                ← useAuth() { user, loading } and useProtectedRoute() hooks
│       └── ... (other hooks as needed)
│
├── crawl4ai-service/                 ← Python sidecar (replaces Firecrawl scrape)
│   ├── main.py                       ← FastAPI app, /scrape + /scrape-search + /health endpoints; structured-first → LLM fallback
│   ├── extractors.py                 ← LISTING_SCHEMA + PLATFORM_PROMPTS + per-platform options (LLM fallback tier)
│   ├── structured_extractors.py     ← JSON-LD + testid extractors for single-listing pages (primary tier for 9 platforms — depop, grailed, poshmark, stockx, mercari, vinted, thredup, ebay, vestiaire)
│   ├── search_page_extractors.py    ← NEW 2026-05-18: SEARCH_PAGE_PLATFORMS + grid extractors for platforms whose listing URLs aren't indexed (currently: ThredUp)
│   ├── debug_probe.py                ← dumps OG/JSON-LD/__NEXT_DATA__/visible-$ from a URL; for future debugging
│   ├── debug_dumps/                  ← saved raw HTML from probe runs (gitignored)
│   ├── requirements.txt
│   ├── venv/                         ← already provisioned; crawl4ai, playwright, fastapi, beautifulsoup4 installed
│   └── README.md
│
└── scripts/
    ├── test-all-platforms.mjs        ← NEW: smoke-tests sidecar across all 8 platforms (~16 Firecrawl credits, search only)
    ├── diagnose-counts.mjs           ← URL-filter pass rates (3 search credits)
    ├── diagnose-scrape.mjs           ← 3 URLs per platform (sequential, used to test Firecrawl — still works as a baseline)
    ├── diagnose-parallel.mjs         ← reproduces old timeout issue at full parallel load
    ├── diagnose-grailed.mjs          ← measures Grailed sold rate
    └── test-scrape*.mjs              ← legacy Firecrawl scrape tests
```

---

## 5. The Sidecar (`crawl4ai-service/`)

This is where the Firecrawl-replacement lives. Treat it as a separate process that the Next.js API talks to over HTTP on `localhost:8000`.

### Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Returns `{status, llm_mode: "active"\|"stub", provider}`. Use to verify the API key is loaded. |
| `POST` | `/scrape` | Body: `{url, platform}`. Returns `{result: ScrapedListing \| null}`. Mirrors the original Firecrawl-shaped output exactly. Used by all platforms except those in `SEARCH_PAGE_PLATFORMS`. |
| `POST` | `/scrape-search` | Body: `{platform, query, limit?}`. Returns `{results: ScrapedListing[]}`. Builds the platform's onsite search URL, renders once, returns a grid of listings. Used only for `SEARCH_PAGE_PLATFORMS` (currently `{thredup}`) — platforms whose listing URLs aren't indexed by Firecrawl. |

### How it works
1. `main.py` boots a long-lived `AsyncWebCrawler` (Playwright Chromium) with `enable_stealth=True` and `user_agent_mode="random"`.
2. On each `/scrape` request, it renders the page (`wait_until="domcontentloaded"`, `delay_before_return_html=5s`; Poshmark gets 6s; retries get 7s).
3. **Tier 1 — structured extraction** (`structured_extractors.py`): for Grailed/Depop/StockX/Poshmark/Mercari/Vinted, read deterministic signals directly from the raw HTML:
   - **Depop/Grailed**: Schema.org `<script type="application/ld+json">` with `@type: "Product"`. Read `offers.price`, `offers.priceCurrency`, `offers.availability`, `offers.itemCondition`, `name`, `image`.
   - **StockX**: `<h2 data-testid="trade-box-buy-amount">` for Lowest Ask. If missing but title present → listing has no Ask → return `price=None`. If both missing → fall back to LLM.
   - **Poshmark**: `og:type=product` gate, `og:title`/`og:image`, first `<p class="h1"><span>$N</span></p>` for price, `data-et-prop-inventory_status` for sold. **No JSON-LD** — Poshmark doesn't emit it.
   - **Mercari**: `__NEXT_DATA__.props.pageProps.serverState['ItemDetail:<id>']` → `price` (CENTS!), `name`, `photos[0].imageUrl`, `status`. **Do NOT use `og:image`** — it's a generic placeholder.
   - **Vinted**: regex over escaped Next.js RSC payload for `\"price\":{\"amount\":\"<n>\",\"currency_code\":\"<c>\"}` (underscored — listing pricing). `og:image` for photo. Strip `" | Vinted"` from `og:title`.
   - No LLM call, deterministic, costs nothing.
4. **Tier 2 — LLM fallback**: if tier 1 returns None, run the original `LLMExtractionStrategy` flow:
   - converts rendered markdown via `target_elements` scope (limits LLM to the main product container — drops "Similar Items", "Last Sale", footer, etc.)
   - sends scoped markdown + schema + platform prompt to OpenAI via litellm
   - parses the LLM's JSON response back into the `ScrapedListing` shape
5. If `LLM_PROVIDER` is empty or its API key is missing, the sidecar runs in **stub mode** — it still fetches pages and runs tier 1, falling through to title-only output when tier 1 misses. `/health` will report `llm_mode: "stub"`.

### Schema & prompts (in `extractors.py`)
- `LISTING_SCHEMA` — the canonical JSON shape (title, price, currency, isSold, condition, imageUrl). **Do not change without updating `lib/parse.ts` and the UI in lockstep.**
- `PLATFORM_PROMPTS` — per-platform extraction instructions for the LLM fallback (StockX: "Lowest Ask, not Last Sale/Highest Bid"; Grailed: detect sold badge; Depop: capture discounted not strikethrough price; Poshmark: ignore related listings).
- `PLATFORM_CRAWLER_OPTIONS` — per-platform crawler tweaks:
  - `word_count_threshold: 0` for Depop/eBay (keeps short price chips that the default filter strips).
  - `target_elements: [...]` for Grailed/Depop/StockX/Poshmark — scopes the LLM-fallback view to the main product container. **Gated to the LLM tier only** (`scope_to_target=True` in `main.py`); tier 1 reads raw HTML so `<head>` meta + `<script>` JSON-LD survive.
- `PLATFORM_EXTRACTION_OPTIONS` — per-platform LLM-strategy tweaks. eBay sets `apply_chunking: True` because its listing pages render to ~50K chars of markdown.

### Structured extractors (in `structured_extractors.py`)
Each per-platform function returns the canonical `ScrapedListing`-shaped dict or `None` (fall through to LLM).

| Platform | Mechanism | Notes |
|---|---|---|
| `extract_depop` | Schema.org JSON-LD Product → `offers.price` | Page must render for ~5s before the JSON-LD paints. |
| `extract_grailed` | Schema.org JSON-LD Product → `offers.price` | Same. |
| `extract_stockx` | CSS: `[data-testid="trade-box-buy-amount"]` | If absent but title present → price=`None` (genuinely no Ask). If both absent → return None → LLM fallback. |
| `extract_poshmark` | `og:title` + `og:image` + `<p class="h1"><span>$N</span></p>` | Gated by `og:type=product`. Sold via `data-et-prop-inventory_status`. **Does NOT use JSON-LD** — Poshmark doesn't emit it. |
| `extract_mercari` | `__NEXT_DATA__.props.pageProps.serverState['ItemDetail:<id>']` | Price in **cents** — divide by 100. Image from `photos[0].imageUrl` (never `og:image` — it's a placeholder). |
| `extract_vinted` | Regex over escaped RSC payload for `\"price\":{\"amount\":\"<n>\",\"currency_code\":\"<c>\"}` (underscored), `og:image` for photo | First match wins. Strips `" \| Vinted"` from `og:title`. |

Shared helpers:
- Schema.org availability tokens (`outofstock`, `soldout`, `discontinued`) → `isSold: true`.
- Schema.org `itemCondition` (`NewCondition`, `UsedCondition`, `RefurbishedCondition`, `DamagedCondition`) → `"New"`/`"Used"`/`"Refurbished"`/`"Damaged"`.

### Critical config gotchas (don't undo these)
- `BrowserConfig(headless=True, verbose=False, enable_stealth=True, user_agent_mode="random")` in `main.py`. Stealth is required for StockX and was attempted for eBay (still insufficient — see below).
- **Do not enable** `light_mode`, `text_mode`, or `memory_saving_mode` on `BrowserConfig`. They break extraction on React/Vue SPA sites (Grailed, Depop, StockX) by disrupting JS rendering. Comment in `main.py` documents this.
- `apply_chunking=False` is the default; only eBay overrides it to True.

---

## 6. Status by Platform (verified 2026-05-15, updated 2026-05-19 with engine bake-off data)

Primary test: single live run via `scripts/test-all-platforms.mjs` with query "Nike Air Jordan 1" against the live sidecar (`llm_mode: active`, provider `openai/gpt-4o-mini`). **Updated 2026-05-19** with results from the engine bake-off (72 URLs × 2 engines; see [docs/engine_bakeoff_findings.md](docs/engine_bakeoff_findings.md) for full data).

| Platform | Scrape works? | Notes |
|---|:-:|---|
| **Grailed** | ✅ | JSON-LD Product → reliable. LLM fallback if JSON-LD missing. |
| **Depop** | ✅ | JSON-LD Product → reliable. **Fixed 2026-05-15 PM**: was returning related-item prices ($39.55 instead of $45). Root cause was 1.5s render delay + LLM seeing "More from seller" rail. |
| **StockX** | ⚠️ partial | `[data-testid="trade-box-buy-amount"]` → reliable when present. **Known caveat (deferred)**: StockX prices change in real time — a $74 ask scraped now can be $87 by the time the user clicks. Sometimes the testid contains a stale or cached value that doesn't match the live page (observed on `…fleece-hoodie-black`, `…fleece-hoodie-jet-black`, `…modern-fleece-hoodie-jet-black`). Listings with no Lowest Ask correctly return `price=null`. See §7 (E) for the full deferred-issues list. |
| **Poshmark** | ✅ | `og:title` + `og:image` + first `<p class="h1"><span>$N</span></p>` price + `data-et-prop-inventory_status` for sold. **Fixed 2026-05-15 evening**: the prior JSON-LD extractor was always missing (Poshmark doesn't emit Schema.org JSON-LD), forcing LLM fallback. Navigation-retry (2026-05-15 AM) is still needed for anti-bot redirects. |
| **Mercari** | ✅ | `__NEXT_DATA__.props.pageProps.serverState['ItemDetail:<id>']` → `price` (cents → /100), `name`, `photos[0].imageUrl`, `status`. **Fixed 2026-05-15 evening**: was returning related-item prices ($75 vs $110, $47 vs $115) AND `og:image` placeholder (the green-checkmark / generic Mercari OGP image). |
| **Vinted** | ✅ | Regex match in escaped Next.js RSC payload for `\"price\":{\"amount\":\"<num>\",\"currency_code\":\"<code>\"}` (note **underscored** `currency_code` — listing pricing; `currencyCode` is shipping). `og:image` for the real product photo. **Fixed 2026-05-15 evening**: previously returning CZK shipping-option prices instead of USD item prices, and a checkmark-icon image URL instead of the photo. |
| **eBay** | ⚠️ intermittent | **Structured tier 1 added 2026-05-21 (C1)** — eBay `/itm/` pages emit Schema.org `Product` JSON-LD; tier 1 hits skip the LLM entirely. Fetch reliability is still the bottleneck: intermittent Akamai blocks remain (May 2026 bake-off: 2/2 prices on real `/itm/` URLs, p95 90s). On fetch failure the cascade falls back to LLM as before. See §7 (A). |
| **Vestiaire Collective** | ❌ deferred (discovery) | **Structured tier 1 added 2026-05-21 (C1)** — when a Vestiaire listing URL can be obtained from elsewhere (e.g. user paste, watchlist), scraping is reliable and skips the LLM. URL **discovery** is still the blocker — Firecrawl's `site:vestiairecollective.com` returns 0 results, so search-flow Vestiaire results depend on whatever crumbs Firecrawl does find. See §7 (B). |
| **ThredUp** | ✅ | **Search-page extraction** — bypasses Firecrawl entirely. Sidecar's `/scrape-search` renders `https://www.thredup.com/search/<hyphen-slug>` and parses the JSON-LD `Product` array (119 items per page) merged with a DOM SKU→`/product/<slug>/<sku>` href map. Returns ScrapedListing[] in one render. Verified 2026-05-18 against two queries. **Size accuracy (2026-05-20):** route pulls 100 from the single page and post-filters by size against the title (`lib/sizeFilter.ts`), since ThredUp's onsite search is fuzzy on size words and the `/search/` URL ignores `size=` / `size_tags=` params. Not in `DEFAULT_PLATFORMS` — opt-in via FilterPanel. |
| **The RealReal** | ❌ deferred | PerimeterX press-and-hold defeats `UndetectedAdapter` + managed profile. **Extractor + sidecar dispatch are wired** but gated on `REALREAL_ENABLED` env var; without it the platform returns `{"results":[]}` instantly. URL pattern is `/products?keywords=<query>`; data source is `__NEXT_DATA__.props.pageProps.serverResult.data.products.edges` (verified offline). See §7 (G) for the deferral details and re-enable steps. |

### 6.5 What we tried (2026-05-15 PM debug iteration) — what worked, what didn't

User reported wrong Depop prices (e.g. listing was $45, we returned $39.55) and StockX prices appearing where the page had no Ask. This section captures the iterations so future-you doesn't re-walk the same path.

**Attempt 1 (failed): Open Graph product meta tags (`og:price:amount`, `product:price:amount`).**
- Assumption was these would be in `<head>` for all four sites.
- Reality (verified via `debug_probe.py`): **Depop and StockX emit NO product OG meta tags** on listing pages. The OG approach extracted 0 fields → fell through to LLM every time. Removed. See git history for `OG_PRODUCT_SCHEMA`.

**Attempt 2 (failed): bump `delay_before_return_html` from 1.5s → 3s, keep LLM extraction.**
- Improvement, but the LLM still occasionally grabbed prices from "More from seller" / "Similar items" rails because the markdown contained both the listing AND those sections.

**Attempt 3 (succeeded): structured-data extraction tier (`structured_extractors.py`).**
- Probed raw HTML with `debug_probe.py` to discover:
  - **Depop**: emits Schema.org JSON-LD `<script type="application/ld+json">` with `@type: "Product"` and `offers.price = "45.00"` for jeff250 — the actual listing price.
  - **StockX**: does NOT emit listing-level JSON-LD with the Ask. `__NEXT_DATA__` only contains i18n strings (market data is loaded client-side via React Query post-hydration). The Lowest Ask lives in `<h2 data-testid="trade-box-buy-amount">$74</h2>`. Related-product carousel asks use `data-testid="product-tile-lowest-ask-amount"` — must be ignored.
- **Critical realization**: StockX's "There are no Asks at this time" string is in the i18n bundle ALWAYS, regardless of whether the listing actually has an Ask. Don't use the string as a signal — use whether `trade-box-buy-amount` actually contains a value.
- Bumped `delay_before_return_html` to 5s (Depop's JSON-LD wasn't even in the HTML before this — page hadn't painted).
- End-to-end verification (live, against the running sidecar, 2026-05-15 PM):
  - Depop jeff250 → **$45.00** ✓ (was $39.55)
  - Depop finnbra → **$40.00** ✓ (was $32.20)
  - StockX FW24 → **$74** ✓ (was correct in dump but raced; structured-tier still right)
  - StockX SS25 → **price=null** ✓ (correctly reflects "no Asks"; was a hallucinated number before)

**Gotchas discovered during this iteration**:
1. `cleaned_html` from crawl4ai strips `<script>` tags. **For structured extraction, read `result.html` (raw), not `result.cleaned_html`**, or JSON-LD blocks vanish.
2. `target_elements` in `CrawlerRunConfig` scopes the markdown to that element and drops `<head>`. **Gate it to the LLM-fallback tier only** (`scope_to_target=True`); tier 1 needs full HTML.
3. `wait_until="networkidle"` times out on Depop/StockX (~45s) because they hold long-lived telemetry connections. Use `wait_until="domcontentloaded"` + a longer `delay_before_return_html` instead.
4. StockX's main listing Ask is rendered client-side; if the page didn't fully paint, the testid will be missing. `extract_stockx` returns None when **both** title and price are missing (page didn't render) but a valid dict with `price=None` when only the Ask is missing (genuinely no Ask).
5. StockX prices change in real time — a $74 ask scraped now can be $87 by the time the user clicks. That's not a scraper bug.

### 6.5b Third iteration (2026-05-15 evening) — Mercari, Vinted, Poshmark

User flagged: Mercari prices off (75 vs 110, 38 vs 42.75, 47 vs 115) and showing no/wrong pictures; Vinted prices correct but pictures showed a "green checkmark" icon and one listing was labeled CZK; Poshmark only returning 1 result despite multiple successful crawls (because the structured extractor always missed and the LLM fallback was the only thing that ever succeeded).

**Probe findings** (via `debug_probe.py` with 6s render delay):
- **Mercari**: no JSON-LD, no OG product meta. **`__NEXT_DATA__`** is the answer:
  - Path: `props.pageProps.serverState['ItemDetail:m21075527136']`
  - `price = 11000` — **CENTS, not dollars**. Divide by 100.
  - `name` → title; `photos[0].imageUrl` → real product photo
  - `status` enum: `"on_sale"` (available) vs `"sold_out"`/`"trading"`/`"completed"` (sold)
  - **`og:image` is a generic Mercari OGP placeholder (`ogp_image_1.png`) — the "green checkmark" the user saw was this placeholder. Use `photos[0].imageUrl` instead.**
- **Vinted**: no JSON-LD, no `__NEXT_DATA__`. Uses Next.js RSC streaming. The price lives in inline `<script>` tags as escaped JSON. Two key patterns:
  - `\"price\":{\"amount\":\"75.0\",\"currency_code\":\"USD\"}` — **listing pricing block**, underscored `currency_code`
  - `\"price\":{\"amount\":\"40\",\"currencyCode\":\"CZK\"}` — **shipping option** (per-market), camelCase `currencyCode`
  - Easy to mistake one for the other. The CZK number was a Czech shipping option, not the item price. **Match only the underscored variant.**
  - `og:image` IS the real product photo on Vinted (unlike Mercari). Use it.
  - `og:title` includes a `" | Vinted"` suffix — strip it.
- **Poshmark**: no JSON-LD, no `__NEXT_DATA__`. But:
  - `<meta property="og:type" content="product">` confirms it's a listing page (anti-bot walls won't have this)
  - `<meta property="og:title">` and `<meta property="og:image">` are present and correct
  - The main listing price is in `<p class="h1"><span>$68</span><span>$180</span></p>` — first span is listing, second is original/MSRP
  - `data-et-prop-listing_price="68"` (tracking attr) is also clean, but only appears on tile elements
  - `data-et-prop-inventory_status="available"|"sold"` is the sold signal

**Gotchas discovered**:
6. **Mercari prices are in CENTS in `__NEXT_DATA__`** — `11000` is $110.00. Forgetting `/100` will multiply the number by 100x.
7. **Mercari's `og:image` is a static placeholder** (`u-web-assets.mercdn.net/.../ogp_image_1.png`). Never use it — always use `photos[0].imageUrl` from `__NEXT_DATA__`.
8. **Vinted's RSC payload is double-escaped**: actual bytes are `\"price\":{\"amount\":\"75.0\"...` (backslash + quote, but `{` is NOT escaped). Regex must use `\\"price\\":\{\\"amount\\":...` — literal-backslash literal-quote for the field markers but a plain `\{` for the brace. **Off-by-one is easy to introduce here.** First version had `\\{` (literal `\{`) and matched nothing.
9. **Vinted's `currency_code` (underscored) vs `currencyCode` (camelCase) means very different things.** The underscored version is the item's listing pricing block. The camelCase version is a per-market shipping-option block — it can carry CZK, EUR, etc. even for a USD listing. Always match the underscored form.
10. **Vinted's RSC payload includes multiple `currency_code` matches** (item price, service fee, total). The **first** match is the item price. Subsequent matches are derived.
11. **Poshmark's `og:type=product`** distinguishes a real listing page from an anti-bot wall or login redirect — use it as a gate before parsing.
12. **Poshmark doesn't emit JSON-LD on listing pages**. The prior `extract_poshmark` that called `_extract_from_jsonld` always returned `None` — every Poshmark scrape was hitting LLM fallback. Don't add platforms to the generic JSON-LD extractor without verifying they actually emit Schema.org.

**Verification (live sidecar, 2026-05-15 evening)** — all 6 URLs the user flagged returned correct results:

| URL | Old | New | Truth |
|---|---|---|---|
| Mercari m21075527136 | $75 + placeholder image | **$110.00 + real photo** | $110 ✓ |
| Mercari m59794235815 | $38 + placeholder image | **$42.75 + real photo** | $42.75 ✓ |
| Mercari m14419494382 | $47 + placeholder image | **$115.00 + real photo** | $115 ✓ |
| Vinted 8139626124 | (price OK) + checkmark icon | **$75 USD + real photo** | $75 ✓ |
| Vinted 7287762265 | (price OK in CZK) + icon | **$32.25 USD + real photo** | $32.25 USD ✓ |
| Poshmark State-Black-Hoodie | LLM fallback (slow/flaky) | **$68 + real photo** (structured) | $68 ✓ |

### 6.5c Fourth iteration (2026-05-15 late evening) — overlay-removal corruption + Poshmark sold

User reported a sold Poshmark listing surfacing as available (NWT FullZip URL ending `…681ccba7db3a6f2599b10120`) and asked whether the recurring `Page.content: Unable to retrieve content because the page is navigating` was an anti-bot measure with a workaround.

**Smoking gun:** the live sidecar returned `price=100, isSold=false, image=icon-seller-discount.png` for that URL, while a local `extract_poshmark()` call on the same URL's HTML returned `price=$81, isSold=true, image=real photo`. Same code, different HTML.

**Root cause:** the sidecar's `CrawlerRunConfig(remove_overlay_elements=True)` was different from `debug_probe.py`'s `False`. Comparing both with identical wait/delay/UA:

| overlay_elements | html length | has `og:type="product"` | extractor result |
|---|---|---|---|
| ON (sidecar) | 762KB | ❌ NO | `None` (miss → LLM hallucinates) |
| OFF (probe)  | 534KB | ✅ YES | correct (sold detected, real photo) |

The overlay-removal JS runs inside the page; on Poshmark it either triggers a navigation (logged as `Failed to remove overlay elements: Execution context was destroyed`) or mutates the DOM such that the post-removal HTML is *larger* but missing key SSR meta tags. Disabling overlay-removal fixes Poshmark AND silences the cascading "page is navigating" warnings across all platforms.

The "anti-bot" the user asked about wasn't from Poshmark — **it was our own JS** trying to clean up overlays on a page that was still loading.

**Verification (overlay=OFF, against all working platforms):**

| Platform | URL | Result |
|---|---|---|
| Depop | jeff250 | $45.00 ✓ |
| Grailed | 94836806 | $75 ✓ |
| StockX | fw24-black | $74 ✓ |
| Mercari | m21075527136 | $110.00 ✓ |
| Vinted | 8139626124 | $75 USD ✓ |
| Poshmark SOLD | NWT-FullZip | $81 + isSold=true ✓ (was price=100, isSold=false) |
| Poshmark AVAILABLE | State-Black | $68 + isSold=false ✓ |

**Sold-detection trap:** Poshmark's CSS for the sold-banner (`.listing__status-banner__title--sold { font-weight:500; color:#aa2516 }`) is defined inside the page's `<style>` block on **every** listing, not just sold ones. A naive `'listing__status-banner__title--sold' in html` substring check matches the CSS rule definition and false-fires for available listings. Use `BeautifulSoup(html).find(class_="listing__status-banner__title--sold")` to query the actual rendered DOM element.

**Three-signal sold detection on Poshmark (any one fires)**:
1. `data-et-prop-inventory_status="sold_out"` (tracking attribute, only on the usage element)
2. `"availability":"…schema.org/OutOfStock"` (embedded microdata)
3. `<element class="listing__status-banner__title--sold">` queried via BeautifulSoup (NOT substring)

### Search-side platform: Phase 1 fixes still apply
The original timeout-fix work (May 13–14, 2026) is intact:
- Concurrency cap: 2 concurrent scrapes per platform (was 5+, then 45 in parallel across platforms, which caused mass timeouts)
- URL dedupe before scraping
- Search limit: 15 per platform (was 10)
- Scrape timeout: 40s
- `Promise.allSettled` so one platform's failure doesn't crash the response

These survived the migration; `app/api/search/route.ts` is unchanged from the Firecrawl era except for what `scrapeListing` now does under the hood, plus the 2026-05-16 streaming conversion described in §6.6.

### 6.6 Streaming search response + live progress bar (2026-05-16)

**Problem:** A full multi-platform search takes 30–60s. Until 2026-05-16 the only UI feedback was the Search button switching to "Searching…", which read as a frozen page.

**Shape of the fix:**
- `POST /api/search` now returns `application/x-ndjson` (one JSON object per `\n`-delimited line) over chunked transfer instead of a single `NextResponse.json(...)` payload.
- Three event types in `lib/types.ts` as the discriminated union `SearchStreamEvent`:
  - `{ type: 'start', query, platforms }` — emitted immediately, lets the UI render a checkpoint per selected platform in the "loading" state.
  - `{ type: 'platform_done', platform, status: 'ok' | 'failed', listings, count, error? }` — emitted the moment a platform settles. Order reflects real completion order (because `await Promise.all(platforms.map(async ...))` writes from inside each platform's resolution callback), not the order of the input array.
  - `{ type: 'final', priceRange, averagePrice }` — emitted after every platform settles. The cross-platform USD price stats logic was lifted verbatim from the old non-streaming response.
- Response headers include `Cache-Control: no-cache, no-transform` and `X-Accel-Buffering: no` to prevent dev-server / proxy buffering. `export const dynamic = 'force-dynamic'` is preserved.
- `SearchForm.tsx` consumes the stream with `res.body!.getReader()` + `TextDecoder({ stream: true })`, splits the buffer on `\n`, parses each line, calls a new `onProgress(event)` prop, and accumulates `platform_done` events into a `Record<string, PlatformResults>` so it can hand `onResults` the same `SearchResponse` shape `ResultsDisplay` already expects. **No change** to `ResultsDisplay`.
- `SearchSection.tsx` owns a new `progress: { platforms, statuses, errors } | null` state. `start` initializes all checkpoints to `loading`; each `platform_done` flips one to `done` or `failed` (carrying the error message into a tooltip).
- `SearchProgress.tsx` (new) renders a horizontal track with N evenly-spaced checkpoints. Fill width = `settled / total`. Loading = pulsing gray dot, done = filled black circle with checkmark, failed = red circle with X. Tailwind only.

**`failed` vs `ok` semantics — gotcha for future implementers:** the checkpoint goes `failed` only when `searchAndScrape(platform, query)` actually throws. eBay (bot-blocked) and Vestiaire (no search hits) currently swallow their failures upstream and return empty arrays, so they appear as `ok` with `count: 0`. If you want them to render as red X, the failure surface needs to be raised inside `searchAndScrape` / `searchPlatform` — that is **out of scope for the progress bar work**, but is the right next step if "search returned nothing" should look different from "platform is broken."

**Verified live (2026-05-16):**
- Curl with 3 platforms (`grailed,mercari,vinted`) for `nike air max 90`: `start` at T+0s, `platform_done` events at T+51s/T+53s/T+54s, `final` at T+54s. Lines arrived as separate chunks, not as one blob.
- Response headers confirmed: `content-type: application/x-ndjson`, `transfer-encoding: chunked`, `x-accel-buffering: no`.
- Single-platform run renders one checkpoint that fills to 100% on completion.
- Multi-platform run with eBay/Vestiaire Collective selected: those platforms still emit `platform_done` (status `ok`, `count: 0`) and do not block the others — confirms the `Promise.all`-based dispatch keeps platforms independent.

**Not yet visually verified by Claude (user should confirm in browser):**
- Visual styling of the progress bar at all sizes (Claude can't open a browser).
- The forced-failure case (sabotage `scrapeListing` to throw for one platform) — would actually render the red-X / tooltip path. Recommended quick test if the failed-state UI matters: add `throw new Error('test')` at the top of `scrapeListing` for one platform in `lib/firecrawl.ts`, run a search, confirm the checkpoint goes red with the tooltip, then revert.

**Out of scope (deferred):**
- Per-URL progress within a platform ("3/5 listings scraped") — would need sidecar protocol changes.
- Cancel / abort button.
- Persisting progress across page reloads.
- Auto-retry on `failed` platforms.

---

## 7. Open Problems & Recommended Next Steps

### A. eBay — intermittent Akamai blocks (extraction itself is now solved)

**Updated 2026-05-21 (post-C1):** the original framing of "every /scrape returns null" is **stale** — the 2026-05-19 bake-off measured 2/2 prices on real `/itm/` URLs, and C1 (this session) added a structured tier-1 extractor that completes 4/5 sampled URLs (one Akamai 403 on one URL). Real symptom today is **intermittent Akamai 403** at fetch time, not an extraction failure. When HTML lands, JSON-LD parsing is reliable.

**Tier 1 (C1, 2026-05-21):** parses Schema.org `Product` JSON-LD from `<script type="application/ld+json">`. Hits skip LLM extraction entirely (~1-2s + ~$0.001-0.005 saved per scrape). See latest-change entry at top of HANDOFF for full verification.

**Remaining problem:** Akamai's edge proxy intermittently 403s — `result.error_message` contains `"Blocked by anti-bot protection: Akamai block (Reference #)"`. When this happens, tier 1 logs `[structured] crawl failed`, the cascade falls through to tier 2 (LLM on the partial response), and ultimately may return `null`. Per-domain pacing (B2, `ebay.com=300ms`) and the existing fingerprint settings reduce but don't eliminate this.

**Options (none implemented yet):**
1. Residential proxy pool — most reliable, real monthly cost.
2. `undetected-chromedriver` or a custom Playwright launch with full fingerprint patching.
3. eBay's official Browse API — requires developer account + OAuth, but cheap/legitimate.
4. C4 paid anti-bot unlocker (ScrapingBee/ZenRows/etc.) routed for `ebay` only — see [SCALING.md §4 C4](SCALING.md#c4--paid-anti-bot-unlocker-last-resort).

### B. Vestiaire Collective — URL discovery gap

**Symptom:** `site:vestiairecollective.com <query>` via Firecrawl returns 0 web results, so the pipeline never has any Vestiaire Collective URLs to scrape. (Memory entry `project_vestiaire_search_gap.md` documents this.)

**Important:** the **scrape side works fine** — given a vestiairecollective.com URL directly, the sidecar extracts price/title/etc. correctly. The gap is purely in URL discovery.

**Proposed fix (to be implemented next session):**
- **Option 1 (recommended):** Crawl `vestiairecollective.com/search/?q=<query>` with the sidecar itself and extract listing URLs from the rendered results page. One extra render per search; no new dependency; keeps everything in-house.
- **Option 2:** Use a different search backend just for Vestiaire Collective (DuckDuckGo HTML, Bing Search API, SerpAPI).
- **Option 3:** Drop Vestiaire Collective.

User has agreed to **option 1** but has chosen to defer implementation. Next steps when picking this up: inspect `vestiairecollective.com/search/` HTML to determine if listing URLs are present in server-rendered HTML or require waiting for client-side hydration, then either parse with a regex/selector or add a second LLM-extraction prompt for "extract listing URLs from this search results page."

### C. Grailed — occasional first-call null

LLM extraction occasionally returns malformed JSON on the first request after a cold sidecar start. Retry succeeds. Not worth fixing yet — UI would already retry as part of the normal search loop. Worth a retry-once-on-null wrapper in `lib/scraper.ts` if it becomes a user-visible problem.

### E. StockX price drift / stale testid (deferred — user request)

**Symptom (2026-05-15 evening, user testing):**
- `…fleece-hoodie-black` → ours: $74, page: $175
- `…fleece-hoodie-jet-black` → ours: $130, page: $195
- `…modern-fleece-hoodie-jet-black` → ours: $542, page: "no Asks at this time"

The structured extractor reads `[data-testid="trade-box-buy-amount"]` faithfully. The value in our scrape *did* appear on the page at scrape time (we confirmed the same number is in the SSR HTML). But by the time the user clicks through, the Ask is gone or has changed dramatically. Two possibilities, both unverified:
1. **Real-time market drift.** StockX asks change as buyers consume them; what we see in SSR is a snapshot, the live page is up-to-date. The `542 → no Asks` case suggests the testid sometimes contains a *cached* Ask that has since been pulled.
2. **SSR vs CSR divergence.** StockX may emit a placeholder/stale value in the SSR HTML and replace it via React Query on hydration. We're reading SSR, not the hydrated DOM.

**User decision:** leave StockX as-is for now; revisit after eBay/anti-bot work. Document and move on.

**Investigation plan when picking back up:**
- Compare `trade-box-buy-amount` in raw SSR HTML vs the DOM after `await page.wait_for_selector("[data-testid='trade-box-buy-amount']"); await page.wait_for_timeout(5000)`.
- If they differ, structured extraction needs to wait for React Query to hydrate (or read the React Query cache out of the DOM).
- If they're the same, the issue is purely market drift and there's nothing to fix — possibly add a "scraped at" timestamp to the UI so users know prices can be stale.
- Check StockX's GraphQL endpoint (`/api/p/v2/products/<slug>/market`) — may be callable directly and would give us the live Ask without scraping.

### F. Depop + Grailed anti-bot 403s reappearing (NEW — observed 2026-05-18 PM during Phase 2C testing)

**Symptom:** during a single "fear of god essentials hoodie" search, the sidecar logged `Blocked by anti-bot protection: HTTP 403 with HTML content` on a subset of Depop and Grailed URLs that have been reliable for weeks. Same query, same session — some URLs scraped fine, others 403'd consistently.

- **Depop** 403 body: 23949 bytes (Depop's challenge page).
- **Grailed** 403 body: 4265 bytes (Grailed's challenge page).
- Failing URLs observed: `depop.com/products/{therealduntdadun, bird1381, incogar}-…`, `grailed.com/listings/{73684073, 75493584, 77960479}-…`. Poshmark URLs in the same run were fine.

**Compounding behavior:** structured-tier 403 → sidecar falls back to LLM tier → re-fetches the SAME URL within ~5s → 403s again (body is the block page, so LLM correctly returns "no extracted content"). We're effectively pinging the same blocked URL twice in a row, which is worse than one attempt.

**Investigation plan (when picking back up):**
1. Add a structured-tier-vs-LLM-tier backoff: if structured fails with HTTP 403 specifically, wait 5–10s (or skip LLM fallback entirely for that URL) so we don't double-burn fingerprint.
2. Lower per-platform search concurrency for Depop + Grailed — possibly serialize their fetches while keeping Poshmark/Mercari/etc parallel.
3. ~~Check whether the `/api/watchlist/refresh` endpoint (concurrency 4 across mixed domains) trips the same wall. If so, stagger by domain.~~ **RESOLVED 2026-05-20** — Tier 1 httpx now uses B2 per-domain pacing; Tier 2/3 inherit the full PR 1/PR 2 stack; concurrency is env-driven via `WATCHLIST_REFRESH_CONCURRENCY`.
4. Audit whether `enable_stealth=True` is still active; consider rotating UA per-request instead of per-session.

**Why this matters for Phase 2D:** auto-refresh-on-login and scheduled cron re-scrapes will dramatically increase request volume per platform. We need to solve the 403 regression before turning on automation, or every refresh will degrade.

### G. The RealReal — PerimeterX press-and-hold (NEW — 2026-05-19)

**Symptom:** Every nav to `therealreal.com/products?keywords=<query>` (and the homepage on warm sessions) returns a 9 KB `px-captcha` HTML page with `<title>Access to this page has been denied</title>`. Inside is `<script src="/ev56mY37/captcha/captcha.js?...">` — PerimeterX's press-and-hold widget. The actual `/products` response would be ~2 MB of rendered HTML with `__NEXT_DATA__.props.pageProps.serverResult.data.products.edges` containing 120 filtered listings.

**Root cause:** PerimeterX (now HUMAN Security) — distinct from Cloudflare; uses fingerprint + behavioral heuristics. crawl4ai's default `enable_stealth=True` is detected. crawl4ai 0.8.6's `UndetectedAdapter` (the documented replacement for `playwright-stealth`) is *also* detected here, even when combined with a managed-browser profile holding fresh login cookies from an interactive `crwl profiles create therealreal` session.

**One puzzling data point** (worth investigating if anyone re-attempts): the *first* run of `probe_therealreal.py` (one-off, deleted at session end) successfully fetched 2 MB of real /products content. Every subsequent run, including via the sidecar, was PX-blocked. Hypothesis: PX issues a short-lived "first contact" cookie that's burned after one request, and our profile preserves something else that signals "this is the second time we've seen this browser fingerprint" → challenge. Could not confirm in the time available.

**Why we didn't ship despite the extractor working:** user pre-decided in the session plan that if managed-profile + UndetectedAdapter failed, we'd defer rather than add Docker (FlareSolverr) or third-party services (Apify, ScrapingBee). See "Latest change (2026-05-19)" at the top for the full scaffolding list and re-enable steps.

**Options when picking back up (cost order):**
1. **Cookie injection from real Chrome.** Log in to TRR in your everyday Chrome, export cookies via Cookie-Editor or DevTools, inject via `BrowserConfig(cookies=[...])` into a clean Playwright session (skip the managed profile entirely). PX sometimes honors human-minted cookies for hours. Brittle.
2. **GraphQL direct call.** TRR's Next.js page fetches via an internal GraphQL endpoint (URL embedded in the SSR HTML if you can capture one). Call `httpx.post` with stored cookies + headers. PX likely guards the API too, but worth ~30 min to confirm.
3. **Crawl4ai upgrade.** If a future crawl4ai version (post-0.8.6) ships a stronger PX bypass, retry with `REALREAL_ENABLED=1` — no code changes needed.
4. **Paid unlocker.** ScrapingBee / ZenRows / Bright Data Web Unlocker ($30-100/mo) reliably defeat PX. User has ruled this out for now.

### H. Engine bake-off + limit sweep — DONE (2026-05-19)

Both ran. Decision: **stay on crawl4ai, ship limit = 10**. Full numbers in [docs/engine_bakeoff_findings.md](docs/engine_bakeoff_findings.md); summary in the "Latest change" block at the top of this doc.

Net new follow-up items spawned by this work: §7 I below (sidecar concurrency at limit 15), and an audit of [filterListingUrls](lib/parse.ts) to confirm category-page filtering catches eBay `/b/` and StockX `/brands/` patterns (~37% of bake-off fixture URLs were non-listings — production filter should be eating these).

### I. Sidecar / Playwright concurrency degradation at load — **RESOLVED 2026-05-20 (PR 1 of `1-3-4-sound-like-a-prancy-waterfall`)**

**Original symptom:** at sufficiently high concurrent in-flight count (~16 renders against one Chromium), the Playwright Node driver subprocess dies (one `WriteUnixTransport` pipe goes `closed=True` for everyone). Every subsequent `BrowserContext.new_page()` returns `"the handler is closed"` instantly; the existing retry logic only checked for a Poshmark-specific navigation-error string, so retries amplified rather than aborted. Originally surfaced by limit_sweep=15 returning 0 listings across every platform; same failure mode triggered locally on 2026-05-20 by selecting all 8 platforms at limit 10 with filters.

**Resolution:** see Latest change at top of file. Three layers:
1. **Sidecar semaphore** (`SIDECAR_MAX_CONCURRENT_RENDERS`, default 6) gates every `crawler.arun(...)` — protects the single Chromium from overload regardless of how many requests the frontend fires.
2. **Driver-death detection + auto-restart** — `_arun_with_retry` and `_warmup_realreal` inspect `result.error_message` for the closed-pipe error family; on match, `_driver_dead = True` and a background `_restart_crawler_once` rebuilds the crawler (2-3s). Subsequent requests get HTTP 503 until restart completes.
3. **Across-platform cap in the Next route** (`SEARCH_PLATFORM_CONCURRENCY`, default 3) — overflow platforms queue via the existing `allSettledWithConcurrency` worker pool, no parallel stampede.

**Verified:** all-platforms repro of the failure now completes in ~3:28 with 62 listings, no driver death, `crawler_alive: true` at end. Induced kill recovers in 2.3s.

**Still recommended for PR 2 (separately scoped):** crawler pool (`SIDECAR_BROWSER_POOL_SIZE`) so a bigger box translates into more throughput, per-domain pacing for Depop/Grailed 403 mitigation (§7 F).

### J. Filter strictness audit — color/category/condition deliberately permissive (2026-05-20)

Audit triggered by size-filter bug fix. Findings:

| Filter | Strict post-filter? | Notes |
|---|---|---|
| size | ✓ yes (2026-05-20) | checks structured `Listing.size` for Grailed/Depop/Poshmark/ThredUp; title regex for ThredUp-style |
| price (min/max) | ✓ yes | numeric, in `matchListingPrice` |
| color | ✗ no | only the Off-White/white brand-collision post-filter; otherwise relies on query-suffix + platform fuzzy search |
| category | ✗ no | query-suffix only |
| condition | ✗ no | query-suffix only (even though `ScrapedListing.condition` IS extracted) |

**User decision:** keep color/category/condition permissive. Reasoning: these three are inherently fuzzy ("Like New" vs "New", "navy" vs "blue", "hoodie" = tops or outerwear?), so a strict post-filter would drop too many listings the user actually wants. Pattern going forward: add **narrowly-targeted** post-filters only when a specific semantic collision shows up (like the Off-White case) — don't add broad strict filters.

Do NOT re-propose strict filters here without a specific bad-case bug to motivate them.

### D. Carryover from Phase 1 (still open)

- **Grailed ~83% sold rate** — Google indexes lots of sold Grailed listings; nothing to do without paying for more search results or finding a different discovery method.
- **Depop GBP/EUR listings** — currency badge handles UI flagging; FX conversion would be a nice-to-have.
- **No pagination** — 15 search results per platform, no "load more."
- **Auth (Phase 2A) DONE**, **Saves + Profile editing (Phase 2B) DONE**, **Watchlist manual refresh (Phase 2C) DONE**, **ThredUp DONE**, **The RealReal scaffolded but DEFERRED** (see §7 G).
- **Still pending:** Watchlist auto-refresh on login (deferred from 2C), price history, seller info, scheduled re-scrape + email price-drop alerts (Phase 2D).

---

## 8. Environment Setup

`.env` at repo root (`/Users/kevingui/Documents/Work/me/fashion-crawler-crawl4ai/.env`) must contain:

```
# Firecrawl — search only, no scraping
FIRECRAWL_API_KEY=fc-...

# LLM provider for the sidecar (litellm format: <provider>/<model>)
LLM_PROVIDER=openai/gpt-4o-mini
OPENAI_API_KEY=sk-proj-...

# Backup provider — switch LLM_PROVIDER above if needed; do not use as default
GEMINI_API_KEY=...

# Optional
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
PORT=8000
```

**Provider rules:**
- Default: OpenAI. Card on file, no rate-limit pain.
- Backup: Gemini. Rate-limits aggressively; only use when OpenAI is unavailable.
- Do **not** silently default to Groq/Anthropic/Mistral/Ollama. No card on those, or local-only.

### Python venv (already provisioned)
- `crawl4ai-service/venv/` — Python 3.11, crawl4ai 0.8.6, playwright 1.59.0, playwright_stealth 2.0.3, fastapi, uvicorn, litellm
- Playwright Chromium binaries at `~/Library/Caches/ms-playwright/chromium-1217` (already installed)
- No reinstall needed unless requirements change

### Running the stack

```bash
# Sidecar only (for testing extraction in isolation)
npm run dev:sidecar
# → uvicorn on :8000

# Full stack (Next.js + sidecar in parallel)
npm run dev:all
# → Next.js on :3000, sidecar on :8000
```

If port 8000 is already taken, `lsof -ti:8000 | xargs kill -9` and retry. The sidecar logs to `/tmp/sidecar.log` when started via the background pattern used during this session.

### Health check

```bash
curl http://localhost:8000/health
# {"status":"ok","llm_mode":"active","provider":"openai/gpt-4o-mini"}
```

If `llm_mode` is `stub`, the API key isn't being read — check `.env` and that `LLM_PROVIDER` matches a known prefix in `main.py`'s `_PROVIDER_KEY_ENV`.

---

## 9. Cost Model

**Sources of truth:** [docs/FIRECRAWL_PRICING.md](docs/FIRECRAWL_PRICING.md) for Firecrawl credit pricing, [docs/engine_bakeoff_findings.md](docs/engine_bakeoff_findings.md) for measured per-search cost and per-platform verdicts. This section is a summary — update those files first when prices change.

| Operation | Cost |
|---|---|
| Firecrawl search (per platform per query, limit=20) | 4 credits |
| Firecrawl scrape (not used in prod today; basic) | 1 credit/URL |
| Firecrawl scrape + JSON format or stealth proxy | 5 credits/URL |
| Sidecar scrape via crawl4ai | $0 (Playwright local) + OpenAI tokens **only** if LLM fallback runs |
| OpenAI tokens (gpt-4o-mini) | $0.15 / 1M input · $0.60 / 1M output |
| Full search across 8 working Firecrawl platforms + ThredUp | 32 Firecrawl credits + ~$0.02 OpenAI (eBay + Vestiaire only) |

### Per-search dollar cost (corrected 2026-05-19)

| Plan | $/credit | Firecrawl per search | OpenAI per search | **Total per search** |
|---|---|---|---|---|
| Hobby ($20/mo, 5,000 cr) | $0.00400 | $0.128 | ~$0.019 | **~$0.147** |
| Standard ($99/mo, 100,000 cr) | $0.00099 | $0.032 | ~$0.019 | **~$0.051** |

OpenAI cost is concentrated on eBay (chunked LLM extraction, ~$0.014/search) and Vestiaire (~$0.005/search). The other 6 working Firecrawl platforms have deterministic structured extractors and use $0 in LLM tokens.

### Cost Summary for Decision-Making (2026-05-19 bake-off data)

**TL;DR:** Ship limit=10. Cost per search increases from $0.10 → $0.22 (Hobby), but listings nearly double (30 → 55) for ~same cost-per-listing (~$0.004–0.005).

| Scenario | Per-search cost (Hobby) | Per-search cost (Standard) | Results | Cost-per-listing |
|---|---|---|---|---|
| **Current production (limit=5)** | **$0.10** | $0.06 | 30 listings, ~25 with price | **$0.004** |
| **Recommended (limit=10)** | **$0.22** | $0.18 | 55 listings, ~45 with price | **$0.005** |
| Limit 15 (broken) | $0.39 | $0.29 | 0 listings (sidecar degradation) | N/A |
| Firecrawl scrape basic (limit=5, hypothetical) | $0.40–0.45 | $0.09–0.10 | Same 30 listings, **lower accuracy** | $0.013–0.015 |
| Firecrawl scrape basic (limit=10, hypothetical) | $0.65–0.72 | $0.16–0.18 | Same 55 listings, **lower accuracy** | $0.012–0.013 |

**Key observations:**
- **Firecrawl scraping is 2–3× more expensive AND less accurate** than crawl4ai. Vinted example: crawl4ai gets 5/5 prices correctly (EUR/GBP), Firecrawl basic gets 1/5 (naive regex).
- **Cost increase from 5 → 10 is proportional to user value increase** — you're not overpaying; per-listing cost stays flat or slightly decreases due to fixed Firecrawl search cost amortizing over more listings.
- **Limit 15 is not a cost issue — it's a sidecar degradation bug.** Search still costs 32 credits, but every scrape returns null. Don't expose limits > 10 in the UI until the concurrency problem is fixed (see §7 I).

**Anti-bot platform cost impacts:**

| Platform | Status | Cost impact if using failover |
|---|---|---|
| **StockX** | Works fine on crawl4ai (3/4 bake-off) | None — no failover needed. Keep primary. |
| **eBay** | Intermittent anti-bot (2/2 in bake-off, but documented failures) | **Optional Firecrawl failover:** ~$0.0002–0.0005/search if triggered (~5% of eBay URLs fail, $0.004/URL × 5–7 URLs). Adds negligible cost for resilience. |
| **Vestiaire** | Works on crawl4ai; Firecrawl discovery broken | Can't help — Firecrawl search returns 0 URLs. No failover viable. Keep primary. |
| **RealReal** | PerimeterX press-and-hold (no automated bypass) | Deferred indefinitely. Currently gated, costs $0. If re-enabled later, cost is unknown (depends on unlocker choice). |

**Recommendation:** Ship limit=10 immediately (one-line change at `app/api/search/route.ts:57`). Optional: implement eBay Firecrawl failover later (~1–2 hours) if production experiences enough eBay failures to warrant resilience.

### What changed since the last revision

The previous version of this section claimed "12–16 Firecrawl credits per search" — that was correct only when limit was set to 10. Today the search limit is hard-coded to 20 in [lib/firecrawl.ts:46](lib/firecrawl.ts#L46), making per-platform-search cost 4 credits, not 2. With 8 working Firecrawl platforms, that's 32 credits per full search. The pipeline then slices to top 5 results per platform ([app/api/search/route.ts:57](app/api/search/route.ts#L57)) — so 75% of search credits are paid for URLs we never look at. **Largest controllable cost lever in the codebase right now.** See `scripts/limit_sweep.py` for an A/B harness comparing limits 5/10/15.

### Be conservative with diagnostic scripts

| Script | Cost |
|---|---|
| `diagnose-counts.mjs` | 3 Firecrawl credits (search only) |
| `test-all-platforms.mjs` | ~16 Firecrawl credits (search) + ~$0.02 OpenAI |
| `diagnose-scrape.mjs` | 9 Firecrawl scrape credits — **legacy, uses old Firecrawl scraping; avoid** |
| `diagnose-parallel.mjs` | 25+ Firecrawl scrape credits — **legacy; avoid** |

The diagnose-scrape and diagnose-parallel scripts were written before the migration and still call Firecrawl's scrape endpoint directly. They're useful as a baseline comparison but cost real credits. Prefer `test-all-platforms.mjs` for end-to-end validation now.

---

## 10. Testing Checklist

When picking this up in a future session, verify in this order before making changes:

1. `curl http://localhost:8000/health` → `llm_mode: active`
2. Single-listing smoke test, e.g.
   ```bash
   curl -X POST http://localhost:8000/scrape -H 'Content-Type: application/json' \
     -d '{"url":"https://www.grailed.com/listings/<active-listing>","platform":"grailed"}'
   ```
   Expect non-null `result` with price + image.
3. Full sweep: `node --env-file=.env scripts/test-all-platforms.mjs`
   Expect ~6/8 platforms to extract. eBay and Vestiaire failures are known.
4. Full UI test (only if needed — costs real Firecrawl credits): `npm run dev:all`, search via UI.

---

## 11. Key Gotchas & Learnings

1. **Sidecar must be running before `/api/search` works.** Use `npm run dev:all` during development, not `npm run dev`.
2. **`enable_stealth=True` is non-negotiable** — StockX returns garbage without it. eBay still beats it.
3. **`word_count_threshold: 0` for Depop and eBay** — without it, the LLM gets the sidebar's "similar items" instead of the actual listing.
4. **Do not enable `light_mode`/`text_mode`/`memory_saving_mode`** on the crawl4ai BrowserConfig — they break SPA rendering on Grailed/Depop/StockX.
5. **First LLM call after a cold sidecar can produce malformed JSON.** Retry usually works. Mostly affects Grailed in observation.
6. **Firecrawl's `site:vestiairecollective.com` returns zero results.** Known platform-specific search-index gap; Vestiaire Collective needs its own discovery path.
7. **Concurrency cap of 2 per platform** — going higher caused mass timeouts in the original Firecrawl architecture. Hasn't been re-tested under the sidecar; raise only with care since the sidecar shares one Playwright browser.
8. **`onlyMainContent` was the Firecrawl name; the crawl4ai equivalent is `word_count_threshold`** (lower = keep more short blocks). Same intent, different knob.
9. **The schema in `extractors.py` must match the TypeScript `ScrapedListing` shape in `lib/firecrawl.ts` and `lib/scraper.ts`.** They're independently defined and silent drift will null-out fields.
10. **Image URLs expire on some platforms.** Frontend has `onError` handlers; don't try to validate URLs at scrape time.
11. **Structured extraction (JSON-LD / testid CSS) is now the primary tier.** LLM is only a fallback. If you're debugging a wrong price, check `structured_extractors.py` first — most listings won't even reach the LLM.
12. **Read `result.html` for structured extraction, NOT `result.cleaned_html`.** The latter strips `<script>` tags and JSON-LD with it.
13. **`target_elements` is gated to the LLM tier** (`scope_to_target=True`). Don't apply it to the structured tier — it drops `<head>` meta and JSON-LD.
14. **`wait_until="networkidle"` is unreliable on Depop/StockX** (times out). Use `domcontentloaded` + `delay_before_return_html=5s` (6s Poshmark; 7s on retry). The Depop JSON-LD doesn't paint until ~3–5s in.
15. **StockX's "There are no Asks at this time" string is ALWAYS present** in the i18n bundle — don't use the string as a signal. Use whether `[data-testid="trade-box-buy-amount"]` has text.
16. **Related-product carousels on StockX use `data-testid="product-tile-lowest-ask-amount"`** (with `tile`). The main listing uses `trade-box-buy-amount`. Don't confuse them.
17. **`debug_probe.py` exists** for future debugging — it dumps OG meta, JSON-LD, `__NEXT_DATA__`, inline script JSON, and visible `$`-adjacent text from any URL. Saves raw HTML to `crawl4ai-service/debug_dumps/` for offline grepping.
18. **Mercari prices in `__NEXT_DATA__` are in CENTS.** `11000` = $110.00. Always `/100`.
19. **Mercari's `og:image` is a generic placeholder** (`ogp_image_1.png`). Read `photos[0].imageUrl` from `__NEXT_DATA__.props.pageProps.serverState['ItemDetail:<id>'].photos` instead.
20. **Vinted's RSC payload is double-escaped.** Literal bytes: `\"price\":{\"amount\":\"75.0\",\"currency_code\":\"USD\"}`. Regex must use `\\"price\\":\{...` — backslash-quote for field markers, plain `\{` for the brace. Off-by-one is easy: first version had `\\{` and matched nothing.
21. **Vinted's `currency_code` (underscored) ≠ `currencyCode` (camelCase).** Underscored = listing pricing. CamelCase = per-market shipping option (can be CZK on a USD listing). **Always match the underscored form.**
22. **Poshmark does NOT emit Schema.org JSON-LD on listing pages.** Don't add new platforms to `_extract_from_jsonld` without first verifying via `debug_probe.py` that they actually emit `<script type="application/ld+json">` with `@type: "Product"`. Poshmark's signals are `<meta property="og:type" content="product">` (gate), `og:title`, `og:image`, `<p class="h1"><span>$N</span></p>` (first span = listing price), and `data-et-prop-inventory_status` (sold).
23. **`remove_overlay_elements=True` is HARMFUL.** It runs JS in the page to remove overlay nodes; on Poshmark this triggers a navigation (logged as `Failed to remove overlay elements: Execution context was destroyed`) or strips `<meta property="og:type">` and other critical SSR meta. The recurring "Page.content: Unable to retrieve content because the page is navigating" errors that look like anti-bot are actually caused by *our own JS*. Keep it set to `False` in `_build_run_cfg`.
24. **CSS rule definitions are NOT element presence.** Poshmark defines `.listing__status-banner__title--sold { … }` in every page's `<style>` block whether or not the listing is sold. `'listing__status-banner__title--sold' in html` matches the CSS rule, not the rendered element. Always query via `BeautifulSoup(html).find(class_="…")` when checking for a rendered DOM element. (Same trap applies to any class detection on any platform.)
25. **Schema.org availability can be reused in vocabulary references.** A page can mention `schema.org/OutOfStock` as a generic enum link without the listing actually being sold. Match the FULL `"availability":"…OutOfStock"` JSON key/value pair, not just the URL substring.
26. **Supabase: RLS ≠ table permissions.** Creating a table and adding RLS policies is not enough. Each public table also needs `GRANT SELECT/INSERT/UPDATE/DELETE ON public.<table> TO authenticated` (and to `service_role` if hit via REST). Without those grants, every request returns Postgres `42501 permission denied`. Discovered during Phase 2B `saves`-table rollout — RLS was correct, but `authenticated` couldn't even see the table. Same fix applied to `profiles.UPDATE` before profile editing worked.
27. **Supabase Storage public bucket + RLS:** even with a public bucket, you still need explicit policies on `storage.objects` for INSERT/UPDATE/DELETE — scope writes to `(storage.foldername(name))[1] = auth.uid()::text` so users can only touch their own folder. SELECT can be public via `bucket_id = '<bucket>'`.
28. **Sonner `richColors` + `toast.error` reads as "error".** The red `!` icon makes "Removed from Favorites" look like a failure. Use a plain `toast(msg, { style: { color: '#E24B4A' }, icon: <X/> })` instead when you want destructive-but-not-error tone.

---

## 12. What's Next (proposed order)

1. **Investigate anti-bot 403 regression (§7 F).** Highest priority — blocks Phase 2D automation. Depop + Grailed are dropping a subset of requests with 403 challenge pages, and our LLM fallback compounds it by re-hitting the same URL. Solve this before scheduling any background re-scrape.
2. **Phase 2C — Watchlist auto-refresh on login.** Manual refresh button shipped 2026-05-18. Next: trigger refresh automatically when `/profile?tab=watchlist` mounts if `last_checked_at` is older than ~1 hour. After that, Phase 2D: scheduled re-scrape (Supabase Edge Function + `pg_cron`, or external cron), price snapshot history, email on price drop.
2. **Investigate StockX SSR-vs-CSR price drift** (§7 E). User has deferred this; revisit when picking up the project.
3. **Decide on eBay** (§7 A) — either invest in proxy/API solution, or formally drop eBay from `PLATFORM_DOMAINS` so the UI stops surfacing the empty tab.
4. **Implement Vestiaire URL discovery** via sidecar (§7 B option 1). Scoped, low-risk.
5. **Add retry-once-on-null wrapper** in `lib/scraper.ts` for residual flaky-first-call cases (cheap, ~10 lines).
6. **New platforms** — ThredUp is DONE (2026-05-18, search-page extraction). The RealReal scaffolded but DEFERRED (2026-05-19, §7 G — PerimeterX press-and-hold). Lower priority: 2nd Street. Pattern: `structured_extractors.py` for single-listing scrapes, or `search_page_extractors.py` for sites where listing URLs aren't Firecrawl-indexable. Always add to `PLATFORM_DOMAINS`/`PLATFORM_NAMES`.
7. **Cost reduction: caching + structured extractors (eBay, Vestiaire)** — Full implementation plan is in `.claude/plans/sleepy-wishing-snowflake.md`. Summary: (a) add `cachetools` TTLCache to sidecar `/scrape` (30-min, keyed by URL) and `/scrape-search` (10-min, keyed by platform::query) — eliminates re-running Playwright+LLM for repeated queries and watchlist refreshes; (b) add `extract_ebay` and `extract_vestiaire` to `structured_extractors.py` using the existing `_extract_from_jsonld()` helper — both platforms emit Schema.org JSON-LD. See plan file for exact code, verification steps, and expected impact. 3 files total, no architecture changes.

---

## 13. Code Reference Card

```typescript
// lib/firecrawl.ts — entry points
export async function searchPlatform(platform: string, query: string): Promise<RawSearchResult[]>
export async function scrapeListing(url: string, platform: string): Promise<ScrapedListing | null>
// scrapeListing delegates to scrapeViaSidecar() in lib/scraper.ts

// ScrapedListing shape (must match crawl4ai-service/extractors.py:LISTING_SCHEMA)
interface ScrapedListing {
  url: string;
  title: string | null;
  price: number | null;
  currency: string;       // defaults "USD"
  isSold: boolean;
  condition: string | null;
  imageUrl: string | null;
}
```

```python
# crawl4ai-service/extractors.py — sources of truth for prompts/options
LISTING_SCHEMA         # JSON schema, mirrors ScrapedListing
PLATFORM_PROMPTS       # per-platform extraction instructions
PLATFORM_CRAWLER_OPTIONS    # crawl4ai BrowserConfig tweaks (word_count_threshold etc.)
PLATFORM_EXTRACTION_OPTIONS # LLMExtractionStrategy tweaks (apply_chunking etc.)
```
