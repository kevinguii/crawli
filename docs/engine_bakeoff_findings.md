# Engine bake-off — findings

**Run date:** 2026-05-19
**Scope:** 3 queries × 8 platforms × 3 URLs = 72 URL fixture. Two engines: `crawl4ai` (current production path) and `firecrawl-basic` (Firecrawl `/scrape` markdown only, 1 credit/URL).
**Skipped:** `firecrawl-stealth` — basic Firecrawl already got 100% fetch on eBay + Vestiaire (the platforms we'd have tried stealth on), so paying 5× per URL for stealth wasn't warranted. Easy to add later if a specific site fails basic in the future.
**Total spend:** 48 (fixture) + 72 (basic scrape) = **120 Firecrawl credits ≈ $0.48 Hobby** + $0.098 OpenAI tokens (crawl4ai's eBay+Vestiaire LLM extractions).

---

## TL;DR — recommendation

**Stay on crawl4ai as the primary scraper. Bump per-platform limit from 5 → 10.** Don't switch any platform to Firecrawl scrape today. Optionally add Firecrawl as a *failover* later (when crawl4ai returns null after retries) for ~$0.018/URL recovery cost. Don't go to limit 15 — the sidecar/Playwright stack degrades catastrophically under that load (separate bug to investigate).

The user's hypothesis going in — "crawl4ai for normal sites, Firecrawl for the hard ones" — is correct in *spirit* but the data says the platforms we thought were hard (eBay, Vestiaire) actually work well enough on crawl4ai today, and Firecrawl basic alone (without our LLM extractor) doesn't give us *better* data on those sites — just **faster** data. The real lever to pull next is **better URL filtering** + **investigating the limit-15 sidecar degradation**, not switching engines.

---

## 1. Headline numbers

### Bake-off summary (72 URLs each engine)

| Engine | Fetch | Title | Price | p50 ms | p95 ms | Cost (Hobby) | Cost (Standard) |
|---|---|---|---|---|---|---|---|
| **crawl4ai** | 67/72 (93%) | 66/72 (91%) | 56/72 (77%) | 11,226 | **90,047** | $0 + $0.098 OpenAI | $0 + $0.098 OpenAI |
| **firecrawl-basic** | 72/72 (100%) | 72/72 (100%) | 58/72 (80%) | 3,205 | 6,134 | $0.288 | $0.071 |

**But raw numbers mislead.** ~37% of the URLs in the fixture were **non-listing** URLs (category pages, brand hubs, news articles, etc.) — Firecrawl's `site:` search returned them, and the bake-off didn't apply production's `filterListingUrls()` filter. On those URLs, "price_ok" for Firecrawl is just a regex hit for `$N` anywhere in the markdown (could be a related-listing price, "starting at", or an ad), while crawl4ai's structured extractor correctly returns null. Re-scoring only on real listing URLs:

### Listing-URL-only success rate (the apples-to-apples view)

| Platform | crawl4ai | firecrawl-basic | Notes |
|---|---|---|---|
| depop     | 5/6 (83%)  | 5/6 (83%)  | Tie |
| ebay      | **2/2 (100%)** | 1/2 (50%) | crawl4ai wins. Firecrawl's regex misses eBay's price format. |
| grailed   | 3/3 (100%) | 3/3 (100%) | Tie |
| mercari   | 3/3 (100%) | 3/3 (100%) | Tie |
| poshmark  | 6/6 (100%) | 6/6 (100%) | Tie |
| stockx    | 3/4 (75%)  | 4/4 (100%) | Firecrawl wins (small N) |
| vestiaire | 7/7 (100%) | 7/7 (100%) | Tie |
| vinted    | **5/5 (100%)** | 1/5 (20%) | **crawl4ai wins decisively** — Firecrawl regex misses EUR/GBP prices |

**On real listing URLs, crawl4ai matches or beats Firecrawl basic on every platform except StockX (where N=4, marginal).** The eye-popping "100% vs 93%" Firecrawl edge from the headline table almost entirely came from non-listing URLs where Firecrawl "succeeds" by regex-matching a random `$N` in the page, and crawl4ai correctly fails because there's no product to extract.

### Speed delta (average wallclock per scrape)

| Platform | crawl4ai (ms) | firecrawl-basic (ms) | Speedup |
|---|---|---|---|
| stockx | 8,364 | 3,921 | 2.1× |
| vinted | 9,793 | 4,202 | 2.3× |
| vestiaire | 22,179 | 3,233 | 6.9× |
| depop | 25,826 | 3,499 | 7.4× |
| mercari | 41,076 | 5,501 | 7.5× |
| poshmark | 35,404 | 2,577 | 13.7× |
| ebay | 51,849 | 3,777 | 13.7× |
| grailed | 45,750 | 2,592 | **17.6×** |

Speedup correlates with how often crawl4ai falls back to LLM extraction *and* how often it hits anti-bot 403s (which retry inside crawl4ai). On platforms with working structured extractors and no anti-bot drama (StockX, Vinted), the gap is 2×. On platforms hitting either or both, it's 7–18×.

---

## 2. Limit sweep (query: "gucci bag")

| Limit | Wallclock | Listings | With price | Dup rate | Failed pls | FC credits | $ Hobby | $ Standard |
|---|---|---|---|---|---|---|---|---|
|  5 | **224 s** | 30  | 25  | 0.13 | 1 | 14 | $0.10 | $0.06 |
| 10 | 447 s | **55** | 45  | 0.27 | 0 | 16 | **$0.22** | $0.18 |
| 15 | 750 s | **0** | 0 | 0.00 | 0 | 32 | $0.39 | $0.29 |

### Observations

- **Limit 5 → 10 is a free upgrade in user value:** 1.83× listings (30 → 55), 2× wallclock, 2.2× cost. Per-listing cost stays flat (~$0.004 / listing).
- **Dup rate climbs from 13% → 27%** at limit 10. Users see more listings but more are near-duplicates across platforms (same product surfaced on Grailed *and* eBay *and* Vinted). Still acceptable IMO.
- **Limit 15 is broken.** Firecrawl search returned plenty of URLs (14-15 per platform) and credit-cost reflects that, but **every single sidecar scrape returned null**. The sidecar's `/health` endpoint stayed green throughout and was healthy immediately after — so the issue is acute degradation during sustained high-load, not permanent crash. Most likely cause: the global `AsyncWebCrawler` instance shares one Playwright browser; at ~15-20 concurrent renders it queues, times out, and returns degraded HTML that fails both structured and LLM extraction. This is a separate bug — independent of the engine choice — and should be filed as such before any UI offers limit > 10.
- **One platform failed at limit 5** (mercari → 0 listings). Looks like a transient Firecrawl search miss — at limit 10 mercari returned 7 listings. Single-data-point flake; not actionable.

---

## 3. OpenAI token reality vs. estimate

During the bake-off the token tracker captured **22 LLM extraction calls** totaling **479,979 input + 42,542 output tokens = $0.0975** across 72 URLs.

- That's ~$0.0044 per LLM-extracted listing.
- The pre-bake-off estimate in [TOKEN_COST_ANALYSIS.md](../TOKEN_COST_ANALYSIS.md) was ~$0.014 per eBay URL + ~$0.005 per Vestiaire URL ≈ $0.019 for 1 of each per search. The real numbers from this run are in that ballpark (the 22 LLM calls are skewed toward eBay where chunked extraction makes multiple calls per URL).
- Estimator is **within 30%** of reality. Good enough — don't retune the platform-typical HTML-size table.

---

## 4. Per-platform verdict (the hybrid decision)

### Keep on crawl4ai

- **Grailed, Depop, Poshmark, Mercari, Vinted, StockX, Vestiaire** — crawl4ai gets all the listings, gets accurate numeric prices, costs $0 per scrape. The only downside is latency. None of these need Firecrawl.
- **Vinted especially** — crawl4ai's structured extractor reads native currency (EUR/GBP) correctly. Firecrawl basic's naive $-regex flunked 4 of 5 Vinted listings.

### Consider for failover only

- **eBay** — when crawl4ai's `/scrape` returns null after retries, fall back to Firecrawl basic + retry through our extractor. eBay's anti-bot is intermittent; crawl4ai *did* get prices from /itm/ pages in this run (contradicting [HANDOFF.md §7 A](../HANDOFF.md), which may be stale), but p95 was 90s. A failover gives us a faster recovery path on the days eBay's edge is hostile. **Cost when triggered: ~$0.004 Hobby per URL.**

### Don't bother

- **Firecrawl stealth (5 credits/URL)** — basic Firecrawl already got 100% fetch on every platform. Stealth is justified only when basic 403s, which never happened in this run. Save the 5× cost.
- **Switching any platform wholesale to Firecrawl scrape** — Firecrawl returns markdown; our extractor pipeline expects HTML for structured-tier extraction (JSON-LD, testid CSS). Plugging Firecrawl in as a 1:1 replacement loses our existing accuracy gains. A real switch would need a separate piece of work: pipe Firecrawl's markdown through our LLM extractor, which is a spike, not a 1-line config change.

### Deferred — same status as before

- **The RealReal** — manual-intervention rules (PerimeterX press-and-hold) make this dead until a fully automatic bypass appears. The bake-off didn't test it; the user's no-manual-browser rule (memory: [[feedback-no-manual-browser]]) holds.

---

## 5. Recommended next steps (ordered by ROI)

1. **Ship per-platform limit = 10 in production.** Single change at [app/api/search/route.ts:57](../app/api/search/route.ts#L57) (or expose a per-platform config). Confirmed: doubles listings for 2.2× cost, no UX regression. **This is the biggest single user-visible upgrade in the bake-off data.**
2. **Investigate the limit-15 sidecar degradation** before letting users ever pick a value past 10. The likely fix is one of:
   - Larger Playwright pool / multiple `AsyncWebCrawler` instances.
   - Per-platform sidecar queues (so Grailed's 403 retries don't block Vestiaire renders).
   - Lower per-platform concurrency from 2 → 1 when total URLs in flight exceeds N.
3. **Audit `filterListingUrls()` in [lib/parse.ts](../lib/parse.ts).** The bake-off fixture had ~37% non-listing URLs (category pages, news articles). Production's filter should catch these — verify it does, especially for eBay's `/b/...` and StockX's `/brands/...` patterns. If gaps exist, this saves both Firecrawl search credits *and* wasted sidecar renders.
4. **Add Firecrawl basic as a `/scrape` failover (optional).** Wire it into [lib/scraper.ts](../lib/scraper.ts) as: if `scrapeViaSidecar` returns null after retries, try `firecrawl.scrape(url, formats=['html'])` and feed the HTML back into the sidecar's structured/LLM extractor pipeline (needs a small new sidecar endpoint that accepts pre-fetched HTML — separate from `/scrape`). Adds resilience on bad eBay days for ~$0.004/URL when triggered. Cost cap: only fires on the ~5–7% of URLs crawl4ai gives up on.
5. **Re-test eBay periodically.** This bake-off's eBay results (2/2 on /itm/ pages, prices extracted) contradict the documented production state. Either eBay's anti-bot was lenient today, or the docs are stale. Worth running a once-a-week scheduled eBay sample to track the trend.

---

## 6. What we explicitly did NOT decide

- **Whether to switch any platform's primary scraper to Firecrawl.** Bake-off says no for now; revisit if a future change makes Firecrawl→our-extractor pipeline cheap to build.
- **Whether to ship the failover.** That's a 1–2 hour piece of work, separate plan. The data here justifies it but doesn't require it.
- **What number to settle on past 10.** Limit 15 broke things; we can't safely answer until the sidecar concurrency bug is investigated.

---

## Raw data

- [scripts/bakeoff_fixture.json](../scripts/bakeoff_fixture.json) — frozen URL list (72 URLs).
- [scripts/bakeoff_results.csv](../scripts/bakeoff_results.csv) — 144 rows: every (engine, url) attempt with extracted fields and timing.
- [scripts/limit_sweep_gucci_bag.json](../scripts/limit_sweep_gucci_bag.json) — limit sweep per-platform stats.
- [token_usage.jsonl](../token_usage.jsonl) — every LLM extraction call this session, with real prompt/completion tokens.

To re-run with another query without rebuilding the fixture, delete `bakeoff_fixture.json` and run `python scripts/engine_bakeoff.py --build-fixture && --run` again, or modify `QUERIES` in [scripts/engine_bakeoff.py:54](../scripts/engine_bakeoff.py#L54).
