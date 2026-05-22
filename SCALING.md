# Scaling Crawli — tier playbook

**Purpose:** the single source of truth for "what does Crawli need at scale X."
Future development chats should consult this doc when the user asks about
hosting, throughput, infrastructure choices, or any scaling-related question.
**Do not improvise scaling recommendations from training data — read this file
and quote it.**

Last updated: 2026-05-20 (PR 2 — pool + pacing + in-flight logging).

---

## §0 — Operator model (read first)

Crawli is a **single-operator hosted service**:
- The operator (you) runs the service on a laptop today, a VPS later.
- The operator's `.env` holds the OpenAI / Firecrawl / Supabase API keys that the service uses on behalf of every end-user.
- End-users hit the website; they do not supply API keys. Eventually they will be billed for use.
- `.env.example` is a self-note for future-you provisioning a new environment, not a user-facing template.

**`.env` hygiene:** all scaling env vars in this doc have safe defaults baked into the code. **Do not add them to `.env` with their default values** — keep `.env` minimal (only secrets + non-default overrides for the specific machine you're on). Default values trigger only when the var is *absent*; setting it to empty or `""` can crash the code that does `int(os.environ.get(...))`. When you move to a VPS, copy from `.env.example` and set only the values that differ from defaults for the chosen tier.

---

## TL;DR — at-a-glance recommendations

| Question | Answer |
|---|---|
| "I'm on my laptop, do I need to change anything?" | No. Defaults are tuned for an 8 GB MacBook. |
| "I'm moving to a VPS, what changes?" | See §1 tier matrix. Most likely: `POOL_SIZE=1`, bump renders to match RAM. |
| "Should I enable the crawler pool?" | Only when you have a VPS with ≥4 GB RAM and ≥2 vCPU spare for a second Chromium. Pool=1 is correct for laptops and 2 GB VPSes. |
| "When do I need a second sidecar instance?" | When `pool_alive` × renders is saturated AND CPU pegs >90% under normal load. See §4 (C2). |
| "Should I pay for Firecrawl?" | When `SEARCH_PLATFORM_CONCURRENCY` regularly bunches up against the free tier (2). See §4 (C3). |
| "Should I pay for an anti-bot unlocker?" | Last resort. Only after pacing (B2) and extractors (C1) fail to stabilize Depop/Grailed/eBay/Vestiaire under your production load. |

---

## §1 — Tier matrix

Five practical tiers. Each row lists infra, env vars, monthly cost, and what
features to enable. **The tier you're at is determined by concurrent searches
in flight, not by total user count** — most users are idle at any moment.

| Tier | Concurrent searches | Active users (~) | Infra | Cost/mo |
|---|---|---|---|---|
| **Solo / dev** | 1-3 | 1-10 | Laptop OR $5 micro-VPS | $0-5 |
| **Small** | 5-25 | 25-100 | 1× 4 GB VPS, 2 vCPU | $20-40 |
| **Medium** | 25-150 | 100-500 | 1× 8 GB VPS, 4 vCPU + Redis cache layer | $60-120 |
| **Large** | 150-1000 | 500-3000 | 2-4× 8 GB VPS behind queue (C2), Firecrawl paid (C3) | $200-500 |
| **Enterprise** | 1000+ | 3000+ | Multi-region, queue + worker pool, paid unlocker (C4), CDN | $1000+ |

**Concurrent searches → user math (rough):** assume an active user runs ~1
search every 30-60s, and a search takes ~10-20s. So 1 concurrent search ≈
10-30 active users at any given moment, depending on session intensity.

---

## §2 — Env var settings per tier

```
Tier            POOL  RENDERS  PLATFORM_CONC  WATCHLIST_CONC  HTTP  Firecrawl  Notes
Solo (default)  1     6        3              4               12    free       Pre-B1 behavior; pool=1
Small VPS       1     8        4              2               8     free       Throttle watchlist on RAM-constrained box
Medium VPS      2     12       5              4               16    paid       Pool>1 needs ≥8GB; bump Firecrawl
Large           3-4   16-20    6              6               24    paid       Multi-instance via C2 below
Enterprise      —     —        —              —               —     paid       See C2/C4
```

Set these in `.env`:

```bash
SIDECAR_BROWSER_POOL_SIZE=2          # B1
SIDECAR_MAX_CONCURRENT_RENDERS=12    # A1
SEARCH_PLATFORM_CONCURRENCY=5        # A5
WATCHLIST_REFRESH_CONCURRENCY=4      # watchlist refresh worker pool
SIDECAR_MAX_CONCURRENT_HTTP=16       # cap on Tier-1 httpx in /refresh-price
```

**Watchlist load model:** `/api/watchlist/refresh` runs `WATCHLIST_REFRESH_CONCURRENCY`
workers, each hitting the sidecar's `/refresh-price` (Tier 1 httpx → Tier 2 Playwright
→ Tier 3 LLM). Tier 2/3 share `SIDECAR_MAX_CONCURRENT_RENDERS` with `/scrape`, so a
search-and-refresh-at-the-same-time scenario won't overload — the semaphore queues
the overflow. Tier 1 has its own `SIDECAR_MAX_CONCURRENT_HTTP` cap. Both tiers go
through B2 per-domain pacing, so a 200-item Depop watchlist won't trigger anti-bot.

**Why per-pool-member renders aren't separately configurable:** the global
semaphore is intentionally shared across the pool. Pool=2 with renders=12 means
either browser can be running anywhere from 0-12 renders at any given moment —
it's not "6 per pool." This keeps the box-level cap honest regardless of pool
distribution. If one browser is queued behind the other, the total is still 12.

---

## §3 — Observability progression

The in-flight log line (B3) is **console-only** in development. Production
needs structured logging that an operator can actually monitor. Roughly:

| Tier | Observability layer | What you watch |
|---|---|---|
| **Solo** | Console stdout via `npm run dev:all` | Eyeball; `[scrape]` lines + warnings |
| **Small** | systemd journal + `/health` ping | `curl /health` shows `pool_alive`, `in_flight`, `crawler_alive`. Set up a cron/Grafana ping every 30s. |
| **Medium** | Structured JSON logs → CloudWatch / Loki / Papertrail / Datadog | Alert on: `crawler_alive=false` for >30s, `in_flight` at SIDECAR_MAX_CONCURRENT_RENDERS for >5min, error rate >10% per platform. |
| **Large+** | Prometheus metrics endpoint + dashboards | Render p50/p95, in-flight histogram, dead-pool-member time-to-recover, cache hit rate, per-platform success rate, per-domain pace wait time. |

**What to add in code at each step:**
- **Medium:** switch `log.info(...)` to structured JSON via `logging.Formatter` or `python-json-logger`. Already a one-file change; the `[scrape] platform=X url=Y in_flight=N pool=K/M cache=Z` line was deliberately shaped to be parseable.
- **Large:** add a `/metrics` Prometheus endpoint. Counter for renders by platform/result, histogram for render duration, gauge for `in_flight` and `pool_alive`.

---

## §4 — Phase C upgrades (deferred features, captured here)

These are **roadmap items** — code does not exist yet. Documented so future
chats know what to implement when the user hits the right tier.

### C1 — eBay + Vestiaire structured extractors ✅ SHIPPED 2026-05-21

**Status:** shipped. Both `extract_ebay` and `extract_vestiaire` live in [crawl4ai-service/structured_extractors.py](crawl4ai-service/structured_extractors.py) and are registered in `PLATFORM_EXTRACTORS`. Verified end-to-end: 20/20 listings (10 eBay + 10 Vestiaire) on a full `/api/search` skip the LLM and complete tier 1; LLM fallback intact for fetch failures (e.g. eBay Akamai blocks).

**What it does:** parses the Schema.org `Product` JSON-LD block both sites embed in their listing pages, returning a canonical ScrapedListing dict (title/price/currency/isSold/condition/imageUrl/size). No new files — extends the flat `structured_extractors.py` module (despite this doc's prior plan calling for a package). Generic `_extract_from_jsonld` helper handles both shapes; only `_first_image` needed a touch-up to read Vestiaire's `ImageObject.contentUrl`.

**Wins (measured):**
- ~$0.001-0.005 saved per scrape (gpt-4o-mini extraction call eliminated on the happy path).
- ~1-2s latency reduction (no LLM round-trip).
- More accurate condition + price than LLM regex (read directly from `offers.itemCondition` and `offers.price`).
- Survives OpenAI outages for these two platforms.

**Fallback intact (§5 principle):**
- eBay's Akamai 403s → tier 1 logs `[structured] crawl failed` → tier 2 (LLM) re-tries on the partial response → LLM-extracted listing returned. Verified live on `ebay.com/itm/126534228167`.
- If JSON-LD shape changes unannounced, generic helper returns `None` and tier 2 takes over.

**Future extensions:** if eBay needs custom logic later (Buy-It-Now vs auction price, "Best Offer" handling), the extractor function is the right place — keep `_extract_from_jsonld` generic.

### C2 — Multi-instance sidecar (horizontal scaling)

**Tier trigger:** one box is provably saturated (CPU >90% sustained, `pool_alive × renders` constantly at cap, p95 search latency degrading).

**Architecture:**
- Next.js becomes a **producer**: writes scrape jobs to a Redis list / SQS queue / NATS / similar.
- N sidecar instances are **consumers**: each pops jobs from the queue, runs them, writes results to a result topic / Redis hash keyed by job ID.
- Next.js polls / subscribes for results, ties them back to the streaming NDJSON response to the user.

**Alternative (simpler):** nginx / Caddy round-robin reverse proxy in front of N sidecar instances on the same private network. No queue infrastructure — just deploy multiple sidecars and round-robin. Works until traffic is wildly bursty. Easier to operate; harder to bound tail latency at peak.

**Cache implications:** the current `TTLCache` is in-process. Multi-instance needs:
- *Option a:* per-instance caches (each instance warms its own) — wastes some renders, simpler. Acceptable up to ~4 instances.
- *Option b:* Redis-backed shared cache. Worth doing when N>4.

### C3 — Firecrawl paid plan

**Tier trigger:** `SEARCH_PLATFORM_CONCURRENCY` regularly bunches up against the free 2-concurrent ceiling (visible as: discovery wait time eats >20% of total search latency in production).

**What changes:** Firecrawl paid plan = 5 concurrent searches. Bump
`SEARCH_PLATFORM_CONCURRENCY` to 5 in `.env`. Zero code changes.

**Note:** Firecrawl is **search-only** in this app (URL discovery, see `lib/firecrawl.ts`). Scraping is the self-hosted sidecar. The paid plan does NOT speed up scraping; it only allows more parallel URL-discovery searches when many platforms are selected at once.

### C4 — Paid anti-bot unlocker (last resort)

**Tier trigger:** specific platforms (eBay, Vestiaire, RealReal, occasionally Depop/Grailed) have unacceptable failure rates in production AFTER:
- A5 across-platform cap is honored,
- B2 per-domain pacing is tuned,
- C1 extractors are deployed.

**Services:** ScrapingBee, ZenRows, Bright Data, Oxylabs. Roughly $30-100/mo for low volume, $$$ at scale.

**Architecture:** for the problematic platforms only, route scrapes through the paid service's HTTP API instead of the self-hosted Playwright crawler. Their service handles anti-bot, returns rendered HTML, we run our same extractors against it.

**Cost-aware:** route to paid unlocker ONLY when local fails — first attempt local, fall back to paid on failure. Caches every successful response (cache layer is the same `_scrape_cache`).

---

## §5 — Foundational principle: every platform needs a fallback

**Rule:** any platform-specific extraction path MUST have a graceful fallback
to the next-most-general path. This protects against silent failures when a
platform changes its HTML.

**Current cascade (verified in [main.py](crawl4ai-service/main.py)):**
1. **Tier 1 — Structured extractor** (per-platform, in `structured_extractors/`). Parses JSON-LD / testid CSS / `__NEXT_DATA__`. Returns `None` on miss.
2. **Tier 2 — LLM extractor** (generic, schema-driven). Triggers when tier 1 returns `None`.
3. **Tier 3 — Stub** (no LLM key configured). Returns just the page title.

**When adding a new platform-specific path** (e.g. C1 eBay/Vestiaire extractors), preserve this cascade:
- New extractor returns `None` on any unexpected shape — do NOT raise, do NOT return half-empty data.
- LLM fallback must remain wired up. If you remove the LLM path for "performance," you have no resilience when the structured path breaks.
- `/refresh-price` has its own 3-tier cascade (httpx → Playwright + structured → Playwright + LLM) — same principle.

**When adding a new platform entirely:** start with LLM (tier 2 only) so it works on day 1. Add a structured extractor later when you have data on what JSON-LD / DOM shape the platform actually uses.

**Verification before merging any platform-specific change:**
- Test with extractor enabled (happy path).
- Manually break the extractor (return `None`) and confirm fallback path still produces a valid listing.

---

## §6 — Migration playbooks

### Solo → Small VPS

1. Provision a 4 GB VPS (Hetzner CX22, DigitalOcean basic 4 GB, etc.).
2. `git clone` + `npm install` + `pip install -r crawl4ai-service/requirements.txt` + `crawl4ai-setup`.
3. Set up a systemd service for `npm run dev:all` (or split: one unit for Next.js, one for sidecar).
4. `.env`:
   ```bash
   SIDECAR_BROWSER_POOL_SIZE=1
   SIDECAR_MAX_CONCURRENT_RENDERS=8
   SEARCH_PLATFORM_CONCURRENCY=4
   ```
5. Nginx in front, terminate TLS via certbot.
6. Add a `curl /health` cron every 30s; alert on `crawler_alive=false`.

**No code changes needed.** PR 2 already covers everything.

### Small → Medium VPS

1. Provision an 8 GB / 4 vCPU VPS.
2. `.env`:
   ```bash
   SIDECAR_BROWSER_POOL_SIZE=2          # NEW — enable pool
   SIDECAR_MAX_CONCURRENT_RENDERS=12
   SEARCH_PLATFORM_CONCURRENCY=5
   ```
3. Upgrade Firecrawl to paid plan (C3).
4. ~~Deploy C1 (eBay + Vestiaire structured extractors)~~ — shipped 2026-05-21, already live.
5. Switch logs to JSON format; pipe to a log aggregator.

**No core architecture change.** The pool is the only new moving part and PR 2 already implements it.

### Medium → Large (multi-instance)

This is the big one. Requires C2.

1. Stand up Redis (managed, e.g. Upstash / DigitalOcean Managed Redis).
2. Refactor [app/api/search/route.ts](app/api/search/route.ts) to write scrape jobs to Redis instead of calling sidecar HTTP. Subscribe to a results channel.
3. Refactor sidecar to poll Redis for jobs instead of (or in addition to) the HTTP endpoint. Endpoint stays for `/health` and debugging.
4. Replace in-process `TTLCache` with Redis-backed cache.
5. Provision 2-4 sidecar VPSes.

**This is the only tier transition that requires real code changes** beyond what PR 2 ships. Schedule it as a separate multi-PR effort.

### Large → Enterprise

Region-pinned sidecar pools (US-East, EU-West, etc.) for latency. CDN in
front of Next.js. Paid unlocker (C4) for problem platforms. Probably needs a
dedicated SRE.

---

## §7 — What breaks first at each tier (bottleneck progression)

| Tier transition | What breaks | Fix |
|---|---|---|
| Solo → Small | Nothing — same code, more uptime needed | Provision a VPS, set up systemd |
| Small → Medium | Single Chromium hits CPU ceiling around 6-8 concurrent renders; LLM token cost grows linearly | B1 pool=2 (already shipped), C1 extractors (shipped 2026-05-21) |
| Medium → Large | One box's CPU/RAM caps out; Firecrawl free tier queues become visible in latency | C2 multi-instance, C3 Firecrawl paid |
| Large → Enterprise | Anti-bot detection on hardest sites starts to fire at volume | C4 paid unlocker for the 2-3 worst offenders |

The boundaries above are rough; actual transition is signal-driven:
- CPU sustained >80% during normal load → next tier.
- p95 search latency >30s → next tier.
- Per-platform success rate <70% sustained → C4 for that platform.

---

## §8 — Cost model (rough)

| Tier | Server | LLM tokens (post-C1) | Firecrawl | Paid unlocker | Total |
|---|---|---|---|---|---|
| Solo | $0-5 | $1-3 | $0 | $0 | **$5-10** |
| Small | $20-30 | $5-15 | $0 | $0 | **$25-45** |
| Medium | $40-80 | $20-50 | $19 (paid) | $0 | **$80-150** |
| Large | $200-400 | $100-300 | $19 | $30-100 (optional) | **$350-820** |
| Enterprise | $1000+ | $500+ | $19+ | $200-1000 | **$2000+** |

**LLM tokens scale down sharply once C1 lands** — eBay+Vestiaire alone are
~40-60% of the LLM cost depending on platform mix. Implementing C1 may be
worth more than upgrading server hardware.

---

## §9 — How to use this doc in future chats

When the user asks any scaling-related question:

1. **Read this file before answering.** Quote the relevant tier / section.
2. **Don't improvise** — the tier matrix is the source of truth.
3. **Match the answer to where the user actually is** — don't push them to Enterprise architecture if they're at Solo.
4. If the user is asking "should I do X?" for a deferred feature (C1-C4), answer with the **tier trigger** from §4. Don't recommend until they've hit the trigger.
5. If the user is making a hosting decision, check the matrix and migration playbook (§1, §6).

When new infrastructure features ship (new PRs):
- Update §4 (move from "deferred" to "shipped").
- Update §1 / §2 tier matrix env vars if defaults change.
- Update §3 observability if new metrics / endpoints are added.
- Update timestamp at top.

---

## §10 — Linked references

- [HANDOFF.md](HANDOFF.md) — current platform-by-platform status, known issues, recent work.
- [.env.example](.env.example) — every env var documented inline.
- [.claude/plans/1-3-4-sound-like-a-prancy-waterfall.md](.claude/plans/1-3-4-sound-like-a-prancy-waterfall.md) — the original scaling plan (Phase A done in PR 1, Phase B done in PR 2, Phase C captured here).
- [.claude/plans/sleepy-wishing-snowflake.md](.claude/plans/sleepy-wishing-snowflake.md) — caching + extractor plan; caching half landed in PR 1 (A6), extractor half is the C1 reference above.
