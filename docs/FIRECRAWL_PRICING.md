# Firecrawl Pricing — Canonical Reference

**Last verified:** 2026-05-19 against Firecrawl docs.

This is the source of truth for Firecrawl credit costs in this project. If a number in any `scripts/*.py` cost-estimator conflicts with this file, **this file wins** — update the others.

---

## Credit costs per action

### Search endpoint

**2 credits per 10 results returned.**

| Results requested | Credits |
|---|---|
| 10 | 2 |
| 20 | 4 |
| 50 | 10 |
| 100 | 20 |

The current production pipeline requests 20 results per platform ([lib/firecrawl.ts:46](../lib/firecrawl.ts#L46)), so each platform-search call costs **4 credits**.

### Scrape endpoint (per URL)

**Base scrape: 1 credit per URL.**

Modifiers (additive):

| Modifier | Extra credits | Notes |
|---|---|---|
| `formats: ['json']` (LLM-structured extraction) | +4 | Use Firecrawl's own JSON-extraction; **not** what we use today. |
| `proxy: 'stealth'` / enhanced proxy | +4 | Use Firecrawl's stealth proxy for hard-blocked sites (eBay, Vestiaire, TRR candidates). |
| Screenshot | included in base | No extra charge. |
| PDF parsing | +1 per page | N/A for fashion listings. |
| Audio/video extraction | +4 | N/A. |

So:
- Basic scrape (markdown only, no proxy): **1 credit/URL**
- Scrape + JSON: **5 credits/URL**
- Scrape + stealth proxy: **5 credits/URL**
- Scrape + JSON + stealth proxy: **9 credits/URL**

### Worked examples

**Scenario A — 1 platform × 10 search results, scrape all:**
- Search: 2 credits
- Scrape 10 URLs basic: 10 credits
- **Total: 12 credits**

**Scenario B — 10 platforms × 5 results each, scrape all (basic):**
- Search: 10 × 1 = 10 credits (5 results → 1 credit per platform, rounded up)
- Scrape: 10 × 5 × 1 = 50 credits
- **Total: 60 credits**

**Scenario C — 10 platforms × 20 results each, scrape all (basic):**
- Search: 10 × 4 = 40 credits
- Scrape: 10 × 20 × 1 = 200 credits
- **Total: 240 credits**

**Scenario D — Same as C but with JSON-format scrape:**
- Search: 40 credits
- Scrape: 200 × 5 = 1,000 credits
- **Total: 1,040 credits**

---

## Credit → dollar conversion

| Plan | Monthly cost | Credits/mo | $/credit |
|---|---|---|---|
| **Hobby** | $20 | 5,000 | $0.00400 |
| **Standard** | $99 | 100,000 | $0.00099 |

So the same 60-credit search costs:
- Hobby: $0.24
- Standard: $0.06

### Quick reference table

| Action | Credits | Cost (Hobby) | Cost (Standard) |
|---|---|---|---|
| Search 10 results | 2 | $0.008 | $0.002 |
| Search 20 results | 4 | $0.016 | $0.004 |
| Search 100 results | 20 | $0.080 | $0.020 |
| Scrape 1 URL (basic) | 1 | $0.004 | $0.001 |
| Scrape 10 URLs (basic) | 10 | $0.040 | $0.010 |
| Scrape 100 URLs (basic) | 100 | $0.400 | $0.099 |
| Scrape 1 URL + JSON | 5 | $0.020 | $0.005 |
| Scrape 10 URLs + JSON | 50 | $0.200 | $0.050 |
| Scrape 1 URL + stealth | 5 | $0.020 | $0.005 |

---

## Concurrency caps

- **Hobby ($20/mo):** 5 concurrent requests
- **Standard ($99/mo):** 50 concurrent requests

crawl4ai (our current scrape engine) has no provider-imposed concurrency cap — it's bounded only by local CPU/Playwright instances, which is why the current sidecar serves all 8 platforms in parallel with per-platform internal queues.

---

## What this project uses today

**As of 2026-05-19:**

- **Search only.** [lib/firecrawl.ts:46-49](../lib/firecrawl.ts#L46-L49) calls `client.search(siteQuery, { limit: 20 })` — markdown response, no JSON format, no enhanced proxy.
- **No Firecrawl scrape.** All per-URL scraping runs through the crawl4ai sidecar ([crawl4ai-service/main.py](../crawl4ai-service/main.py) `POST /scrape`).
- **ThredUp** and **The RealReal** (when re-enabled) bypass Firecrawl entirely — they use the sidecar's `/scrape-search` grid extraction.

### Real per-search Firecrawl cost today

8 working Firecrawl-search platforms × 4 credits (limit=20) = **32 credits per full search**.

- Hobby: **$0.128 per search**
- Standard: **$0.032 per search**

Per-URL scrape cost: **$0.00** (crawl4ai, not Firecrawl).

OpenAI cost: only for eBay + Vestiaire (no structured extractors). The other 6 Firecrawl-search platforms use deterministic JSON-LD / DOM extractors — zero LLM tokens. See [engine_bakeoff_findings.md](engine_bakeoff_findings.md) §3 for measured token costs.

---

## When the math changes

If you switch the production pipeline to Firecrawl scrape (basic), the per-search cost becomes:

```
8 platforms × 4 credits (search, limit=20)              = 32 credits
8 platforms × 5 results × 1 credit (scrape basic)       = 40 credits
                                                        = 72 credits
Hobby:    72 × $0.004   = $0.288 per search
Standard: 72 × $0.00099 = $0.071 per search
```

If you raise per-platform results from 5 to 10:

```
8 × 4 (search at limit=20)        = 32 credits
8 × 10 × 1 (scrape)               = 80 credits
                                  = 112 credits
Hobby:    112 × $0.004   = $0.448 per search
Standard: 112 × $0.00099 = $0.111 per search
```

If you also need JSON format on every scrape:

```
8 × 4 (search)                    = 32 credits
8 × 10 × 5 (scrape + JSON)        = 400 credits
                                  = 432 credits
Hobby:    432 × $0.004   = $1.73 per search
Standard: 432 × $0.00099 = $0.428 per search
```

---

## Update this file when

- Firecrawl publishes a new pricing page (check quarterly).
- We switch to a different plan or buy add-on credits.
- We start using JSON format or enhanced proxy in production calls (so the modifier columns become "actually used").
