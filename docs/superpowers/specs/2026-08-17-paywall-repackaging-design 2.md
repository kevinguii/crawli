# Paywall repackaging: two plans, feature gates instead of inert caps

**Date:** 2026-08-17
**Status:** approved design, not yet implemented
**Owner decision log:** see "Decisions taken" below

---

## 1. Problem

Crawli has 46 users and zero real paying customers. The one `max` account is the
owner's own personal account.

The cause is not that the free tier is too generous on volume. It is that **no free
user has ever encountered a locked door.**

Live figures pulled 2026-08-17:

| Metric | Value |
|---|---|
| Users | 46 |
| Paying (excluding owner) | **0** |
| Signups last 30d | 25 |
| Of those 25, completed onboarding | **6** |
| Searched in last 30d | 22 users, avg **2.18** searches, max 7 |
| Users at or over the 5/week free cap | **1** |
| Searched exactly once in 30d | 11 of 22 |
| Searched on 2+ distinct days | **3 of 22** |
| Alerts | 11 across 8 users (was 5 across 3 on 2026-08-10) |
| `saves` | 195 rows, 4 users, **no cap in `TIER_CAPS`** |
| `watchlist` | 10 rows, 4 users, most anyone tracks is 6, cap is 50 |

Two structural findings follow:

**(a) Every existing cap is inert.** At 2.18 searches/month nobody reaches 5/week.
The watchlist cap of 50 sits above a real maximum of 6. Caps that are never reached
do no commercial work at all.

**(b) Pro and Max are not tiers, they are volume discounts.** Five of six lines on
the Max card are Pro features with larger integers. The only capability exclusive to
Max is an alert health sparkline. Charging 3x for headroom that the average user will
never touch explains why 0 of 46 users chose Pro.

## 2. Governing principle

> **Free shows you listings. Pro tells you what they mean.**

Raw listings, prices, links and images are free. Anything *computed* is paid: median,
range, sold history, days-to-sell, flip margin. This is one sentence a user
understands immediately, and it maps honestly onto where the engineering work is.

Gates are chosen so they are **felt on use, not on a cap**. A user who searches twice
a month never hits a weekly quota, but sees a shallower result list on every single
search.

## 3. Decisions taken

| # | Decision | Rationale |
|---|---|---|
| D1 | Optimise the structure, not near-term revenue | At 46 users the revenue delta is negligible. Grandfathering 46 people is trivial; repricing 5,000 is not. |
| D2 | Collapse three plans to two: Free and Pro | Zero demand signal for the middle tier. One paid plan means every premium feature points at one purchase. |
| D3 | Keep Pro at $10/mo, $3/wk, $100/yr | Stripe prices already provisioned. With no pricing signal, change one variable at a time; the feature split is the variable under test. |
| D4 | Retire Max from the pricing page, keep it resolvable in code | `tierFromPriceId` must keep handling it. Owner migrates their own account to Pro. |
| D5 | Sold comps and price intelligence are fully paid | The only differentiated capability, cheap to serve, and the category already prices it ($29+/mo for WorthPoint). |
| D6 | Alerts stay free but thin: 1 alert, weekly only | Alerts are the only metric with a positive slope, and the only mechanism producing second visits. Killing them would remove the retention engine. |
| D7 | Alert criteria (size, minPrice, maxPrice) stay free | Onboarding's `CriteriaStep` collects them from every user before they have a plan. Gating them breaks the shipped flow. Also unadopted, so it creates no desire. |
| D8 | No trial, no reverse trial | Owner preference: a clean basic vs premium split. Also 75% of searchers are active on exactly one day, so a time-boxed trial would mostly expire unwitnessed. |
| D9 | Hard cutover for all 46 accounts on launch day | Owner decision. Cleanest data: every user sits on one of two known plans. Once the owner moves to Pro, **no account resolves to `max`**, so it survives only as dead-but-safe code per D4, not as a live tier. |
| D10 | Locked panels render in place, not hidden | A visible locked door with the user's own query echoed back converts. A missing nav item does nothing. |
| D11 | Over-cap users are never truncated | One free user has 26 saves. They keep all 26 and are blocked from adding an 11th until under the cap. Deleting user data to enforce a new cap turns a pricing change into a support incident. |

## 4. Target plan matrix

| | **Free** | **Pro** ($10/mo) | Change |
|---|---|---|---|
| Searches / week | 5 | 40 | unchanged |
| Results per native platform | **8** | 60 | free 15 → 8 |
| Platforms | all 9 | all 9 | unchanged |
| **Saves** | **10** | 500 | new cap, was ungated |
| Tracked listings | **10** | 500 | free 50 → 10 |
| Alerts | **1** | 8 | free 2 → 1 |
| Alert cadence | **weekly only** | daily or weekly | free 24h → 168h min |
| Alert criteria | yes | yes | unchanged (D7) |
| Price summary (low / median / high) | **locked** | yes | new gate |
| Sold comps | **locked** | yes | new gate |
| Flip margin from real comps | **locked** | yes | new gate |

Legacy `max` retains its current caps for any account still resolving to it.

## 5. Gate strength, stated honestly

The two new gates are **not** equally strong, and the spec should not imply they are.

- **Sold comps is a true server gate.** The data is fetched separately via
  `POST /api/sold-comps`. A free tier check on the server means the prices never
  reach the browser.
- **The price summary is a UI gate only.** Low, average and high are computed
  client-side in `PriceSummary` from listings that have *already* been streamed to
  the browser and are legitimately free. A user with devtools can recompute them.

This is an accepted trade. Making the summary a real server gate would mean
withholding listing prices, which contradicts the governing principle. The summary
gate exists to make the paid layer visible and to create upgrade intent, not to
protect a secret.

## 6. Locked-state design

Panels render at full size with real structure, real labels and real sample sizes.
Only computed values are withheld. The user's query is echoed back so the lock is
specific to what they asked for.

```
┌─ Price summary ──────────── 47 listings ─┐
│  Low        ▓▓▓▓▓                        │
│  Median     ▓▓▓▓▓▓▓        🔒            │
│  High       ▓▓▓▓▓▓                       │
├──────────────────────────────────────────┤
│  Sold comps · "bape shark hoodie"        │
│  Grailed    median ▓▓▓▓   n=34           │
│             sells in ▓▓ days             │
│  Poshmark   median ▓▓▓▓   n=21           │
│                                          │
│     See real numbers → Upgrade $10/mo    │
└──────────────────────────────────────────┘
```

**Sample sizes stay visible on purpose.** `47 listings`, `n=34` prove the data exists
and is substantial, which makes the lock read as a withheld answer rather than an
empty feature.

This requires `/api/sold-comps` to return a **partial response** for free users:
platform names and sample counts only, with every price and days-to-sell field
omitted. Not a 402, not an empty body. A 402 would leave the panel with nothing to
render.

Same treatment on `/price-check`: full page, query accepted, item identified, results
locked. The page stays in the nav.

## 7. Implementation surface

### 7.1 Database

New migration under `docs/migrations/`:

1. `ALTER TABLE profiles ADD COLUMN max_saves int NOT NULL DEFAULT 10` — saves is
   currently ungated and needs a new column. Confirm `GRANT` coverage per the
   project's RLS rule.
2. **Backfill every existing row** on all six cap columns:
   `max_searches_per_period`, `max_saved_searches`, `max_tracked_listings`,
   `native_results_cap`, `min_alert_cadence_hours`, `max_saves`.

   This is the step that was missed on 2026-06-29 and must not be missed again:
   **enforcement reads `profiles` DB-first**, so editing `TIER_CAPS` alone changes
   nothing for existing users.
3. Owner's account moves `max` → `pro` (live Stripe subscription change, owner-run,
   plus the resulting `profiles` row update via the webhook).

Note the `profiles` UPDATE grant was restricted on 2026-08-15 to
`(display_name, bio, avatar_url)` for `authenticated`. All cap writes go through
`service_role`, which is unaffected. Do not widen that grant.

### 7.2 Stale hardcoded fallbacks (drift hazards)

Each of these silently preserves old behaviour when a `profiles` value is null, and
must be repointed at `TIER_CAPS.free`:

| File | Current |
|---|---|
| `app/api/watchlist/route.ts:31` | `?? 50` |
| `app/api/saved-searches/route.ts:83` | `?? 2` |
| `app/api/saved-searches/route.ts:84` | `?? 24` |
| `app/api/saved-searches/[id]/route.ts:89` | `?? 2` |
| `app/components/SearchProgress.tsx:47` | `?? 15` |
| `lib/searchWorker.ts:89,148` | `= 10` default args |

### 7.3 Code

**Caps and billing**
- `lib/stripe.ts` — new `TIER_CAPS` values, add `maxSaves` to `TierCaps`.
- `app/api/webhooks/stripe/route.ts` — write `max_saves` and a per-tier
  `min_alert_cadence_hours` (168 free, 24 pro) in both the downgrade path (~line 98)
  and the upgrade path (~line 167). Currently hardcodes 24 in both.
- `app/api/billing/status/route.ts` — expose the saves cap.

**New gates**
- `app/api/sold-comps/route.ts` — resolve tier, return the partial shape for free.
  Update the file header comment, which currently says it deliberately does not
  charge.
- `app/api/saves/route.ts` — enforce `max_saves` on POST. No cap exists today.

**UI**
- `app/components/PriceSummary.tsx` — accept `locked`, render locked metrics, skip
  the `useSoldComps` fetch when locked is not needed.
- `app/components/SoldCompsPanel.tsx` — locked state rendering sample sizes only.
- `FlipMargin` (inside `PriceSummary.tsx`) — locked state.
- `app/components/ResultsDisplay.tsx` — plumb tier through to `PriceSummary`.
- `app/components/SoldCompsLookup.tsx` and `/price-check` — locked state.
- `app/pricing/PricingCards.tsx` — two cards, rewritten feature lists, Max removed.

**Onboarding**
- `app/onboarding/steps/TailStep.tsx` — the reseller branch currently calls
  `/api/sold-comps` for free. It becomes a preview of the locked panel. The flow must
  still advance if the call fails: a blocking flow with a failing step is a locked
  account.

### 7.4 Marketing surfaces left alone

`FlipCalculator` and `SoldCompsSection` on the landing page stay public. They are
marketing, not product.

## 8. Testing

Nothing here is done on a type-check alone.

1. `npx tsc --noEmit` clean, `eslint` clean, `npm run build` clean.
2. New `scripts/verify-paywall.mts` following the `verify-sold-comps.mts` pattern:
   - every `TIER_CAPS` field has a matching `profiles` column and the backfill
     covers all 46 rows with no nulls
   - `/api/sold-comps` returns the partial shape for a free user and full data for
     Pro, asserting **no price field appears anywhere in the free response body**
   - `/api/saves` rejects the 11th save on free
   - `/api/saved-searches` rejects the 2nd alert on free, and rejects a 24h cadence
   - the over-cap user with 26 saves still reads all 26 back
3. `curl -N` against `/api/search` to confirm the streaming NDJSON protocol still
   works and `nativeResultsCap` is 8 on the wire for a free account.
4. Browser, light and dark, on **two real accounts** (one free, one Pro): locked
   panels on results, `/price-check`, onboarding tail, pricing page.
5. Post-migration SQL verifying the backfill and that the owner's account is `pro`.

## 9. Measurement

Add to `docs/planning/COMPETITIVE_POSITIONING.md` §6c as a new experiment block, with
the hypothesis and kill criterion written **before** launch.

Baseline to beat (frozen 2026-08-07, drift row 2026-08-17):
- 0 real paying users
- 27% second-day return
- 38% one-and-done

**Kill criterion, fixed now and not to be renegotiated after reading the result:**
if 30 days after cutover there are still zero conversions **and** second-day return
has fallen below the 27% baseline, the gate is suppressing activation rather than
converting it. The response is to relax the sold-comps lock to a median-visible
variant (median and sample size free, spread and days-to-sell paid) before anything
else is tuned. Do not respond by tightening further.

With 46 users this is a directional read, not a significant one. Small-n honesty is
part of the record.

Instrument with existing `lib/analytics.ts` `track()`: a `paywall_view` event
{surface: results | price_check | onboarding} and `upgrade_click` {surface}. Without
these, a null result cannot distinguish "nobody saw the wall" from "the wall does not
work."

## 10. Claim ledger impact

`docs/planning/COMPETITIVE_POSITIONING.md` §6b gates what marketing may say. This
change does not validate any claim, so **no landing copy changes are authorised by
this work.** C1 and C5 remain Built, unvalidated. The pricing page is a product
surface, not marketing copy, and may describe the plan matrix factually.

## 11. Out of scope

- Credit packs (`lib/creditPacks.ts`) stay dormant. With a single paid plan they are
  a distraction, and the Stripe one-time prices were never provisioned.
- No price change to Pro (D3).
- No changes to `/api/search`'s streaming protocol beyond the cap value it already
  reads.
- No changes to `crawl4ai-service/`, `lib/parse.ts`, or the search discovery path.
