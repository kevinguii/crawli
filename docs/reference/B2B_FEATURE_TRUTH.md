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
- Per-platform `lastVerified` date (all `2026-06-28`) + `FEES_LAST_VERIFIED`. Shown in the UI.
- Exports: `MARKETPLACE_FEES`, `sellerFee()`, `sellerPayout()`, `buyerCost()`,
  `netFlipProfit()` → `{ payout, fees, netProfit, marginPct, roiPct }`, `FEE_PLATFORMS`.
- Non-linear schedules handled via optional `computeSellerFee` override (Poshmark threshold,
  Grailed tiered commission).

**Verified rates (US, default seller status, 2026-06-28 via vendor help pages + fee trackers):**

| Platform | Seller commission | Seller processing | Flat | Buyer-side fee |
|---|---|---|---|---|
| eBay | 13.25% (fashion, no Store) | included in FVF | $0.40/order (>$10) | none |
| Poshmark | flat $2.95 under $15, else 20% | none | — | none |
| Mercari | 10% (item + buyer-paid shipping) | none | — | 3.6% buyer protection |
| Grailed | 9% (≥$120) / 6% min $1.99 (<$120) | 3.49% | $0.49 | none (free for buyers) |
| Depop | 0% (US/UK) | 3.3% | $0.45 | up to 5% + up to $1 |
| Vinted | 0% (no seller fees) | none | — | ~5% + $0.70 buyer protection |
| StockX | 9.5% (Level 1) → 8% (Level 4) | 3% | — | none |

Caveats live in each entry's `notes` (store subs, international/non-onboarded Grailed rates,
StockX ship-to-auth ~$5, Depop boosted listings 12%).

**UI:** `app/components/PriceSummary.tsx` gained a collapsible "Suggested flip margin" panel
(mounted where PriceSummary already renders in `ResultsDisplay.tsx`). Inputs: sourcing price,
destination platform (7), editable resale price defaulting to the search's average comp (one-tap
switch to high). Outputs net profit / margin % / ROI %, a fee breakdown line, and the
`lastVerified` date. Recomputed client-side. Light + dark verified.

Verified live: eBay sourcing $40 / resale $100 → fees $13.65, payout $86.35, net $46.35,
margin 46%, ROI 116%. Depop same inputs → fees $3.75, net $56.25, ROI 141%. Both match hand calc.

---

## 2. Tier / cap / overage model

### Tiers and caps — UNCHANGED this session
`TIER_CAPS` in `lib/stripe.ts` remains the single source of truth and a tunable dial. Numbers
were NOT changed and require owner sign-off to change:

| Tier | searches/period (7-day) | alerts | tracked | nativeResultsCap |
|---|---|---|---|---|
| free | 3 | 1 | 50 | 10 |
| pro | 20 | 3 | 200 | 40 |
| max | 70 | 10 | 1000 | 80 |

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

**Proposed pack prices (PENDING SIGN-OFF — owner provisions Stripe prices + confirms numbers):**

| Pack | searches | price | $/search | above worst-case marginal cost? |
|---|---|---|---|---|
| small | 50 | $20 | $0.40 | yes |
| medium | 150 | $50 | $0.333 | yes |
| large | 500 | $150 | $0.30 | yes |

Worst-case marginal cost (Hobby plan, max tier) ≈ $0.28/search. All packs priced above it.

### COGS readout
`scripts/cogs-per-search.mjs` (no deps, $0 to run) prints cost-per-search per tier from the
HANDOFF §9 model and checks every pack price is above worst-case marginal cost. Use it to set
caps and pack prices with real numbers. It mirrors `TIER_CAPS` and `CREDIT_PACKS` as plain
constants (keep in sync on change). Sample output:

| tier | cap | native | Hobby/srch | Std/srch | Hobby/period |
|---|---|---|---|---|---|
| free | 3 | 10 | $0.147 | $0.051 | $0.44 |
| pro | 20 | 40 | $0.204 | $0.108 | $4.08 |
| max | 70 | 80 | $0.280 | $0.184 | $19.60 |

---

## 3. Alerts — boolean sourcing criteria (flagship Max feature)

AND-only criteria layered on saved searches: brand AND keywords AND size AND price bound.
OR-within-a-field is a flagged later extension.

- **Type + logic:** `AlertCriteria` + `applyCriteria()` in `lib/alertRunner.ts`. Applied as a
  **post-filter over the listings returned by `runSearchJob`** — never inside searchWorker
  (Session 4 owns that). Brand/keywords matched case-insensitively against `listing.title`;
  size prefers the structured field, falls back to a **whole-word** title match (so "M" does
  not match inside "atom"); price bounds compared on USD-normalized price (`convertToUSD`),
  null-price listings fail when a bound is set. Null criteria = legacy behavior (no-op).
- **Storage:** `saved_searches.criteria jsonb` (nullable, backward-compatible).
- **API:** `app/api/saved-searches` POST + `[id]` PATCH accept optional `criteria`.
- **UI:** `CreateAlertModal.tsx` adds optional brand / size / max-price / keywords fields and a
  confirm-step summary ("brand: X · size: M · under $150"). eBay exclusion + 24h cadence unchanged.

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
