# Landing page priority redesign — design spec

**Date:** 2026-07-08
**Status:** approved, ready for planning

## Problem

The landing page currently leads with the flip margin calculator: `Hero.tsx`'s headline is
"Know your margin before you buy" and the hero's right column is the live `FlipCalculator`
widget. The owner does not consider the margin calculator the most important feature — of the
four flagship features (cross-platform price comparison, search alerts, tracked listings, margin
calculator), the margin calculator should be last, not first. Cross-platform price comparison
(already real and live via `CompareSection`, just not in the hero) is the strongest proof of
value for a first-time, no-login visitor, so it should headline. Search alerts and tracked
listings are closely related "watch and notify" features and should be pitched together as one
story, immediately after the comparison proof.

## Goals

- Reorder the page so cross-platform price comparison leads, alerts+tracked listings follow as a
  combined pitch, and the margin calculator becomes a supporting, later section.
- Give the hero a new interactive, no-login, zero-marginal-cost widget that shows real
  cross-platform prices for one item at a time (replacing the margin calculator in that slot).
- Combine `AlertsMock.tsx` and `SavesMock.tsx` into one tabbed section.
- Keep the existing design system (colors, dark/light theming, card/typography conventions) —
  this is a structural and hero-content redesign, not a full visual rebrand.

## Non-goals

- No new backend endpoints, no live/on-demand scraping triggered by anonymous visitors, no schema
  changes. `compare_snapshots` is refreshed by the existing daily 6am cron; the hero widget reads
  only that pre-cached data.
- No changes to `/api/`, `lib/marketplaceFees.ts`, alert/tracking logic, or any protected-app
  behavior — this is landing-page-only (`app/page.tsx` + `app/components/landing/*`).
- No pricing, tier, or copy changes outside the landing page.
- FAQ (`faqData.ts`), `AboutSection.tsx`, and `FounderNote.tsx` already frame margin as secondary
  ("comp, then margin") — verified against current copy, no changes needed there.

## New section order

```
LandingNav
Hero                      — NEW content: live compare widget replaces FlipCalculator
PlatformLogos             — moved up (was after CompareSection)
CompareSection            — unchanged content, new position (full item grid)
AlertsAndTrackedSection   — NEW, replaces AlertsMock + SavesMock
MarginSection             — NEW, wraps existing FlipCalculator with demoted framing
BentoFeatures             — trimmed to the 3 supporting cards only
AboutSection
FounderNote
CTASection
FAQ
Footer
```

Rationale for the order: prove depth (hero — one item's real per-platform prices) → prove breadth
(platform logos) → prove more coverage exists (full compare grid) → pitch the "we watch for you"
story (alerts + tracked) → margin calculator as the last-step tool once you've found something →
smaller supporting features → trust/story → convert.

## Hero (`app/components/landing/Hero.tsx`)

- Headline changes from "Stop guessing. Know your margin before you buy." to a comparison-led
  headline (e.g. "Stop guessing. See the real price — across every platform."), keeping the
  existing gradient-text treatment on the second clause.
- Value pillars (`PILLARS` array) reorder: cross-platform comp first, alerts second, margin
  calculator third (currently comp/margin/alerts).
- Secondary CTA changes from "See live prices ↓" (anchors to `#compare`) to anchor at the new
  hero widget itself (e.g. `#hero-compare` or just remove the anchor since the widget is already
  in view).
- Right column: `<FlipCalculator />` is replaced with a new `<CompareHeroWidget />` client
  component (new file, `app/components/landing/CompareHeroWidget.tsx`).

## New: `CompareHeroWidget.tsx`

- Receives pre-fetched data as props from `page.tsx` (server component) — no client-side
  fetching, no new API route.
- Shows one compare item at a time: item name/category badge, then a compact ranked list of
  per-platform average price (low → high), cheapest platform visually highlighted, tabular-nums
  for all prices (matches existing convention in `BentoFeatures.tsx`/`SavesMock.tsx`).
- Auto-rotates through a curated set of 5 items every ~4-5s; small clickable chips (item names)
  let a visitor jump directly. Rotation pauses on hover/focus and respects
  `prefers-reduced-motion` (checked via the same pattern `Reveal.tsx` already uses).
- Curated rotation set (real, verified live in `compare_snapshots` as of 2026-07-08, chosen for
  category diversity and a visible cross-platform price spread):
  - `jordan-1-retro-high` (sneakers) — Poshmark ~$85 vs Vestiaire ~$147
  - `bape-shark-hoodie` (hoodies) — Depop ~$66 vs Vestiaire ~$391
  - `carhartt-wip-jacket` (outerwear) — Depop ~$70 vs StockX ~$312
  - `levis-501-jeans` (denim) — Depop ~$13 vs StockX ~$792 (note: StockX outlier likely a rare/
    collab pair skewing the average — worth a sanity check during implementation; if it reads as
    noise rather than a compelling proof point, swap in `nike-dunk-low` or `new-balance-550`
    instead)
  - `supreme-box-logo-hoodie` (hoodies) — Depop ~$102 vs Vestiaire ~$442
- Footer microcopy: "Prices update daily · No login required."

## `lib/compare.ts`: new `getCompareHeroData()`

- New function, e.g. `getCompareHeroData(slugs: string[]): Promise<CompareHeroItem[]>`, one query
  (`compare_snapshots` where `slug in (...)` and `listing_count is not null`), grouped by slug
  into `{ slug, name, category, platforms: { platform, avgPriceUsd }[] }`, sorted by
  `avgPriceUsd` ascending per item. Avoids N separate `getComparePageData` calls (no waterfall).
  Best-effort: returns `[]` on error, same defensive pattern as `getCompareTeasers()`.
- `app/page.tsx` calls this alongside the existing `getAllCompareItems()` / `getCompareTeasers()`
  calls (all in the existing `Promise.all`), passes the result to `<Hero />` → `CompareHeroWidget`.

## New: `AlertsAndTrackedSection.tsx` (replaces `AlertsMock.tsx` + `SavesMock.tsx`)

- One section, headline pitch: "Save it. We'll watch it." (exact copy TBD at implementation).
- Single `MockFrame` with two sub-tabs — "Alerts" and "Tracked Listings" — clicking a tab swaps
  the mocked content in place (150-300ms crossfade, respects reduced motion). Reuses the existing
  row/card visuals and mock data from `AlertsMock.tsx` (the `ALERTS` array + alert-row markup)
  and `SavesMock.tsx` (the `SAVED` array + folder-tabs + card grid markup) as the two tab panels.
- `AlertsMock.tsx` and `SavesMock.tsx` are deleted once their content is folded in — no dangling
  unused components.

## New: `MarginSection.tsx` (wraps the existing `FlipCalculator`)

- New section, positioned after `AlertsAndTrackedSection`. Reuses `<FlipCalculator />` as-is (it's
  a working, verified tool — not being rebuilt), with new section heading/copy framing it as the
  last step before buying (e.g. "Found it. Now know what it's worth to you.") rather than the
  headline pitch.

## `BentoFeatures.tsx` (trimmed)

- Remove the three "hero" cards (margin calculator, alerts, tracked listings) and their preview
  components (`MarginPreview`, `AlertPreview`, `TrackedPreview`) — these become dead code once
  their content has its own full section elsewhere on the page. Delete rather than keep unused.
- Keep the three supporting cards (9-platform search, price intelligence, smart filters) as a
  compact row. Grid simplifies from the current `sm:grid-cols-6` (mixing 2-col hero cards and
  2-col supporting cards) to a plain `sm:grid-cols-3` for the 3 remaining cards.
- Section heading copy ("Built for resellers who buy to flip") likely still fits but should be
  reviewed once the hero trio is gone — it may read as an odd non-sequitur for only 3 minor
  cards; consider a smaller/quieter heading given reduced section weight.

## `PlatformLogos.tsx` / `CompareSection.tsx`

- No code changes — only reordered in `app/page.tsx` (`PlatformLogos` moves before
  `CompareSection`, both move to directly after `Hero`).

## Visual / motion treatment

- No palette change — keep `[data-theme]` dark/light theming, `--accent` red-orange gradient,
  `rounded-2xl` cards, existing typography.
- Apply tabular-nums to all new price displays (existing convention).
- New motion (hero item rotation, alerts/tracked tab crossfade) stays in the 150-300ms range,
  purposeful (not decorative), and respects `prefers-reduced-motion` via the existing pattern in
  `Reveal.tsx` / `useInView.ts`.

## Testing plan

- `npx tsc --noEmit` clean.
- Real browser check: hero widget rotates and responds to chip clicks; alerts/tracked tab swap
  works; full page scroll in new order renders correctly.
- Light + dark mode, 375px / 768px / 1280px widths, no horizontal overflow.
- `prefers-reduced-motion` respected (hero rotation and tab crossfade both pause/skip animation).
- No console errors; confirm `getCompareHeroData()` failure path (simulate empty result) doesn't
  break the hero layout — widget should have a sane empty/fallback state.

## Docs to update after implementation (per CLAUDE.md)

- `HANDOFF.md`: "Current state" landing-page paragraph rewritten to reflect the new order; one
  bullet under "Recent changes."
- No `PLATFORM_STATUS.md` / `PITFALLS.md` / `SYSTEM_DESIGN.md` changes expected (no scraping,
  data-layer, or n8n changes) unless implementation surfaces a new gotcha.
