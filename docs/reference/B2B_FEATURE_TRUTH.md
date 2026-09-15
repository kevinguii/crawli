# B2B Feature Truth — Session 1 Foundation

**Status as of 2026-07-11.** Ground truth for Sessions 2 & 3. This file states exactly
what shipped, the tier/cap/overage model, and what the margin calculator covers. Where a
number is a *proposal pending owner sign-off*, it says so explicitly.

Repositioning (updated 2026-07-11): Crawli is a **cross-platform secondhand/vintage price
comparison tool that also serves resellers** (find underpriced inventory + know the real
cross-platform comp and flip margin before buying). Landing copy and metadata speak to both
audiences — resellers (margin/flip framing) and secondhand/vintage shoppers who want the
best price on a piece, even if the latter never convert to paid. Do not revert to
reseller-only "B2B sourcing intelligence" framing on the landing page or in metadata. We do
NOT do cross-listing. The search core is unchanged.

---

## 1. Margin calculator (flip margin)

**Module:** `lib/marketplaceFees.ts` — the ONE source of truth for fees. Never hardcode a
rate in a component.

- Covers the 7 **sell-on** platforms the flip-margin calc supports: **eBay, Poshmark, Mercari,
  Grailed, Depop, Vinted, StockX** (keys match `PLATFORM_DOMAINS` in `lib/types.ts`). This is the
  fee-calculator's scope only — NOT total platform coverage. **Search spans 9 platforms**: these 7
  plus **Vestiaire** and **ThredUp**, which are source-from (buy-side) only and intentionally absent
  from the fee calc (ThredUp is source-only; Vestiaire has no flip-margin entry). RealReal is
  disabled (PerimeterX). See `HANDOFF.md` "Current state" for the live search roster.
- **Seller-payout fees are separated from buyer-side fees.** Net profit uses seller-side only;
  buyer-side fees are stored for context (`buyerCost()`).
- Per-platform `lastVerified` date (all `2026-08-11`) + `FEES_LAST_VERIFIED`. Shown in the UI.
- Exports: `MARKETPLACE_FEES`, `sellerFee()`, `sellerPayout()`, `buyerCost()`,
  `netFlipProfit()` → `{ payout, fees, netProfit, marginPct, roiPct }`, `FEE_PLATFORMS`.
- Non-linear schedules handled via optional `computeSellerFee` override (Poshmark threshold,
  Grailed tiered commission).

**Verified rates (US, default seller status, 2026-08-11 via vendor help pages + fee trackers):**

| Platform | Seller commission | Seller processing | Flat | Buyer-side fee |
|---|---|---|---|---|
| eBay | 13.6% (fashion, no Store) | included in FVF | $0.40/order (>$10) | none |
| Poshmark | flat $2.95 under $15, else 20% | none | — | none |
| Mercari | 10% (item + buyer-paid shipping) | none | — | 3.6% buyer protection |
| Grailed | 9% (≥$120) / 6% min $1.99 (<$120) | 3.49% | $0.49 | none (free for buyers) |
| Depop | 0% (US/UK) | 3.3% | $0.45 | up to 5% + up to $1 |
| Vinted | 0% (no seller fees) | none | — | ~5% + $0.70 buyer protection |
| StockX | 9% (Level 1) → 7% (Level 5) | 3% | — | none |

Caveats live in each entry's `notes` (store subs, international/non-onboarded Grailed rates,
StockX ship-to-auth ~$5, Depop boosted listings 12%). eBay rate corrected 2026-08-11 (was stale
at the pre-2025-02-14 13.25%); StockX Level 1 corrected from 9.5% to the actual 9% (levels run
9% / 8.5% / 8% / 7.5% / 7% across Level 1 → 5, not 9.5% → 8%).

**UI:** `app/components/PriceSummary.tsx` gained a collapsible "Suggested flip margin" panel
(mounted where PriceSummary already renders in `ResultsDisplay.tsx`). Inputs: sourcing price,
destination platform (7), editable resale price defaulting to the search's average comp (one-tap
switch to high). Outputs net profit / margin % / ROI %, a fee breakdown line, and the
`lastVerified` date. Recomputed client-side. Light + dark verified.

Recomputed from the formula after the 2026-08-11 rate fix: eBay sourcing $40 / resale $100 →
fees $14.00, payout $86.00, net $46.00, margin 46%, ROI 115%. Depop same inputs (unchanged) →
fees $3.75, net $56.25, ROI 141%. Both match hand calc; still needs a manual browser check.

---

## 2. Tier / cap / overage model

### Tiers and caps — REPACKAGED 2026-08-17 (two plans)

> **This section was stale.** It described a 3/1/50/10 free tier that had already been
> superseded twice (2026-06-29, then 2026-08-17). `TIER_CAPS` now lives in
> **`lib/tierCaps.ts`**, not `lib/stripe.ts` — that file constructs a Stripe client at
> module scope, so caps were moved somewhere client components can import them.
> `lib/stripe.ts` re-exports them. Read the live table there before writing anything
> from this section.

| Tier | searches/period (7-day) | alerts | cadence | saves | tracked | nativeResultsCap | price intelligence |
|---|---|---|---|---|---|---|---|
| free | 5 | 1 | daily or weekly | 10 | 10 | 8 | 🔒 |
| pro | 50 (marketed "Unlimited") | 25 (marketed "Unlimited") | daily or weekly | 500 (marketed "Unlimited") | 500 (marketed "Unlimited") | 100 (marketed "Unlimited") | ✅ |
| max *(retired)* | 120 | 30 | daily or weekly | unlimited | unlimited | 100 | ✅ |

Pro's marketed "Unlimited" columns are real, finite anti-abuse backstops, not felt
limits — see the block comment above `TIER_CAPS` in `lib/tierCaps.ts` for the
grounding numbers behind each one (searches/results 2026-08-18, alerts 2026-08-18).
Do not write copy from the raw numbers in this table; write "Unlimited" for those
five columns and pull the actual figure from `lib/tierCaps.ts` if you need it.

**`max` is no longer offered.** It is retained in code only so a legacy Stripe price ID
cannot downgrade someone; no account resolves to it. Do not put it in copy.

**Price intelligence is the paid capability.** The price summary (low/median/high), sold
comps, and the flip-margin calculator seeded from median sold are all Pro-only as of
2026-08-17. `/api/sold-comps` strips every price field server-side for free users. The
governing line is *free shows you listings, Pro tells you what they mean*.
Full design: `docs/ARCHIVED_SPECS.md (§ earlier specs)`.

### Overage = prepaid credit packs (debt-proof)
Once a tier's included searches are spent, additional searches draw down **prepaid credits**
bought up front via one-time Stripe Checkout (`mode=payment`). Cash is collected BEFORE
consumption; there is no free-unlimited path. A search only 402s when included cap AND credits
are both 0.

- **Config:** `lib/creditPacks.ts` (`CREDIT_PACKS`). Price IDs come from env vars
  (`STRIPE_PRICE_PACK_SMALL` / `_MEDIUM` / `_LARGE`) — **not created in Stripe by code.**
- **Gate:** `app/api/search/route.ts` — when `used >= cap`, if `search_credits > 0` the search
  runs and decrements one credit instead of incrementing period usage.
- **Grant:** `app/api/webhooks/stripe/route.ts` handles `checkout.session.completed` with
  `mode === 'payment'` → `grantCreditPack()` increments `profiles.search_credits`.
- **Checkout:** `app/api/billing/credits/route.ts` (POST `{ pack: 'small'|'medium'|'large' }`).
  Returns 503 if the pack's price ID env var is unset.
- **Surfaced:** `credits` added to `/api/billing/status`; settings shows the balance + buy
  buttons; SearchForm enables search on credits when included cap is 0 and shows an overage
  nudge; quota-exhausted toast points to `/settings#credits`.

**Live pack prices (shipped and verified working in prod 2026-08-17 — `lib/creditPacks.ts`):**

| Pack | searches | price | $/search | above worst-case marginal cost? |
|---|---|---|---|---|
| small | 100 | $10 | $0.100 | yes |
| medium | 300 | $25 | $0.083 | yes |
| large | 1000 | $60 | $0.060 | yes |

Worst-case marginal cost (Firecrawl Hobby, all 9 platforms selected) ≈ $0.019/search under the
current Avenue A model, so every pack clears it by 3x or more. **Packs are a Free-plan feature
as of 2026-08-18** — Pro is sold as unlimited searches, so it is never offered credits.

> Superseded: this table previously read "PENDING SIGN-OFF" with 50/$20, 150/$50, 500/$150 and a
> $0.28/search worst case. Those were pre-Avenue-A numbers for packs that shipped at different
> sizes. Verify against `lib/creditPacks.ts` before quoting.

### COGS readout
`scripts/cogs-per-search.mjs` (no deps, $0 to run) prints cost-per-search per tier from the
HANDOFF §9 model and checks every pack price is above worst-case marginal cost. Use it to set
caps and pack prices with real numbers. It mirrors `TIER_CAPS` and `CREDIT_PACKS` as plain
constants (keep in sync on change). Sample output:

| tier | cap | native | Hobby/srch | Std/srch | Hobby/period |
|---|---|---|---|---|---|
| free | 5 | 8 | $0.0190 | $0.0055 | $0.10 |
| pro | 50 | 100 | $0.0190 | $0.0055 | $0.95 |
| max | 120 | 100 | $0.0190 | $0.0055 | $2.28 |

Per-search cost is identical across tiers: native result depth is free (the sidecar is called
with a hardcoded `limit=100` on every tier and `nativeResultsCap` is a post-fetch slice), so
only search *count* scales cost. `max` is retired and unpurchasable; it stays in the readout
because it stays in `TIER_CAPS`.

---

## 3. Alerts — boolean sourcing criteria (Pro feature; “Max” is retired)

AND-only criteria layered on saved searches: the alert's **search terms** AND size AND a
price range. OR-within-a-field is a flagged later extension.

> **Corrected 2026-08-10.** This section previously read "brand AND keywords AND size AND
> price bound" and described brand/keywords criteria *fields*. **Those fields do not exist
> and never shipped.** `AlertCriteria` is `{ size, minPrice, maxPrice }` — verify against
> `lib/alertRunner.ts` before writing copy from this section. Brand and keywords are
> carried by the alert's `query` string, which the platform searches themselves match, not
> by `applyCriteria()`. Marketing copy must not imply four independent criteria fields.

- **Type + logic:** `AlertCriteria` + `applyCriteria()` in `lib/alertRunner.ts`. Applied as a
  **post-filter over the listings returned by `runSearchJob`** — never inside searchWorker
  (Session 4 owns that). Size prefers the structured field, falls back to a **whole-word**
  title match via `matchListingSize` (so "M" does not match inside "atom"); price bounds are
  compared on USD-normalized price (`convertToUSD`), and null-price listings fail when a
  bound is set. Null criteria = legacy behavior (no-op).
- **Storage:** `saved_searches.criteria jsonb` (nullable, backward-compatible).
- **API:** `app/api/saved-searches` POST + `[id]` PATCH accept optional `criteria`
  (`size`, `minPrice`, `maxPrice`).
- **UI (expanded 2026-08-10):** `CreateAlertModal.tsx` has a bordered "Narrow it down" block
  with a size dropdown, a min/max price pair (`minPrice` was accepted by the API from the
  start but had no input until now), a min > max guard, and a live plain-English readout of
  the whole AND-chain; the confirm step shows "Must also match: size L AND $50 to $150".
  `SavedSearchCard.tsx` renders the same criteria as AND-joined chips so they stay visible
  after creation. eBay exclusion + daily/weekly cadence unchanged.
- **First run:** immediate, and now sends a baseline email (`buildBaselineEmailHtml`). It
  writes no `notifications`/`alert_matches` rows, so "new matches" keeps its strict meaning.

Verified: 7/7 logic unit cases pass (incl. the brand+size+price example and currency-normalized
range); modal fields + confirm summary render in-browser.

### SESSION-4 HANDOFF POINT (do not break)
In `runAlert()`, cross-user cache sharing (the COGS track) will sit **between** `runSearchJob`
and `applyCriteria` — see the comment there. Criteria matching is deliberately decoupled from
the live search call so a shared-cache source can be swapped in without touching match logic.

---

## 4. Database (applied 2026-06-28, additive + backward-compatible)
- `profiles.search_credits int NOT NULL DEFAULT 0`
- `saved_searches.criteria jsonb` (nullable)

SQL: `docs/migrations/b2b-foundation.sql` (idempotent). Applied to the live Supabase project.

---

## 5. Copy repositioning
Originally B2C → B2B reseller language in `app/components/landing/Hero.tsx`,
`BentoFeatures.tsx`, `AboutSection.tsx`, and meta in `app/layout.tsx`
(title/description/keywords/OG/Twitter).

**Revised 2026-07-11:** walked back to hybrid B2B+B2C. Removed the reseller-only eyebrow
badge and CTA wording from `Hero.tsx`; broadened `AboutSection.tsx`, `CompareSection.tsx`,
and `faqData.ts` so the copy no longer reads reseller-exclusive ("not for casual shoppers"
removed from the FAQ). `app/layout.tsx` metadata (title/description/OG/Twitter/keywords) now
leads with secondhand & vintage price comparison; reseller terms kept as secondary keywords
only — GSC homepage query data (90-day) showed zero real ranking equity tied to the old
reseller-first title, so this was low-risk.

Tier labels (free/pro/max) unchanged. No dashes-as-punctuation in new copy.

---

## 6. Explicit sign-off gates (proposed, NOT shipped)
- `TIER_CAPS` numbers — unchanged; owner tunes later.
- Credit-pack `searches`/`priceUsd` and live Stripe one-time prices — owner provisions the
  three `STRIPE_PRICE_PACK_*` prices in Stripe and confirms the numbers. Until then, the credits
  route returns 503 and the feature is dormant (no broken checkout).

## 7. Untouched (Session 4 / fragile)
`crawl4ai-service/`, `lib/parse.ts`, `lib/colorFilter.ts`, and the query-expansion /
search-discovery path in `lib/searchWorker.ts` + `lib/searchCache.ts`. The `/api/search`
streaming protocol is unchanged except the additive credit gate.
