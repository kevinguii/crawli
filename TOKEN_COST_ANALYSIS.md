# Token Cost Analysis for Crawli Searches

**Last updated:** 2026-05-19 (corrected Firecrawl-cost math; this file used to mis-attribute per-URL scrape credits to Firecrawl)
**Query baseline:** "gucci bag" (typical fashion query)
**Platforms:** 9 working (10 incl. The RealReal, currently deferred)

> **Pricing source of truth:** [docs/FIRECRAWL_PRICING.md](docs/FIRECRAWL_PRICING.md) for Firecrawl credits and $/credit. Update that file first when prices change; then sync this one.

---

## TL;DR: Cost per Search (corrected)

The previous version of this file claimed full searches cost $0.46–$0.60, with Firecrawl as ~95% of the cost. **That was wrong.** Firecrawl is only used for **search**, not for per-URL scraping (that's crawl4ai, which has no per-request cost). Real costs:

| Scenario | Firecrawl (Hobby) | Firecrawl (Standard) | OpenAI | Total (Hobby) | Total (Standard) |
|---|---|---|---|---|---|
| 5 platforms, 5 results each | $0.080 | $0.020 | $0.005–$0.010 | **$0.085–$0.090** | **$0.025–$0.030** |
| 8 platforms, 5 results each (typical) | $0.128 | $0.032 | $0.005–$0.015 | **$0.133–$0.143** | **$0.037–$0.047** |
| 8 platforms, 10 results each | $0.128 | $0.032 | $0.010–$0.030 | **$0.138–$0.158** | **$0.042–$0.062** |
| 8 platforms, 15 results each | $0.128 | $0.032 | $0.015–$0.045 | **$0.143–$0.173** | **$0.047–$0.077** |

OpenAI cost only hits **eBay + Vestiaire** (LLM-fallback platforms). The other 6 platforms have deterministic structured extractors and use **zero LLM tokens**. See "What was wrong before" at the bottom for the diff vs. the previous estimates.

---

## What's actually using credits

### Firecrawl (search only)

Today the pipeline calls `firecrawl.search(siteQuery, { limit: 20 })` once per platform ([lib/firecrawl.ts:46](lib/firecrawl.ts#L46)). At 20 results, that's **4 credits per platform** (2 credits per 10 results). With 8 working Firecrawl platforms (ThredUp bypasses Firecrawl entirely):

```
8 platforms × 4 credits = 32 credits per search
Hobby ($0.004/credit):    $0.128 per search
Standard ($0.00099/credit): $0.032 per search
```

If we ever wired Firecrawl scrape into the pipeline, basic scrapes add **1 credit/URL** (5 results = 5 credits/platform; 10 results = 10 credits/platform). With JSON format or stealth proxy it's **5 credits/URL** — the modifier costs add up fast at scale. See [docs/FIRECRAWL_PRICING.md](docs/FIRECRAWL_PRICING.md#worked-examples) for worked scenarios.

### OpenAI (only for unstructured platforms)

LLM extraction runs only when the structured extractor in [crawl4ai-service/structured_extractors.py](crawl4ai-service/structured_extractors.py) doesn't match. Today that registry covers:

| Platform | Extractor type | LLM tokens used |
|---|---|---|
| Grailed | JSON-LD `@type=Product` | 0 |
| Depop | JSON-LD `@type=Product` | 0 |
| Poshmark | og:* + h1 + inventory_status | 0 |
| StockX | `data-testid='trade-box-buy-amount'` | 0 |
| Mercari | `__NEXT_DATA__` SSR JSON | 0 |
| Vinted | regex over inline JSON | 0 |
| ThredUp | search-page JSON-LD grid | 0 |
| **eBay** | none → LLM extraction (chunked) | high |
| **Vestiaire** | none → LLM extraction | medium |

Real OpenAI cost is dominated by eBay (~50 KB HTML, chunked into 3–4 segments) and Vestiaire. GPT-4o-mini pricing (May 2026): $0.15 / 1M input, $0.60 / 1M output. Rough order-of-magnitude:

- **eBay**, per URL: ~12k input tokens × 2 chunks × $0.15/1M ≈ $0.0036 per URL.
- **Vestiaire**, per URL: ~7k input tokens × $0.15/1M ≈ $0.0011 per URL.

At 5 URLs each: eBay $0.018 + Vestiaire $0.0055 ≈ **$0.024 of OpenAI per full search**. These are estimates; real numbers will come from the token tracker once it's wired (gated behind `TOKEN_TRACKING=1`).

### crawl4ai (no per-request cost)

The Python sidecar runs locally — Playwright instances, no third-party billing. The "cost" of crawl4ai is wallclock + local CPU, not dollars.

---

## Per-platform cost detail (typical: 5 results, "gucci bag")

| Platform | Firecrawl search credits | OpenAI per URL | Listings expected | Firecrawl $ (Hobby) | OpenAI $ |
|---|---|---|---|---|---|
| Grailed | 4 | $0 (struct) | 4–5 | $0.016 | $0.00 |
| Depop | 4 | $0 (struct) | 4–5 | $0.016 | $0.00 |
| Poshmark | 4 | $0 (struct) | 4–5 | $0.016 | $0.00 |
| StockX | 4 | $0 (struct) | 3–5 | $0.016 | $0.00 |
| Mercari | 4 | $0 (struct) | 4–5 | $0.016 | $0.00 |
| Vinted | 4 | $0 (struct) | 4–5 | $0.016 | $0.00 |
| eBay | 4 | ~$0.0036 | 2–4 | $0.016 | ~$0.014 |
| Vestiaire | 4 | ~$0.0011 | 3–5 | $0.016 | ~$0.005 |
| **ThredUp** | **0** (bypasses Firecrawl) | $0 (struct grid) | 8–12 | $0 | $0 |
| **TOTAL** | **32** | | **~35** | **$0.128** | **~$0.019** |

**Per search (Hobby): ~$0.147 · Per listing: ~$0.004**

On Standard plan ($0.00099/credit) the Firecrawl portion drops 4×, total per search ≈ **$0.051**.

---

## How HTML size translates to OpenAI cost

Per-URL token math for an LLM-extracted platform:

```
~12,000 char HTML  ÷ 4 chars/token  = 3,000 input tokens
+ 300 token system prompt
≈ 3,300 input tokens × $0.15/1M    = $0.0005
+ ~150 output tokens × $0.60/1M    = $0.0001
                                   ≈ $0.0006 per URL
```

eBay is the outlier — its HTML is ~50 KB and the extractor uses `apply_chunking=True` ([crawl4ai-service/extractors.py:95](crawl4ai-service/extractors.py#L95)), splitting into 3–4 segments → ~$0.0036/URL.

---

## Cost drivers & optimization

### Biggest levers, ranked

1. **Concurrency / wallclock, not cost.** The biggest "expensive" feeling for users right now is search latency, not dollars. Cost is already a few cents.
2. **eBay LLM extraction.** ~85% of OpenAI cost for the typical search. Ship a structured extractor for eBay → near-zero OpenAI cost.
3. **Firecrawl search `limit`.** Hard-coded to 20 ([lib/firecrawl.ts:46](lib/firecrawl.ts#L46)). The pipeline only keeps the top 5 ([app/api/search/route.ts:57](app/api/search/route.ts#L57)) → we're paying 4 credits/platform but using 25% of the results. If we either (a) lower the search limit to 10 (2 credits/platform, halving search cost) or (b) raise the kept count to 10+, we'd burn less waste.
4. **Caching repeated queries.** Same-query repeats inside a session burn full credits today.

### Cheap to skip / expensive to add

| Change | Δ cost/search (Hobby) | Notes |
|---|---|---|
| Drop search `limit` from 20 → 10 | **−$0.064** | Loses some redundancy for deduping but cuts Firecrawl cost in half |
| Raise kept results from 5 → 10 (basic Firecrawl scrape if we switch) | +$0.040 | Doubles Firecrawl scrape spend; structured-extractor platforms still $0 OpenAI |
| Switch to Firecrawl scrape (basic) for all 8 platforms × 5 results | +$0.16 | Loses crawl4ai's zero-marginal-cost scraping |
| Switch to Firecrawl scrape + JSON format | +$0.96 | 5× scrape credits — only worth it if it unblocks sites crawl4ai can't (eBay, Vestiaire, RealReal) |

---

## Revenue model recommendations (orientation only)

At a real cost of ~$0.05 (Standard) – $0.15 (Hobby) per search, even Hobby pricing supports a freemium model. Suggested anchor:

```
Free tier:  20 searches / month  (cost to you: $3 / user / month at most)
Pro tier:   unlimited @ $4.99/mo (your typical heavy user costs ~$5 → barely break even, sponsor with margins)
```

The numbers from the **previous version of this file** suggested $0.46–$0.60/search and recommended $0.10/search pricing — both were predicated on the inflated Firecrawl math. Re-tune monetization once the bake-off (`scripts/engine_bakeoff.py`) returns real numbers.

---

## How to run the cost tools

### Estimate only (no API calls)

```bash
python scripts/token_cost_analysis.py --queries "gucci bag"
```

Uses platform-typical HTML sizes from a static table to project costs. Good for what-if scenarios.

### Real measurement (requires running stack + token tracker)

```bash
# 1. Enable tracker (default-off; production unaffected without this)
export TOKEN_TRACKING=1
npm run dev:all

# 2. Run a search via the UI or curl

# 3. Inspect logs
tail crawl4ai-service/../token_usage.jsonl
```

The bake-off harness `scripts/engine_bakeoff.py` consumes this same log to compute real per-engine costs.

---

## Key insights

1. **Firecrawl is ~$0.13/search, not ~$0.44.** The old number conflated per-URL scrape cost (we don't pay) with per-platform search cost.
2. **OpenAI is small in absolute terms** (~$0.02/search) and concentrated on eBay + Vestiaire. The biggest cost-reduction lever is shipping structured extractors for those two, not switching LLM models.
3. **crawl4ai scraping is effectively free at the margin.** The trade-off vs. Firecrawl scrape is engineering effort & success rate on hostile sites, not dollars.
4. **The `limit: 20 → slice(0,5)` is the largest piece of waste in the current pipeline.** Either lower the search limit, or use more of the results we paid for.
5. **The pipeline is cheap enough today that volume — not unit cost — should drive monetization decisions.** Re-check after the bake-off.

---

## What was wrong before (changelog)

Prior version (May 2026) claimed:
- **"Firecrawl: 110 credits = $0.44 per search."** Wrong basis: assumed 3–4 credits/URL for scraping. We don't use Firecrawl for scraping; per-URL credit is **0**.
- **"Combined total per search: ~$0.46–0.60."** Real number is ~$0.13–0.17 Hobby, ~$0.04–0.07 Standard.
- **"Firecrawl dominates costs (~80%)."** Inverted: Firecrawl is now ~80% of a much smaller pie. Per-search dollars are dominated by Firecrawl **search credits**, not URL scrapes.
- **Per-platform "firecrawl_credits_per_url" table** in `scripts/token_cost_analysis.py` (2, 3, or 4 credits per platform) — wrong number, wrong concept.

Corrected: 2026-05-19, sourced from [docs/FIRECRAWL_PRICING.md](docs/FIRECRAWL_PRICING.md) and confirmed against actual code paths in [lib/firecrawl.ts](lib/firecrawl.ts) and [crawl4ai-service/main.py](crawl4ai-service/main.py).
