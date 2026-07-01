# Landing Page Reseller Revamp — Design Spec

**Date:** 2026-06-30
**Owner:** Kevin (product), Claude (chief designer / implementation)
**Status:** Approved to build

## Goal

Reposition the landing page around resellers. Kill the two "fake search" elements
(read-only hero box + blurred gated `SearchMock`) and replace them with two **real,
no-login, interactive** proofs: a live flip-margin calculator and the real
cross-platform compare slugs. Emphasize the reseller feature trio — **flip margin,
sourcing alerts, tracked listings** — and make the landing↔`/compare/[slug]` flow
feel like one seamless product.

## Brand / design system

- **Keep Crawli's existing tokens** (warm `#E24B4A → #EF9F27` gradient, full CSS-var
  dark/light theme). We are NOT adopting the skill's rose/Fira suggestion.
- Apply structural wisdom only: interactive demo in hero (higher engagement, mobile
  fallback essential, reduced-motion respected), proof-before-CTA, subtle scroll-entrance
  motion.
- Motion: reuse `useInView` for reduced-motion-aware section reveals (opacity + small
  translateY, `transform`/`opacity` only, respects `prefers-reduced-motion`).

## New section order

Hero (w/ live calculator) → **CompareSection** (real slugs, promoted) → PlatformLogos →
BentoFeatures (margin · alerts · **tracked listings** trio) → AlertsMock →
SavesMock (tracked listings, moved up) → AboutSection → FounderNote → CTASection → FAQ → Footer.

**Deleted:** `SearchMock` (blurred fake gate). Its "see it work" job is now done by the
live calculator + real slugs.

## Components

### 1. `FlipCalculator.tsx` (new, client)
- Pure client widget using `netFlipProfit` / `MARKETPLACE_FEES` from `lib/marketplaceFees.ts`
  (already pure TS — safe on client).
- Inputs: Source price ($), Resell price ($), Resell platform (select of `FEE_PLATFORMS`).
- Live outputs: Net profit (accent), Margin %, ROI %, fees line (tabular-nums).
- Sensible defaults (e.g. source $40 / resell $100 / eBay) so it shows value on load.
- Accessible: real `<label>`s, `inputMode="decimal"`, ≥44px targets, focus rings.
- Soft CTA under results: "Source live across 9 platforms →" → `/login?tab=signup`.

### 2. `Hero.tsx` (rewrite)
- Remove read-only search box, chips, `MOCK_SEARCH_EVENT`, `POPULAR_SEARCHES` usage.
- Two-column on desktop: left = badge + headline (keep gradient signature) + sub + 3
  pillars + CTAs (`Start sourcing free`, `See live prices ↓` scrolls to compare);
  right = `<FlipCalculator />`. Stacks on mobile (copy first, calculator below).

### 3. `CompareSection.tsx` (rewrite → data-driven)
- Fetch real items via `getAllCompareItems()` + a new `getCompareTeasers()` in `page.tsx`,
  passed as props (keeps it a server component).
- Cards show category chip + name + real "from $X" teaser (when available) + "See prices →".
- Framing: "Real prices, updated daily — click any item, no login."
- `id="compare"` for the hero's "See live prices" anchor.

### 4. `lib/compare.ts` — add `getCompareTeasers()`
- One best-effort query on `compare_snapshots` → `Map<slug, minPriceUsd>` (min across
  platforms per slug). Returns empty map on error (never breaks the landing page).

### 5. `BentoFeatures.tsx` — elevate tracked listings
- Make the trio co-equal heroes: Flip margin calculator, Precision sourcing alerts,
  **Tracked listings & price drops** (new hero card w/ small preview). Search / price
  intelligence / filters become supporting cards.

### 6. `SavesMock.tsx` — reframe
- Copy shifts from "wishlist" to "track listings, catch price drops" (matches tier-cap
  language). Placement moves up (handled in `page.tsx`).

### 7. `app/page.tsx` — reorder + data fetch
- Fetch compare items + teasers (best-effort). Remove `SearchMock`. New order above.

### 8. `app/compare/[slug]/page.tsx` — cohesive pass
- Remove `EbayCard` (the "Not cached — click to see live" card) entirely.
- Unify card styling with landing tokens; breadcrumb becomes a real "← All comparisons"
  link back to `/#compare`; keep the live-search + alert CTAs.
- (Nav + Footer already provided by `app/compare/layout.tsx` — no change needed there.)

### 9. Cleanup
- Delete `SearchMock.tsx`; delete `mockSearches.ts` if no remaining importers.

## Non-goals
- No new compare-page data-viz (user chose "cohesive restyle," not "full redesign").
- No brand palette change. No new backend/scraping.

## Success criteria
- No fake/read-only search anywhere; calculator + slugs are genuinely usable pre-login.
- `npx tsc --noEmit` clean.
- Light + dark correct; reduced-motion respected.
- Mobile (360/375px) + tablet: no horizontal overflow, no text clipping (verified via
  Playwright at the very end).
- Reseller trio (margin/alerts/tracked listings) visually dominant.
