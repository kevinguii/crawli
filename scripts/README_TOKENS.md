# Token & Cost Measurement Tools

Scripts to measure and estimate OpenAI + Firecrawl costs for Crawli searches.

> **Pricing source of truth:** [docs/reference/FIRECRAWL_PRICING.md](../docs/reference/FIRECRAWL_PRICING.md). The numbers below should match that file; if they don't, that file wins — update this one.

---

## Tools at a glance

| Script | Purpose | API calls |
|---|---|---|
| `token_cost_analysis.py` | Estimate per-search cost from platform-typical HTML sizes | calls `/api/search` once per platform to count returned listings |
| `engine_bakeoff.py` | Compare crawl4ai vs Firecrawl scrape head-to-head on a fixed URL set | Firecrawl scrape (real) + sidecar scrape (real) |
| `limit_sweep.py` | Run the same query at per-platform-limit ∈ {5, 10, 15} and compare cost / time / dup rate | calls `/api/search` 3× |
| `measure_tokens.py` | Older lookalike of token_cost_analysis (now superseded; kept for backwards-compat) | calls `/scrape-search` for some platforms |

---

## Estimate costs (no Firecrawl scrape, no LLM run)

```bash
python scripts/token_cost_analysis.py --queries "gucci bag"
```

Output sketch:

```
📊 Analyzing: "gucci bag"
  🔍 grailed       ✓ 5 listings |     0 in-tokens | $0.01600
  🔍 depop         ✓ 5 listings |     0 in-tokens | $0.01600
  🔍 poshmark      ✓ 5 listings |     0 in-tokens | $0.01600
  ...
  🔍 ebay          ✓ 3 listings |74,400 in-tokens | $0.02716
  🔍 vestiaire     ✓ 4 listings |30,800 in-tokens | $0.02062
  🔍 thredup       ✓ 9 listings |     0 in-tokens | $0.00000

💰 COST SUMMARY
   OpenAI (GPT-4o-mini): ~$0.02
   Firecrawl:            $0.128  (32 credits @ Hobby $0.004/cr)
   TOTAL:                ~$0.15
```

Three things changed from the old README:

1. **Firecrawl is search-only.** We don't pay per-URL scrape credits.
2. **Structured-extractor platforms cost $0 OpenAI** (Grailed, Depop, Poshmark, StockX, Mercari, Vinted, ThredUp).
3. **The big OpenAI line items are eBay and Vestiaire**, not "every platform."

---

## Test specific platforms

```bash
python scripts/token_cost_analysis.py --platforms grailed depop poshmark
```

---

## Cost breakdown breakdown

```
OpenAI:   $0.02     ← only eBay + Vestiaire hit the LLM
Firecrawl: $0.13    ← search calls only (8 platforms × 4 credits @ Hobby)
─────────────────
TOTAL:    ~$0.15
```

**Key insight:** the search-credit limit setting (currently 20 in `lib/firecrawl.ts:46`) is the largest controllable cost lever. Lowering it to 10 halves Firecrawl cost. We currently slice to top 5 of those 20, so 75% of search credits are "wasted" on URLs we never look at.

### Token type & price

| Token type | What | Price |
|---|---|---|
| Input | HTML + system prompt | $0.15 / 1M (GPT-4o-mini) |
| Output | JSON response | $0.60 / 1M |

### Per-platform cost (typical, 5 results)

**Free (structured extractor → no LLM):**
Grailed, Depop, Poshmark, StockX, Mercari, Vinted, ThredUp.

**Has cost (LLM-only):**
- eBay: ~$0.014 / search (50 KB HTML, chunked into 3–4 segments)
- Vestiaire: ~$0.005 / search

**Firecrawl search cost (every platform except ThredUp/RealReal):**
4 credits per platform = $0.016 on Hobby, $0.004 on Standard.

---

## Optimization levers

### 1. Lower the Firecrawl search `limit`

```ts
// lib/firecrawl.ts:46 — currently
client.search(siteQuery, { limit: 20 })  // 4 credits
// Try:
client.search(siteQuery, { limit: 10 })  // 2 credits — cuts Firecrawl in half
```

Trade-off: less redundancy for the de-duper at [app/api/search/route.ts:57](../app/api/search/route.ts#L57). May be fine — run `limit_sweep.py` to find out.

### 2. Ship a structured extractor for eBay or Vestiaire

These are the only LLM-fallback platforms. A working DOM/JSON-LD extractor drops their OpenAI cost to $0 — same trick we already use for Mercari/Vinted/StockX.

### 3. Cache same-query repeats

A 1-hour in-memory cache on `(query, platforms)` would catch back-to-back retries from the user changing filters but not the query.

---

## How to capture real OpenAI token usage

The estimator above is, well, an estimator. To capture real numbers:

### Enable the token tracker (gated — production unaffected by default)

```bash
export TOKEN_TRACKING=1
npm run dev:all
```

Search via the UI, then:

```bash
tail token_usage.jsonl
```

You'll see one row per LLM call with real `input_tokens` and `output_tokens` from the OpenAI response. The bake-off harness reads this same log to compute per-engine real costs.

**With `TOKEN_TRACKING` unset, no logging happens** — same code path as before, zero cost overhead.

---

## Real-world cost examples (corrected)

### Light usage

```
Searches/month: 10 (5 platforms each)
Cost/search:    $0.09 (Hobby)
Monthly:        $0.90
```

### Medium usage (fashion blogger)

```
Searches/month: 100 (8 platforms each)
Cost/search:    $0.14
Monthly:        $14
```

### Heavy usage (reseller)

```
Searches/day:   10 → 300/month
Cost/search:    $0.15 (Hobby) / $0.05 (Standard)
Monthly:        $45 Hobby / $15 Standard
```

A $4.99/mo Pro tier covers the reseller at Standard plan with margin. At Hobby pricing, $4.99 doesn't quite cover heavy users.

---

## Files

| File | Purpose |
|------|---------|
| `token_cost_analysis.py` | Cost estimator (current) |
| `measure_tokens.py` | Older estimator (superseded; numbers unchanged) |
| `engine_bakeoff.py` | crawl4ai vs Firecrawl scrape comparison |
| `limit_sweep.py` | 5 / 10 / 15 results-per-platform comparison |
| `../docs/reference/FIRECRAWL_PRICING.md` | Canonical pricing |
| `../docs/engine_bakeoff_findings.md` | Bake-off results + per-platform verdicts |
| `../crawl4ai-service/token_tracker.py` | Real-token instrumentation |

---

## FAQ

**Q: Is Firecrawl still the dominant cost driver?**
Yes, but now in the $0.13 range, not $0.44. The old README had per-URL scrape cost attributed to Firecrawl — wrong, that's crawl4ai (local, $0).

**Q: Can I reduce Firecrawl costs further?**
Drop the search `limit` from 20 to 10 (single line change, cuts cost in half), ship an eBay structured extractor (kills the biggest OpenAI item), or move to the Standard plan ($99/mo) where per-credit pricing is 4× cheaper.

**Q: Claude vs GPT-4o-mini?**
Claude Haiku 4.5 is comparable in price; Claude Sonnet 4.6 is ~10× more expensive on input. At our token volumes (few thousand input tokens per LLM call), even Sonnet would only be ~$0.30/search, not catastrophic. GPT-4o-mini default is fine.

**Q: How often should I update pricing?**
Update [docs/reference/FIRECRAWL_PRICING.md](../docs/reference/FIRECRAWL_PRICING.md) when Firecrawl changes their pricing page (check quarterly). OpenAI: same. This README should track that file.
