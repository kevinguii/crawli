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
| D6 | Alerts stay free but thin: 1 alert | Alerts are the only metric with a positive slope, and the only mechanism producing second visits. Killing them would remove the retention engine. |
| D6a | **Revised same day:** free alerts stay on **daily** cadence, not weekly | Owner reversal after D6 shipped. Alert runs are cheap (`lib/searchCache` fans one scrape out to every user watching the same query), and the email is the strongest driver of a second session in a product where only 3 of 22 users return on day 2. Gated by count (1 vs 8), not frequency. `TIER_CAPS.free.minAlertCadenceHours = 24`, same as Pro. The cadence-floor plumbing (PATCH check, modal UI reading the live floor) was built and kept anyway — it's the enforcement for a dial that's meant to stay tunable, not dead code for a decision that got reversed. |
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
| Alert cadence | daily or weekly | daily or weekly | unchanged (see D6a — reversed from an initial weekly-only floor before ship) |
| Alert criteria | yes | yes | unchanged (D7) |
| Price summary (low / median / high) | **locked** | yes | new gate |
| Sold comps | **locked** | yes | new gate |
| Flip margin from real comps | **locked** | yes | new gate |

Legacy `max` retains its current caps for any account still resolving to it.

## 5. Gate strength, stated honestly

**Revised 2026-08-17, mid-build**, after the owner asked for the whole panel to be
blurred with an upgrade overlay on top, and to make sure inspecting the page can't
undo it. That request exposed a real risk in the original per-metric design: if the
Metric grid's `value` prop always held the true formatted price (even while a
separate `locked` flag decided not to render it as text), the number still sat in
that component's props — recoverable via React DevTools even though it never
appeared in the rendered DOM. The fix was structural, not cosmetic: **never
construct the real value in the locked code path at all.**

Both gates are now the same shape and are both defensible against inspection:

- **Sold comps is a true server gate**, unchanged. `POST /api/sold-comps` resolves
  tier and strips every price field before the response leaves the server
  (`toLockedResult`). Verified live: the raw fetch response for a free account
  contains only `platform`, `n`, `windowDays` — no `medianPrice`/`p25`/`p75`/
  `daysToSell` anywhere in the payload.
- **The price summary (low/avg/high) is still structurally a UI gate** — the
  real `priceRange`/`averagePrice` are computed client-side from listings the free
  tier legitimately sees, and that can't change without hiding per-listing prices
  too, which breaks the governing principle. What changed is that the locked
  render path **never receives those real numbers as props in the first place**:
  `PriceSummary` branches before constructing the Metric grid, and the locked
  branch calls `fakePriceString(...)` (`lib/fakePricing.ts`) to build every value
  from scratch. There is no real number anywhere in that subtree's React tree,
  props, or rendered DOM — only in variables that never left the unlocked branch.

**Two remaining honest limitations, both accepted, neither closable without
breaking the governing principle:**

1. A free user can still derive an average by reading the individual listing
   prices already visible in the results grid below the panel, because those are
   real and are supposed to be (free shows listings). No client-side technique
   closes this without hiding per-listing prices too.
2. `PriceSummary` itself — the parent, not the blurred `children` — still
   receives the real `priceRange`/`averagePrice` as its own props, because it
   needs them just to decide whether to render at all
   (`if (!priceRange || totalCount === 0) return null`). Those never reach the
   Metric grid or the blurred subtree, but a user inspecting `PriceSummary`'s own
   props via React DevTools (not the blurred children) would find them there.
   This is not a new leak: it's the same number as limitation 1, just already
   computed instead of requiring hand-averaging.

What the redesign actually closes is the narrower, correct concern the owner
raised: that blurring a real number is a trap, because removing a CSS filter or
reading the props of the component that *renders* the value recovers it. The
blurred backdrop's own subtree — what a naive "unblur it" attempt would target —
never contains a real number to recover, on either surface. Sold comps has no
open limitation at all: the true numbers never leave the server, full stop.

## 6. Locked-state design

**Revised 2026-08-17** — an earlier iteration rendered per-field dashed redaction
blocks with sample counts left in the clear. The owner asked for the whole panel to
be blurred with the upgrade prompt overlaid on top instead, styled as a paywall
(think Medium's "sign in to keep reading"), not a set of individually withheld
fields. Shipped design:

- **`LockedOverlay`** (`app/components/LockedOverlay.tsx`) blurs `children` with
  `filter: blur(8px)`, marks that backdrop `inert` + `aria-hidden` +
  `pointer-events: none`, and layers a centered lock icon, headline, one-sentence
  body, and an "Upgrade to Pro" button on top, unblurred.
- **`children` is always fabricated**, never the real panel with real numbers
  underneath a filter. `lib/fakePricing.ts` deterministically generates
  plausible-looking numbers from non-sensitive seeds (query text, platform,
  label) — stable across re-renders, never derived from anything real. Sample
  size (`n`) and window (`windowDays`) pass through unchanged, since those were
  already established as safe to reveal (they prove the data exists without
  being the data).
- The fabricated content is rendered through the **same components** the
  unlocked view uses (`Metric`, `SoldCompsPanel`) fed fake data, so the blurred
  shape is visually identical to a real panel — that's what makes the paywall
  read as "there's something here," not as a broken widget.
- Verified live (`playwright`, free test account): the browser's actual fetch to
  `/api/sold-comps` returns no price fields at all. Forcibly removing the blur
  filter via `page.evaluate` reveals only the fabricated numbers, which do not
  match the real Pro-tier values for the same query.

**`LockedOverlay` is the one shared primitive**, used two ways: `SoldCompsLockedPanel`
wraps it around a fake `SoldCompsPanel` for the sold-comps-only surfaces
(`/price-check`, the onboarding tail — both via `SoldCompsLookup`), and
`PriceSummary` wraps it directly around a fake `Metric` grid plus a fake
`SoldCompsPanel` plus a static flip-margin bar, since the results page needs the
low/avg/high row that the other two surfaces don't show. One primitive, one
security property (children must never be real), two compositions.

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
- `lib/tierCaps.ts` (new) — `TIER_CAPS`, `resolveTier`, `canSeePriceIntelligence`.
  Moved out of `lib/stripe.ts`, which constructs a Stripe client at import time and
  so cannot be imported from client components or `lib/searchWorker.ts`.
  `lib/stripe.ts` re-exports everything so existing call sites are unchanged.
- `app/api/webhooks/stripe/route.ts` — write `max_saves` and `min_alert_cadence_hours`
  from `TIER_CAPS[tier]` in both the downgrade and upgrade paths (previously
  hardcoded `24` in both, for every tier).
- `app/api/billing/status/route.ts` — expose `caps.saves` and
  `caps.minAlertCadenceHours` (the latter added when the cadence gate was reversed
  — see Decisions D-alerts below).

**New gates**
- `app/api/sold-comps/route.ts` — resolve tier via `resolveTier`, strip prices for
  free via `toLockedResult`, both cache-hit and fresh-compute paths through one
  `respond()` helper.
- `app/api/saves/route.ts` — enforce `max_saves` on POST. No cap existed before.
- `app/api/saved-searches/[id]/route.ts` — PATCH now enforces the cadence floor
  too (POST always had; PATCH never did — a real pre-existing hole, found and
  fixed here).

**UI (revised 2026-08-17, see §5/§6)**
- `lib/fakePricing.ts` (new) — `fakePriceString`, `fakeSoldStats`; every fabricated
  number the locked UI ever renders.
- `app/components/LockedOverlay.tsx` (new) — the shared blur+overlay primitive.
- `app/components/SoldCompsLockedPanel.tsx` (rewritten) — fake `SoldCompsPanel`
  wrapped in `LockedOverlay`; used by `SoldCompsLookup.tsx`.
- `app/components/PriceSummary.tsx` — locked branch builds its own `LockedOverlay`
  around a fake `Metric` grid + fake `SoldCompsPanel` + a static flip-margin bar.
  `Metric` itself is unconditional again — it never receives a real value in the
  locked path, so it doesn't need to know locking exists.
- `app/components/UpgradeInline.tsx` — deleted. Superseded by `LockedOverlay`;
  grepped for zero remaining references before removal.
- `app/pricing/PricingCards.tsx` / `page.tsx` — two cards, rewritten feature lists,
  Max removed, `resolveTier` reused instead of re-deriving tier inline.

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
   - `/api/saved-searches` rejects the 2nd alert on free (alerts are gated by
     count, not cadence — see the alert-cadence reversal in Decisions)
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
