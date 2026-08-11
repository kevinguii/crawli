# Sold Comps — Design Spec

**Created:** 2026-08-10 · **Owner:** Kevin · **Status:** approved, in implementation

Implements Step 1 of `docs/planning/COMPETITIVE_POSITIONING.md`. Measured as EXP-004.

---

## 1. What this is

Crawli's search returns live asking prices only. For a reseller deciding whether to
buy, asking price is close to worthless — what matters is what the item actually sold
for and how fast. This adds median sold price and days-to-sell to the results page,
and makes the margin calculator default to sold price instead of average ask.

## 2. Probe findings that shaped this (2026-08-10, all verified live)

The doc's original plan assumed sold comps meant adding a `sold` flag to the grid
scrapers. That is the wrong layer for two of three platforms.

| Platform | Sold filter | Transport | Sale price | Sale date | Days-to-sell | Verdict |
|---|---|---|---|---|---|---|
| **Grailed** | Algolia index `Listing_sold_production` | plain HTTPS POST | `sold_price` (true final) | `sold_at` exact | yes | **in scope** |
| **Poshmark** | `availability=sold_out&sort_by=recently_sold` | plain HTTP GET | `price_amount` (last ask) | `inventory.status_changed_at` | yes | **in scope** |
| Mercari | `itemStatuses=2` | browser render (raw 403s) | first `$` in card | **none in DOM** | no | out — cut for cost + no date |
| ThredUp | none — `availability=sold` ignored | — | — | — | — | **ruled out by probe** |

Because both in-scope platforms are plain HTTP, **the Python sidecar does not change
at all.** No `sold` flag on `ScrapeSearchRequest`, no cache-key change, no new
`wait_for`. This is entirely TypeScript.

**ThredUp is a correction to the doc**, which listed it as a promising cheap
candidate ("may be the cheapest platform of all"). Probed: `availability=sold` is
ignored, returning 119 items of which 114 were in-stock and 5 incidentally sold.
No sold filter exists. Do not re-probe without new evidence.

### Measured examples (Grailed, 90-day window)

```
supreme box logo hoodie → 6,753 sold all-time · 354 in 90d · median $178 (p25 $154/p75 $200) · 21.4d to sell
nike air jordan 1       → 15,440 sold all-time · 295 in 90d · median $122 · 48.9d to sell
carhartt wip jacket     →  5,689 sold all-time ·  80 in 90d · median $102 · 37.4d to sell
```

### Non-obvious facts worth keeping

- Poshmark's `sort_by` is **validated** — a nonsense value returns zero rows. That is
  how `recently_sold` was proven real rather than silently ignored.
- Poshmark's **default** sort returns sales up to 6.6 years old (median 203 days).
  Without `sort_by=recently_sold` the median is meaningless.
- Poshmark's JSON blob beats its own DOM: 48 rows vs 27, because sold cards render
  differently. Parse `window.__INITIAL_STATE__`, not the grid.
- Grailed's `public_search_key` is in the SSR HTML of any shop page. The sold filter
  is login-gated in the UI (`?sold=true` never switches the index, and the checkbox
  fires nothing logged-out), but the index itself answers to the public key.

## 3. Scope

**In:** Grailed + Poshmark, auto-loaded, inline in the existing margin panel.

**Out, deliberately:** Mercari, ThredUp, eBay, StockX. No new page. No
`watchlist`-derived days-to-sell (10 rows today — long game, not v1). **No
sell-through metric** — Poshmark's total is all-time-sold and caps at 5000 while
Grailed's is a true 90-day window; the denominators are not comparable and one
blended number would mislead.

## 4. Architecture

New `lib/soldComps/`, pure TypeScript:

| File | Responsibility |
|---|---|
| `types.ts` | `SoldComp`, `PlatformSoldStats`, `SoldCompsResult` |
| `grailed.ts` | Algolia query + key management |
| `poshmark.ts` | URL build, fetch, `__INITIAL_STATE__` parse |
| `aggregate.ts` | relevance filter, outlier trim, stats, window widening |
| `index.ts` | `getSoldComps(query)` — runs both platforms in parallel |

Both adapters normalize to one shape (`price`, `soldAt`, `listedAt`, `title`, `url`,
`size`, `condition`). The aggregator is platform-agnostic except for labeling.

**Data flow:** `ResultsDisplay` renders → client `POST /api/sold-comps {query}` →
route checks cache → `getSoldComps()` → both platforms in parallel → per-platform
stats → `PriceSummary` renders panel and seeds `FlipMargin`.

Separate endpoint, called after results land. **`/api/search`'s streaming NDJSON path
is untouched** (CLAUDE.md rule 4).

## 5. Aggregation rules

Per platform, in order:

1. **Relevance filter** — reuse `titleMatchesQuery` from `lib/parse.ts` (exported for
   this; previously module-private). Required: the probe found a $1,375 median for
   "nike air jordan 1" on Poshmark sorted by price, i.e. wrong items.
   Sold comps must **not** route through `parseScrapedListings`, which drops
   `isSold` items at `parse.ts:171`.
2. **Window widening** — 90d, else 180d, else 365d. Grailed filters server-side via
   `numericFilters: ["sold_at_i>=…"]`; Poshmark needs no extra request because
   `sort_by=recently_sold` already returns newest-first.
3. **IQR outlier trim** on price.
4. **Floor: n ≥ 10** after filtering. Below that at 365d the platform is omitted. If
   neither platform qualifies, return `{ available: false }` and render nothing.
5. **Stats:** `median`, `p25`, `p75`, `n`, `windowDays`, `daysToSell`.

Every figure ships with the window it came from, so the UI reads "median of 23 sales,
last 180 days" — never a bare number.

## 6. Grailed key management

Default `MNRWEFSS2Q` / `c89dbaddf15fe70e1941a109bf7c2a3d`. On 403: GET any Grailed
shop page, extract `"public_search_key":"([a-f0-9]{32})"`, cache in module memory,
retry once. If the retry fails, Grailed is omitted and Poshmark still renders.
**One platform failing never blanks the panel.**

## 7. Caching and quota

- New table `sold_comps_cache(key text pk, payload jsonb, expires_at timestamptz)`,
  mirroring `search_listings_cache`. **24h TTL** — a 90-day median does not move
  hour to hour. Needs explicit `GRANT ... TO authenticated, service_role` or it 503s
  (PITFALLS).
- **Does not consume a search credit.** It rides along with a search already paid
  for, costs two HTTP requests, and charging would suppress the exposure EXP-004
  needs to measure.

## 8. UI

`PriceSummary.tsx:109` defaults `FlipMargin`'s resale to `averagePrice ?? priceRange.max`
— average *ask*. Becomes: median sold when available, falling back to current
behavior when not. Average-ask stays a one-tap secondary option, matching the
existing pattern at `:184`. Light + dark both verified.

## 9. Honesty constraints on copy

These are limitations of the data, not of the implementation. Claim C1 copy must
respect them:

- **Poshmark's price is the asking price at time of sale, not the accepted offer.**
  Poshmark hides accepted offers, so Poshmark medians skew high. Do not write "what
  it actually sold for" for Poshmark. Grailed's `sold_price` *is* the true final.
- Days-to-sell is Grailed + Poshmark only, and the claim must name the two
  marketplaces rather than implying breadth.
- No sell-through claim at all in v1.

## 10. Testing

No test runner exists in this repo; the convention is `scripts/*.mjs` verification
scripts. Following that.

- `scripts/verify-sold-comps.mjs` — aggregation unit checks against fixtures captured
  from the 2026-08-10 probes (median, IQR trim, window widening, n<10 omission),
  then a live smoke run across the four probed queries plus a deliberately obscure
  query to confirm the panel correctly renders nothing.
- `npx tsc --noEmit` clean.
- Real browser, light + dark. Owner's to verify.
