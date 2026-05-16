# Fashion Resale Price Aggregator — Consolidated Handoff

**Last updated:** 2026-05-16 (evening — platform order reordered)
**Status:** Firecrawl scraping fully replaced by in-house crawl4ai sidecar. **Structured-data extraction covers 6 of 8 platforms** (Grailed, Depop, StockX, Poshmark, Mercari, Vinted). eBay still bot-blocked; Vestiaire still URL-discovery-blocked. StockX prices are real-time and can race (acceptable). **`/api/search` now streams NDJSON** so the UI can show a live per-platform progress bar instead of a frozen "Searching…" button.

**Latest change (2026-05-16 — platform display order reordered):**
- **Platform chip order** in `PLATFORM_DOMAINS` and `PLATFORM_NAMES` (lib/types.ts) changed from: Grailed, Depop, StockX, Poshmark, eBay, Mercari, Vinted, Vestiaire Collective
- **To:** Grailed, Depop, Poshmark, Mercari, Vinted, eBay, Vestiaire Collective, StockX
- **Default selected platforms** on page load changed from [Grailed, Depop, StockX] to [Grailed, Depop, Poshmark, StockX] (SearchForm.tsx:19).
- This affects the order of platform chips in FilterPanel and the order they appear when iterating over PLATFORM_DOMAINS.

**Previous change (2026-05-16 — inline dropdown-pill filters + combined M/W shoe sizes):**
- **Replaced the "Additional configurations" accordion with always-visible inline filter pills.** The collapsed/expanded panel state is gone. New layout in [FilterPanel.tsx](app/components/FilterPanel.tsx), top to bottom:
  1. Platform chips row (back outside any dropdown — brand colors when active, same chip styling as the earlier external row). "Select all" / "Clear all" link prefixes the row.
  2. Thin divider (`border-top: 1px solid var(--border)`).
  3. A wrap-friendly flex row of 4 dropdown pills: `Category`, `Size` (or `Shoe size` when Footwear is active), `Condition`, `Color`.
- **New custom `FilterDropdown` component** (private to FilterPanel.tsx). Each pill shows `{label}: {selectedLabel || 'Any'} ▾`. Click toggles a dropdown panel anchored under the pill. Click-outside (document `mousedown` listener) and `Escape` both close it.
- **Smooth open animation** — same grid `0fr → 1fr` + opacity trick the prior accordion used, 200ms ease-out. `pointer-events: none` when closed so the invisible panel doesn't intercept clicks. Chevron rotates 180° on open.
- **Active state on a pill** (i.e. user picked a non-default option) uses `border: 1px solid var(--accent)` (purple `#534AB7`) and `color: var(--accent-text)` for the label + selected value. New CSS var `--accent-text` added to [globals.css](app/globals.css): `#AFA9EC` in dark mode (the requested purple-tinted text), `#534AB7` in light mode (the full accent — `#AFA9EC` washes out on white). Inactive pills use `var(--surface)` background + `var(--border)` border + `var(--text)` value text + `var(--text-muted)` label text. All values are theme tokens — works in light and dark mode out of the box.
- **Dropdown panel** uses `var(--bg-elevated)` background + `var(--border-strong)` border + shadow-lg + `max-height: 260px; overflow-y: auto` so long lists (Color, shoe sizes) scroll cleanly. Each item is left-aligned with optional leading slot (used for color swatches). Selected item is highlighted with `var(--accent-soft)` background + `var(--accent-text)` text + a trailing check icon.
- **Shoe sizes restructured: combined men's + women's into a single chip per pair**, using Nike's M+1.5 convention. Labels are like `M 8 / W 9.5`, `M 10 / W 11.5`. Half sizes are included from M 6 through M 12 (i.e. M 6, 6.5, 7, 7.5, …, 11.5, 12), plus M 13 and M 14 with no women's counterpart. The `queryTerm` is the bare numeric (`"size 10"`) since most platforms key off the men's number; the W half is for shopper recognition only. `CLOTHING_SIZE_OPTIONS` (XS–XXL) is unchanged and still rendered when category ≠ footwear.
- **Backend routing is unchanged** — the same `filtersToQuerySuffix(filters)` runs in `SearchForm.handleSubmit`, appending color/category/condition/size keywords to the user's query before POSTing to `/api/search`. `FilterPanel` is purely presentational; it owns no state. All four filter fields and the platforms array continue to live in `SearchForm` and flow back via the existing `onFiltersChange` / `onPlatformsChange` callbacks. SearchSection didn't change at all.
- **Removed:** the accordion header (`Additional configurations`), the active-count pill, the wrapping `<div>` with the slide-toggle, the per-section "Any" chip pattern (now each dropdown leads with an "Any" row instead), and the emoji icons from the pill labels.

**Verified by Claude:** `npx tsc --noEmit` clean on project code.

**NOT verified by Claude (needs browser):**
- That the dropdowns animate smoothly in both directions and don't flicker on Safari (the `0fr → 1fr` trick has historically had Safari quirks; if you see jank, swap to `max-height`).
- That click-outside reliably closes the open dropdown when the user clicks another pill (the second pill's `onClick` should both close the first pill via the document listener AND open itself — React event order should make this work, but verify).
- That the active-state purple border + `--accent-text` color are legible on top of `var(--surface)` in both themes, especially against the very-low-contrast dark `--surface` (4% white).
- That the dropdown panel doesn't get clipped on narrow viewports — it's `min-width: 180px` and anchored `left: 0`. On the rightmost pill (Color) with a narrow window, the panel may overflow the right edge. If that's a real problem, add a `right-0` variant when the pill is in the latter half of the row.
- That an actual search with multiple filters set still appends them correctly to the URL the API sees (no regressions in the keyword-stuffing path).

---

**Previous change (2026-05-16 — context-aware size section + platform defaults + no-platform guard + placeholder fix):**
- **Size section is now category-aware.** Two option sets live in [FilterPanel.tsx](app/components/FilterPanel.tsx): `CLOTHING_SIZE_OPTIONS` (XS–XXL) and `SHOE_SIZE_OPTIONS` (Men's 8–12 + Women's 8–12). The Size section renders `SHOE_SIZE_OPTIONS` when `filters.category === 'footwear'`, otherwise `CLOTHING_SIZE_OPTIONS`. Section title swaps between "Shoe size" and "Clothing size" so the user always knows which scale they're picking. The `SIZE_OPTIONS` export is preserved as a combined list — `filtersToQuerySuffix()` still resolves any size key regardless of which set was active when the user picked it.
- **Gender clarification on shoe sizes.** Shoe chips are labeled `Men's 10` / `Women's 10` (not bare numbers). The `queryTerm` carries the gender too (`"men's size 10"`), so each platform's own search index can distinguish them. Numbers alone would collide on platforms that don't return faceted results.
- **Auto-clear on category switch.** Toggling category between footwear and non-footwear clears `filters.size` to avoid a stale shoe-key sitting in state while the clothing chip row is showing (and vice versa). Switching among non-footwear categories (Tops → Outerwear) does NOT clear size since both use `CLOTHING_SIZE_OPTIONS`.
- **Default platform set is now Grailed + Depop + StockX** (`DEFAULT_PLATFORMS` in [SearchForm.tsx](app/components/SearchForm.tsx)) instead of all 8. Rationale: covers streetwear / used clothing / sneakers, all three are confirmed reliable, and the first search no longer waits on the two known-broken platforms (eBay 307s, Vestiaire URL discovery gap). User can expand from the dropdown.
- **No-platform guard with notification.** `handleSubmit` now: returns silently if `isLoading` or empty query; calls `onError('Please select at least one platform before searching.')` and returns when `selected.length === 0`. The error is rendered by `SearchSection` ([app/components/SearchSection.tsx:82-91](app/components/SearchSection.tsx#L82-L91)), so the user sees a visible message instead of a silently-disabled button. Removed `selected.length === 0` from the submit button's `disabled` predicate so the button stays clickable and triggers the error path (otherwise the disabled button would just sit dead with no feedback).
- **Placeholder typo fix.** "Search a product — e.g. ..." → "Search for a product — e.g. ...".

**Verified by Claude:** `npx tsc --noEmit` clean on project code.

**NOT verified by Claude (needs browser):**
- That picking Category: Footwear visibly swaps the chip row to Men's/Women's sizes and re-titles the section.
- That switching from Footwear to Outerwear clears the previously-picked shoe size.
- That clicking Search with zero platforms selected shows the red error banner via `SearchSection`'s error renderer.

---

**Previous change (2026-05-16 — Additional configurations panel: smooth slide, platforms moved in, single-select sections):**
- **Renamed "Filters" → "Additional configurations"** in the dropdown header. Replaces the prior color-only dropdown with a full multi-section panel.
- **Smooth slide-down animation** using the CSS grid `grid-template-rows: 0fr → 1fr` trick (not `max-height`, which is hard to size right without overflow flicker). The collapsing wrapper is a `<div className="grid transition-all duration-300 ease-out">` with `gridTemplateRows` and `opacity` driven by the open state, and its only child is `<div className="overflow-hidden">`. Animates both height *and* opacity over 300ms with ease-out. No JS measurement, no fixed height — works at any content size. Chevron rotation transition bumped to 200ms to match.
- **Platforms moved inside the dropdown**, as the first section (above Color). Stayed multi-select. The "All" chip selects every platform; clicking individual platform chips toggles them. Active platform chips render in that platform's brand color (same `platformStyle()` used elsewhere), so the chip palette doubles as a legend. Removed the previous external "Select all / Clear all" link + chip row from `SearchForm`.
- **Single-select sections (Color, Category, Condition, Size)** each lead with an "Any" chip (instead of the corner-button "Any" the user disliked). Selecting a real option highlights it in accent; clicking it again deselects back to "Any". Color is no longer multi-select.
- **New sections added:** Category (Tops / Bottoms / Outerwear / Footwear / Accessories), Condition (New / Like New / Used), Size (XS–XXL clothing + Size 7–13 shoes; shoe sizes are explicitly prefixed "Size N" in both the chip label and the query term so they don't collide with non-existent clothing-numeric sizes).
- **Query construction** ([FilterPanel.tsx:filtersToQuerySuffix](app/components/FilterPanel.tsx)): exported helper that maps the current `FilterState` to a space-joined keyword suffix. Order is color → category → condition → size. Condition uses a `queryTerm` field (e.g. `"like new"` for the `like-new` key) so display labels and query terms can diverge. Size does the same (chip `"S"` → query `"size S"`, chip `"Size 10"` → query `"size 10"`). `SearchForm.handleSubmit` concatenates `baseQ + ' ' + suffix` and sends that to `/api/search`. **No backend changes** — same keyword-stuffing strategy as before.
- **Active-filter counter pill** next to the panel title now counts platforms-not-all + each non-null filter, so the user sees "Additional configurations [3]" when they have non-default settings stowed.
- **Exported from `FilterPanel.tsx`**: `FilterState`, `emptyFilterState()`, `filtersToQuerySuffix()`, plus the `COLOR_OPTIONS / CATEGORY_OPTIONS / CONDITION_OPTIONS / SIZE_OPTIONS` arrays — so future work (e.g. faceted-URL builders per platform) can reuse the same vocabulary without re-defining it.

**Verified by Claude:** `npx tsc --noEmit` clean on project code (one unrelated warning in `.next/dev/types/validator.ts`, a Next-generated file).

**NOT verified by Claude (needs browser):**
- That the slide-down feels smooth in both directions on a real browser. (The `0fr → 1fr` grid trick is well-supported but has had Safari quirks in older versions; if you see a jump, swap to `max-height: 0 → 1000px` as a fallback.)
- That none of the chips wrap awkwardly at narrow widths — there are now ~30 chips in the panel.
- That a search like `nike air max 90` + Color: Red + Category: Footwear + Size: Size 10 returns sensibly filtered listings on all six working platforms.

**Removed:** the prior color-only `FilterPanel` is replaced (color is now a single-select section inside the new panel). The external platform chip row in `SearchForm` is removed (platforms live in the dropdown now).

---

**Previous change (2026-05-16 — color filter dropdown):**
- **New `FilterPanel` component** ([app/components/FilterPanel.tsx](app/components/FilterPanel.tsx)) renders as a collapsible card under the platform chips in `SearchForm`. Closed state is a single row: "Filters" label + a small pill counter showing how many filters are active + a chevron. Open state reveals a `Color` section with multi-select chips. Each chip is a small swatch (rounded color dot) + the color name. White/silver swatches use an `inset box-shadow` ring so they stay visible on light backgrounds. An "Any" button on the right clears all color selections.
- **Color palette** ([FilterPanel.tsx:9-24](app/components/FilterPanel.tsx#L9-L24)): black, white, gray, red, orange, yellow, green, blue, purple, pink, brown, beige, gold, silver. Stored as `COLOR_OPTIONS: ColorOption[]` and exported in case other components want the same list later.
- **Wiring** ([SearchForm.tsx](app/components/SearchForm.tsx)): added `colors: string[]` state. On submit, if any colors are selected, the final query sent to `/api/search` is `${baseQ} ${colors.join(' ')}` — e.g. `"nike air max 90" + ["red","white"]` → `"nike air max 90 red white"`. **Backend is untouched** — this works because Firecrawl's `site:<domain> <query>` already does keyword matching on the platform's own search index, and the LLM/structured extractors don't care what the user typed.
- **Why append-to-query instead of a structured `filters` field**: the working platforms don't expose color facets in their search URLs uniformly (Grailed has them, Depop has them in different shapes, Mercari doesn't, etc.). Keyword stuffing is the lowest-friction path that improves results across all six working platforms. When/if we move to per-platform facet builders, the UI state shape (`colors: string[]`) is already correct — only the query-builder layer needs to change.
- The structured-filters TODO from the prior change block now has color partially shipped. Remaining sub-TODOs in that area: garment type (upper / lower / outerwear / footwear / accessories), size, gender, condition.

**Verified by Claude:** `npx tsc --noEmit` passes clean. The dropdown opens/closes via local state and the chip multi-select uses the same `<input type="checkbox" className="sr-only">` pattern as the platform chips for accessibility.

**NOT verified by Claude (needs browser):**
- That the swatches render at a readable size on both light and dark themes (white/silver in particular — those rely on `box-shadow: inset 0 0 0 1px var(--border)` which should be visible against `var(--bg-elevated)`).
- That an actual color-filtered search returns visibly better-matched results (this depends on each platform's own search index, not on our code).
- That the accent counter pill is positioned correctly when one or more colors are active.

---

**Previous change (2026-05-16 — UI polish: clickability, badge fit, lowest-price emphasis, sort):**
- **ListingCard now signals "clickable" more clearly.** Added `cursor-pointer`, a subtle `hover:opacity-90`, and a gentle `hover:scale-[1.02]` on top of the existing accent-border hover. All three live on the `<a>` element via Tailwind classes — no new state.
- **Platform badge no longer stretches edge-to-edge.** Root cause: `ListingCard`'s inner card body is `flex flex-col`, which defaults `align-items: stretch`, so the `inline-block` `PlatformBadge` was being stretched to the column's full cross-axis width. The beige (Vestiaire) / grey (Grailed) / etc. background then visibly spanned the entire card. Fix: pass `className="self-start"` to `PlatformBadge` so just that one child opts out of stretch — title/price still take full width via the existing flow. Affects ALL platforms, not just Vestiaire/Grailed (any badge would have had this problem; the lighter-colored ones just made it most obvious).
  - `PlatformBadge.tsx` already accepted a `className` prop and forwards it; no badge component changes needed.
- **SearchProgress (the "pending search" status panel) tightened.** The status-dot + badge cluster was sitting inside a `flex w-32 shrink-0 items-center gap-2` div — the fixed `w-32` (128px) reserved a wide column even when the badge label was short. Removed `w-32`. Cluster now auto-sizes to content; the adjacent progress bar reclaims the freed space.
- **"Lowest price" badge is now solid + readable on busy images.** Was `background: var(--success-soft)` (~14% alpha green) with green text — almost invisible against light/colorful clothing photos. Now `background: var(--success)` (solid `#16a34a` light / `#4ade80` dark) with `color: #FFFFFF` and uppercase-tracking type, matching the visual language of the platform badges.
- **Listings now sort lowest USD price first.** `ResultsDisplay.visibleListings` is now a `useMemo`-sorted copy: USD listings with a numeric price ascend by price; non-USD or price-null listings sink to the bottom in their original order. Sort applies on every tab (All + per-platform). The `cheapestId` lookup for the "Lowest price" badge is unchanged — it still finds the global USD min — so the first card in the grid is the badged one.

**Verified by Claude:** `npx tsc --noEmit` passes clean.

**NOT verified by Claude (needs browser):**
- Hover effect actually feels right (the `scale-[1.02]` is gentle but if it feels jumpy with the border-color transition, drop the scale and keep only `opacity-90`).
- Vestiaire / Grailed / all other badge backgrounds now hug the label text.
- "Lowest price" badge contrasts well on real listing photos in both light and dark modes.
- Lowest-price card actually appears in the top-left of the grid after a real search.

**TODOs the user added for future sessions (not implemented this round):**
1. **Scrape and surface the listing's posted date.** Then expose a "Sort by date (oldest → newest / newest → oldest)" filter alongside the current price sort. Will require: (a) adding a `postedAt: string | null` field to `ScrapedListing` in `extractors.py` and `lib/types.ts`, (b) per-platform date extraction in `structured_extractors.py` (JSON-LD `datePosted` / `__NEXT_DATA__` timestamps / etc.), (c) UI sort toggle in `ResultsDisplay.tsx`. Each platform will need its own date source — none is universal.
2. **Structured filter chips instead of free-text query refinement.** Today users have to encode everything in the search string ("nike air max 90 red"). Add UI chips for common filters: color, garment type (upper / lower / outerwear / footwear / accessories), size, gender, etc. Will probably need: (a) a `filters` object passed alongside `query` to `/api/search`, (b) per-platform query-builder logic (some platforms have facet URLs, others need keyword smashing), (c) frontend chip components.

---

**Previous change (2026-05-16):** Removed test mode (env var) and changed Firecrawl search limit from 15 to 20 results per platform (was 2 credits/search for 10 results or 4 credits for 15; now 4 credits for 20 to get more coverage).

**Previous change (2026-05-15 evening — platform badge pass):** **Brand-color pill badges for every platform + eBay 4-stripe gradient.**
- `app/components/platformColors.ts` — replaced all placeholder colors with exact brand values: Grailed `#3A3A3A`, Depop `#FF2300`, StockX `#00B341`, Poshmark `#9B4C5C`, eBay `#0064D2` (bar/dot only), Mercari `#5E6DF2`, Vinted `#007782`, Vestiaire Collective `#C4A17A`. Added `PLATFORM_TEXT` map (Vestiaire Collective → black `#000000`; all others → white `#FFFFFF`). Added `platformStyle()` helper that returns `{ background, color, isGradient }`. eBay's `background` is `linear-gradient(to bottom, #E53238 0% 25%, #0064D2 25% 50%, #F5AF02 50% 75%, #86B817 75% 100%)`. The shimmer-bar `platformColor()` for eBay returns `#0064D2` (single solid color — the gradient is too busy at 6px bar height).
- `app/components/PlatformBadge.tsx` (new) — a single reusable `<PlatformBadge platform={p} />` component that renders a rounded-full pill using `platformStyle()`. eBay automatically gets the 4-stripe gradient via its CSS `background`. Vestiaire Collective renders black text on the beige background; all others render white.
- `app/components/ListingCard.tsx` — replaced the old colored-text `<p>` with `<PlatformBadge>`. Removed the `platformColor` import.
- `app/components/SearchProgress.tsx` — replaced the platform name `<span>` with `<PlatformBadge>`. The `platformColor` import is kept because the status dot and shimmer bar still use a single solid accent color per platform.

**Verified:** `tsc --noEmit` clean; `npm run dev:all` boots both services; `GET /` 200 with no errors. Visual verification (are the eBay stripes visible and readable? does Vestiaire Collective's black text contrast correctly?) requires your browser.

**Previous change (2026-05-15 evening — UI polish pass):** **Per-platform color coding + scrollbar fix + sequential-vs-parallel clarification.**
- **Platform color palette.** New file `app/components/platformColors.ts` exports a `PLATFORM_COLORS` map (grailed=red `#ef4444`, depop=pink `#ec4899`, stockx=green `#22c55e`, poshmark=rose `#e11d48`, ebay=yellow `#eab308`, mercari=orange `#f97316`, vinted=teal `#14b8a6`, vestiaire collective=purple `#a855f7`) and a `platformColor(p)` helper. Kept under `app/components/` so `lib/` stays presentation-free.
- **SearchProgress now colors rows by platform.** Each row sets `--row-color` inline. The CSS utilities `.bar-fill-loading` and `.bar-fill-done` in `globals.css` were changed to read `var(--row-color, var(--accent))`, so the shimmer + final-state bar both render in the platform's color. The status dot uses the same color (loading = pulsing colored dot; done = filled colored circle with white check). The platform label is the platform color while loading, then reverts to `--text` when done. Failed state stays red regardless. The global `--accent` (`#534AB7`) is unchanged and continues to drive the search button and the active tab underline — platform colors are row-scoped only.
- **ListingCard platform label** now uses `platformColor(listing.platform)` instead of `--text-dim`. Easier to scan the grid by source.
- **Scrollbar.** Added a `.hide-scrollbar` utility class in `globals.css` (sets `scrollbar-width: none` + `::-webkit-scrollbar { display: none }`). Applied to the horizontal tab strip in `ResultsDisplay.tsx`. Tabs still scroll horizontally if they overflow, but the system scrollbar no longer renders.
- **Architecture note (no code change):** User asked whether the multi-platform search runs sequentially. It does **not** — `app/api/search/route.ts:91` uses `Promise.all(platforms.map(async ...))`, so all selected platforms run their full pipeline (Firecrawl search → URL filter → sidecar scrape → parse) **in parallel**. The visual effect of "all three rows sitting at 'Parsing prices…' together" is correct: the frontend stage timer advances each row through the four labels at the same 2s cadence, so all rows hit the final label well before any `platform_done` event arrives, and each one snaps to "Done — N results" in real completion order. If sequential behavior is ever wanted (cost throttling, polite scraping), it would mean replacing `Promise.all` with a sequential `for await` loop and is a backend change, not a UI fix.

**Verified by Claude:** `tsc --noEmit` clean; `npm run dev:all` boots both services; `GET /` returns 200 with no Turbopack errors. The new platform-color CSS variables don't show up in the initial HTML because they're only set on dynamically-rendered SearchProgress rows.

**NOT verified (needs your browser):** that the per-platform shimmer colors look distinguishable + readable on both themes, that the scrollbar is actually gone on your OS (this matters mostly on macOS with "always show scrollbars" enabled — the CSS covers both WebKit and Firefox).

**Previous change (2026-05-15 evening — UI refresh):** **Modern dark/light dashboard UI.** Refactored the entire frontend (no backend / API / sidecar / lib changes) into a theme-driven dashboard:
- `app/globals.css` now defines all colors as CSS custom properties under `[data-theme="dark"]` (default) and `[data-theme="light"]` on `<html>`. Accent is `#534AB7`. The Tailwind `dark:` variant is **not** used — switching is instant via the `data-theme` attribute. CSS `@keyframes` (`queued-pulse`, `loading-shimmer`, `dot-pulse`) plus utility classes (`.bar-track`, `.bar-fill-loading`, `.bar-fill-done`, `.bar-fill-failed`, `.dot-loading`) live here so all motion is CSS-only.
- `app/layout.tsx` injects a tiny inline `<script>` in `<head>` that reads `localStorage.getItem('theme')` and sets `data-theme` before paint to avoid flash. Defaults to dark.
- `app/components/ThemeToggle.tsx` (new) — sun/moon button in the top nav; toggles `data-theme` on `<html>` and writes to `localStorage`. Persists across reloads.
- `app/page.tsx` rewritten with a sticky top nav (logo + theme toggle) and a new hero ("Find the best resale price.").
- `app/components/SearchForm.tsx` — platform checkboxes are now pill/chip toggles with the accent color border + soft fill when active and a tiny accent checkmark; input is full-width; submit button uses `--accent` (`#534AB7`).
- `app/components/SearchProgress.tsx` — fully rewritten. **One row per platform**, each with: status dot, platform name, animated bar, current stage label, and a chevron that toggles a collapsible monospace "reasoning" dropdown showing the stages reached so far. Stage labels (`Submitting search… → Filtering URLs… → Scraping listings… → Parsing prices…`) advance via **one `setInterval` per row** (2s cadence). The interval is cleared on completion and on unmount. Real `platform_done` event snaps the row to `Done — N results` or `Failed — <error>`. Bar animation is pure CSS — a 1.4s linear shimmer for loading, solid accent for done, solid red for failed. No per-listing counts.
- `app/components/SearchSection.tsx` — now also tracks `counts` per platform from `platform_done` events so SearchProgress can show the final count without going back through the results object.
- `app/components/ResultsDisplay.tsx` — platform tabs at the top use an accent-colored bottom-border underline for the active tab (no pill background). Tab switching is purely client-side. Computes `cheapestId` across all USD listings and passes `isLowest` to ListingCard.
- `app/components/PriceSummary.tsx` — now three metric cards (Low / Average / High) in a 3-col grid above the results. The Low card uses the accent border. Each card shows the source platform name (or count for Average) in muted text. Exports `pickPriceSources()` helper.
- `app/components/ListingCard.tsx` — image-first card with a 1:1 aspect-ratio top. Platform name as small uppercase muted text, 2-line clamp title, large bold price, condition as a single muted line. The cheapest USD listing gets a small green "Lowest price" badge in the image's top-left. The whole card is now a link (clicking anywhere opens the listing); on hover, only the border color changes to the accent — no transforms, no shadows. Removed the prior "View listing →" button, condition color badge, and the colored platform badge.

**Verified by Claude:**
- `npx tsc --noEmit` passes clean.
- `npm run dev:all` boots both Next.js (`:3000`) and the sidecar (`:8000`) without errors.
- `GET /` returns 200 and rendered HTML contains `data-theme="dark"` on `<html>`, the `--accent` CSS variable on inline styles, and the new copy.

**NOT verified by Claude (visual / behavioral — needs a real browser):**
- That the shimmer animation visibly moves left-to-right and feels smooth.
- That the theme toggle swaps colors instantly with no flash, and that the preference actually persists across a hard reload.
- That the platform tabs filter correctly on click and the accent underline animates between tabs.
- That the reasoning chevron opens/closes the dropdown.
- That `setInterval` actually stops advancing after a platform completes (test by leaving one row open and watching it freeze at "Done — N results").
- That a full live 3-platform search renders end-to-end correctly. Backend stream wiring is unchanged from the prior session and was verified live then; only the consuming UI changed.

**Out of scope (not touched):** `app/api/`, `lib/`, `crawl4ai-service/`, env vars, package.json.

**For a future Claude session:** the progress bar's "stage labels" are deliberately fake-but-plausible — they're driven by a frontend timer, not by real backend events. The four stages roughly match what the pipeline actually does (Firecrawl search → URL filter → sidecar scrape → parse), but the timings are 2s heuristic, not measurements. If you want real-time stages, the sidecar protocol and `/api/search` NDJSON stream would both need new event types. The user explicitly preferred the lightweight fake-stage approach to avoid load on the Playwright/crawl4ai processes.

**Previous change (2026-05-16 early morning):** **Live progress bar for multi-source searches.** Converted `POST /api/search` from one-shot JSON to a streaming NDJSON response (`Content-Type: application/x-ndjson`, chunked transfer). Each request emits one `start` event, one `platform_done` event per platform in real completion order, and a final `final` event with cross-platform price stats. Frontend reads the stream via `ReadableStream`/`TextDecoder` and renders a new `<SearchProgress />` component with one checkpoint per selected platform — pending → loading (pulsing) → done (filled checkmark) / failed (red X with tooltip showing the error). Verified live: curl shows lines arriving incrementally with correct timestamps; headers include `x-accel-buffering: no` and `cache-control: no-cache, no-transform` to prevent buffering. **Note:** in tests against eBay/Vestiaire Collective, the upstream `searchAndScrape` does *not* throw on bot-blocks — it returns empty arrays, so those platforms surface as `status: 'ok'` with `count: 0`, not `failed`. The `failed` checkpoint state only fires when `searchAndScrape` actually throws (e.g. sidecar unreachable, Firecrawl outage). See §6.6 below and `app/components/SearchProgress.tsx`, `app/components/SearchForm.tsx`, `app/components/SearchSection.tsx`, `app/api/search/route.ts`, `lib/types.ts` (added `SearchStreamEvent` union).

**Previous change (2026-05-15 late evening):** **Disabled `remove_overlay_elements`** in `CrawlerRunConfig` (was True, now False). It was running JS in the page that on Poshmark either triggered a navigation or mutated the DOM, stripping `<meta property="og:type">` and corrupting other signals (verified: same URL returns 762KB without og:type with overlay-ON, vs 534KB with og:type with overlay-OFF). This also eliminates the "Failed to remove overlay elements: Execution context was destroyed" warnings and the cascading "Page.content: page is navigating" errors the user asked about — those weren't anti-bot, they were our own JS shooting the page in the foot. See §6.5c and §11 (gotcha 23). Also added multi-signal sold detection on Poshmark (the `--sold` banner class is defined in every page's `<style>` so a substring check false-fires; use BeautifulSoup to query the actual rendered element).

**Previous change (2026-05-15 evening):** Added structured extractors for **Mercari** (`__NEXT_DATA__.serverState.ItemDetail:<id>`, price in cents), **Vinted** (escaped RSC payload regex for `"price":{"amount","currency_code"}`), and **Poshmark** (`og:title` + `og:image` + first `<p class="h1"><span>$N</span></p>` + `data-et-prop-inventory_status`). This fixes a class of wrong-price/wrong-image bugs that the LLM was producing on those three platforms. See §6.5 (third iteration) and §11 (gotchas 18–22).

**Previous change (2026-05-15 PM):** Scraping pipeline gained a **structured-data tier** that reads Schema.org JSON-LD (Depop/Grailed) and specific `data-testid` attributes (StockX) directly from the rendered HTML. LLM is now a fallback, not the primary signal. See §6.5 and §11 (gotchas 11–17).

This document supersedes the older `HANDOFF.md` and `HANDOFF_FULL.md`. It folds in all prior context plus the work done in May 2026 to migrate scraping off Firecrawl.

---

## 1. Project Overview

A personal-use web app that searches multiple fashion resale platforms simultaneously and aggregates live listings (price, image, condition, sold status, currency) across them. Single query → results from up to 8 platforms in one view, with min/max/avg price stats.

**Target platforms:** Grailed, Depop, StockX, Poshmark, Mercari, Vinted, eBay, Vestiaire Collective.

**Business value:** Price transparency across a fragmented resale market without manually checking each site.

---

## 2. Tech Stack

**Frontend / API**
- Next.js 16.2.6 (App Router) + React 19.2.4
- TypeScript 5.x, Tailwind v4
- Client-side state via React hooks; no auth yet
- Zod for API request validation; nanoid for listing IDs

**Backend services**
- Next.js API routes (`/api/search`) orchestrate the pipeline
- **Python sidecar** (`crawl4ai-service/`) — FastAPI + crawl4ai 0.8.6 + Playwright 1.59.0 + litellm
- Firecrawl (`@mendable/firecrawl-js` v4.23.0) — used **only for search**, not for scraping
- Supabase — configured (env vars present), unused in Phase 1

**LLM**
- OpenAI `gpt-4o-mini` is the default extraction model (via litellm, configured in `.env`)
- Gemini `gemini-2.0-flash` is the backup; rate-limits hard so used only on opt-in
- Do **not** default to Anthropic/Groq/Mistral/local — no card on file for those

---

## 3. Architecture (current — as of 2026-05-15)

```
User → SearchForm
       │
       ▼
POST /api/search ─────────────────────────────────────────────┐
       │                                                       │
       │  for each platform (parallel):                        │
       │    1. Firecrawl search:  site:<domain> <query>        │  Firecrawl
       │       → returns 15 candidate URLs                     │  (2 credits/
       │    2. filterListingUrls() — regex per platform        │   platform)
       │    3. dedupe                                          │
       │                                                       │
       │  for each URL (concurrency 2 per platform):           │
       │    4. scrapeListing(url, platform)                    │
       │       ↓                                               │
       │       scrapeViaSidecar() in lib/scraper.ts            │
       │       ↓                                               │
       │       POST http://localhost:8000/scrape ──────────────┼─→ Python sidecar
       │                                                       │   (crawl4ai +
       │  5. parseScrapedListings() — drop sold, map fields    │    OpenAI)
       │  6. aggregate prices, return SearchResponse           │
       ▼                                                       │
   UI: tabbed results + min/max/avg price summary              │
                                                               ▼
```

**Key change vs. the original Firecrawl-only design:** the **scrape** step used to cost 9–10 Firecrawl credits per page. It now goes through a local Playwright + LLM pipeline, costing ~$0.0005–$0.002 per page in OpenAI tokens. Firecrawl is retained only for the **search** step (2 credits per platform per query), where it's still the cheapest option.

---

## 4. File Structure

```
fashion-crawler-crawl4ai/
├── .env                              ← LLM_PROVIDER, OPENAI_API_KEY, FIRECRAWL_API_KEY, Supabase
├── HANDOFF.md                        ← this file
├── package.json                      ← scripts: dev, dev:sidecar, dev:all, build
│
├── app/
│   ├── api/search/route.ts           ← orchestrator (POST /api/search)
│   ├── components/
│   │   ├── SearchForm.tsx            ← query + platform checkboxes
│   │   ├── SearchSection.tsx         ← client state container
│   │   ├── ResultsDisplay.tsx        ← tabbed results grid (All + per-platform)
│   │   ├── ListingCard.tsx           ← single listing card (image, price, badge)
│   │   └── PriceSummary.tsx          ← min/max/avg stats bar
│   ├── layout.tsx                    ← root layout (suppressHydrationWarning for Grammarly)
│   ├── page.tsx                      ← homepage
│   └── globals.css                   ← Tailwind v4 + CSS vars
│
├── lib/
│   ├── types.ts                      ← PLATFORM_DOMAINS, PLATFORM_NAMES, Listing, SearchResponse
│   ├── firecrawl.ts                  ← searchPlatform() (Firecrawl); scrapeListing() delegates to sidecar
│   ├── scraper.ts                    ← HTTP client for the Python sidecar
│   └── parse.ts                      ← filterListingUrls(), parseScrapedListings()
│
├── crawl4ai-service/                 ← Python sidecar (replaces Firecrawl scrape)
│   ├── main.py                       ← FastAPI app, /scrape + /health endpoints; structured-first → LLM fallback
│   ├── extractors.py                 ← LISTING_SCHEMA + PLATFORM_PROMPTS + per-platform options (LLM fallback tier)
│   ├── structured_extractors.py     ← NEW (2026-05-15 PM): JSON-LD + testid extractors (primary tier)
│   ├── debug_probe.py                ← NEW: dumps OG/JSON-LD/__NEXT_DATA__/visible-$ from a URL; for future debugging
│   ├── debug_dumps/                  ← saved raw HTML from probe runs (gitignored)
│   ├── requirements.txt
│   ├── venv/                         ← already provisioned; crawl4ai, playwright, fastapi, beautifulsoup4 installed
│   └── README.md
│
└── scripts/
    ├── test-all-platforms.mjs        ← NEW: smoke-tests sidecar across all 8 platforms (~16 Firecrawl credits, search only)
    ├── diagnose-counts.mjs           ← URL-filter pass rates (3 search credits)
    ├── diagnose-scrape.mjs           ← 3 URLs per platform (sequential, used to test Firecrawl — still works as a baseline)
    ├── diagnose-parallel.mjs         ← reproduces old timeout issue at full parallel load
    ├── diagnose-grailed.mjs          ← measures Grailed sold rate
    └── test-scrape*.mjs              ← legacy Firecrawl scrape tests
```

---

## 5. The Sidecar (`crawl4ai-service/`)

This is where the Firecrawl-replacement lives. Treat it as a separate process that the Next.js API talks to over HTTP on `localhost:8000`.

### Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Returns `{status, llm_mode: "active"\|"stub", provider}`. Use to verify the API key is loaded. |
| `POST` | `/scrape` | Body: `{url, platform}`. Returns `{result: ScrapedListing \| null}`. Mirrors the original Firecrawl-shaped output exactly. |

### How it works
1. `main.py` boots a long-lived `AsyncWebCrawler` (Playwright Chromium) with `enable_stealth=True` and `user_agent_mode="random"`.
2. On each `/scrape` request, it renders the page (`wait_until="domcontentloaded"`, `delay_before_return_html=5s`; Poshmark gets 6s; retries get 7s).
3. **Tier 1 — structured extraction** (`structured_extractors.py`): for Grailed/Depop/StockX/Poshmark/Mercari/Vinted, read deterministic signals directly from the raw HTML:
   - **Depop/Grailed**: Schema.org `<script type="application/ld+json">` with `@type: "Product"`. Read `offers.price`, `offers.priceCurrency`, `offers.availability`, `offers.itemCondition`, `name`, `image`.
   - **StockX**: `<h2 data-testid="trade-box-buy-amount">` for Lowest Ask. If missing but title present → listing has no Ask → return `price=None`. If both missing → fall back to LLM.
   - **Poshmark**: `og:type=product` gate, `og:title`/`og:image`, first `<p class="h1"><span>$N</span></p>` for price, `data-et-prop-inventory_status` for sold. **No JSON-LD** — Poshmark doesn't emit it.
   - **Mercari**: `__NEXT_DATA__.props.pageProps.serverState['ItemDetail:<id>']` → `price` (CENTS!), `name`, `photos[0].imageUrl`, `status`. **Do NOT use `og:image`** — it's a generic placeholder.
   - **Vinted**: regex over escaped Next.js RSC payload for `\"price\":{\"amount\":\"<n>\",\"currency_code\":\"<c>\"}` (underscored — listing pricing). `og:image` for photo. Strip `" | Vinted"` from `og:title`.
   - No LLM call, deterministic, costs nothing.
4. **Tier 2 — LLM fallback**: if tier 1 returns None, run the original `LLMExtractionStrategy` flow:
   - converts rendered markdown via `target_elements` scope (limits LLM to the main product container — drops "Similar Items", "Last Sale", footer, etc.)
   - sends scoped markdown + schema + platform prompt to OpenAI via litellm
   - parses the LLM's JSON response back into the `ScrapedListing` shape
5. If `LLM_PROVIDER` is empty or its API key is missing, the sidecar runs in **stub mode** — it still fetches pages and runs tier 1, falling through to title-only output when tier 1 misses. `/health` will report `llm_mode: "stub"`.

### Schema & prompts (in `extractors.py`)
- `LISTING_SCHEMA` — the canonical JSON shape (title, price, currency, isSold, condition, imageUrl). **Do not change without updating `lib/parse.ts` and the UI in lockstep.**
- `PLATFORM_PROMPTS` — per-platform extraction instructions for the LLM fallback (StockX: "Lowest Ask, not Last Sale/Highest Bid"; Grailed: detect sold badge; Depop: capture discounted not strikethrough price; Poshmark: ignore related listings).
- `PLATFORM_CRAWLER_OPTIONS` — per-platform crawler tweaks:
  - `word_count_threshold: 0` for Depop/eBay (keeps short price chips that the default filter strips).
  - `target_elements: [...]` for Grailed/Depop/StockX/Poshmark — scopes the LLM-fallback view to the main product container. **Gated to the LLM tier only** (`scope_to_target=True` in `main.py`); tier 1 reads raw HTML so `<head>` meta + `<script>` JSON-LD survive.
- `PLATFORM_EXTRACTION_OPTIONS` — per-platform LLM-strategy tweaks. eBay sets `apply_chunking: True` because its listing pages render to ~50K chars of markdown.

### Structured extractors (in `structured_extractors.py`)
Each per-platform function returns the canonical `ScrapedListing`-shaped dict or `None` (fall through to LLM).

| Platform | Mechanism | Notes |
|---|---|---|
| `extract_depop` | Schema.org JSON-LD Product → `offers.price` | Page must render for ~5s before the JSON-LD paints. |
| `extract_grailed` | Schema.org JSON-LD Product → `offers.price` | Same. |
| `extract_stockx` | CSS: `[data-testid="trade-box-buy-amount"]` | If absent but title present → price=`None` (genuinely no Ask). If both absent → return None → LLM fallback. |
| `extract_poshmark` | `og:title` + `og:image` + `<p class="h1"><span>$N</span></p>` | Gated by `og:type=product`. Sold via `data-et-prop-inventory_status`. **Does NOT use JSON-LD** — Poshmark doesn't emit it. |
| `extract_mercari` | `__NEXT_DATA__.props.pageProps.serverState['ItemDetail:<id>']` | Price in **cents** — divide by 100. Image from `photos[0].imageUrl` (never `og:image` — it's a placeholder). |
| `extract_vinted` | Regex over escaped RSC payload for `\"price\":{\"amount\":\"<n>\",\"currency_code\":\"<c>\"}` (underscored), `og:image` for photo | First match wins. Strips `" \| Vinted"` from `og:title`. |

Shared helpers:
- Schema.org availability tokens (`outofstock`, `soldout`, `discontinued`) → `isSold: true`.
- Schema.org `itemCondition` (`NewCondition`, `UsedCondition`, `RefurbishedCondition`, `DamagedCondition`) → `"New"`/`"Used"`/`"Refurbished"`/`"Damaged"`.

### Critical config gotchas (don't undo these)
- `BrowserConfig(headless=True, verbose=False, enable_stealth=True, user_agent_mode="random")` in `main.py`. Stealth is required for StockX and was attempted for eBay (still insufficient — see below).
- **Do not enable** `light_mode`, `text_mode`, or `memory_saving_mode` on `BrowserConfig`. They break extraction on React/Vue SPA sites (Grailed, Depop, StockX) by disrupting JS rendering. Comment in `main.py` documents this.
- `apply_chunking=False` is the default; only eBay overrides it to True.

---

## 6. Status by Platform (verified 2026-05-15)

Test was a single live run via `scripts/test-all-platforms.mjs` with query "Nike Air Jordan 1" against the live sidecar (`llm_mode: active`, provider `openai/gpt-4o-mini`).

| Platform | Scrape works? | Notes |
|---|:-:|---|
| **Grailed** | ✅ | JSON-LD Product → reliable. LLM fallback if JSON-LD missing. |
| **Depop** | ✅ | JSON-LD Product → reliable. **Fixed 2026-05-15 PM**: was returning related-item prices ($39.55 instead of $45). Root cause was 1.5s render delay + LLM seeing "More from seller" rail. |
| **StockX** | ⚠️ partial | `[data-testid="trade-box-buy-amount"]` → reliable when present. **Known caveat (deferred)**: StockX prices change in real time — a $74 ask scraped now can be $87 by the time the user clicks. Sometimes the testid contains a stale or cached value that doesn't match the live page (observed on `…fleece-hoodie-black`, `…fleece-hoodie-jet-black`, `…modern-fleece-hoodie-jet-black`). Listings with no Lowest Ask correctly return `price=null`. See §7 (E) for the full deferred-issues list. |
| **Poshmark** | ✅ | `og:title` + `og:image` + first `<p class="h1"><span>$N</span></p>` price + `data-et-prop-inventory_status` for sold. **Fixed 2026-05-15 evening**: the prior JSON-LD extractor was always missing (Poshmark doesn't emit Schema.org JSON-LD), forcing LLM fallback. Navigation-retry (2026-05-15 AM) is still needed for anti-bot redirects. |
| **Mercari** | ✅ | `__NEXT_DATA__.props.pageProps.serverState['ItemDetail:<id>']` → `price` (cents → /100), `name`, `photos[0].imageUrl`, `status`. **Fixed 2026-05-15 evening**: was returning related-item prices ($75 vs $110, $47 vs $115) AND `og:image` placeholder (the green-checkmark / generic Mercari OGP image). |
| **Vinted** | ✅ | Regex match in escaped Next.js RSC payload for `\"price\":{\"amount\":\"<num>\",\"currency_code\":\"<code>\"}` (note **underscored** `currency_code` — listing pricing; `currencyCode` is shipping). `og:image` for the real product photo. **Fixed 2026-05-15 evening**: previously returning CZK shipping-option prices instead of USD item prices, and a checkmark-icon image URL instead of the photo. |
| **eBay** | ❌ deferred | Edge proxy returns 307 → `/splashui/challenge` even with stealth + random UA. See §7 (A). |
| **Vestiaire Collective** | ❌ deferred | Scrape side works; URL discovery is the blocker. Firecrawl's `site:vestiairecollective.com` returns 0 results. See §7 (B). |

### 6.5 What we tried (2026-05-15 PM debug iteration) — what worked, what didn't

User reported wrong Depop prices (e.g. listing was $45, we returned $39.55) and StockX prices appearing where the page had no Ask. This section captures the iterations so future-you doesn't re-walk the same path.

**Attempt 1 (failed): Open Graph product meta tags (`og:price:amount`, `product:price:amount`).**
- Assumption was these would be in `<head>` for all four sites.
- Reality (verified via `debug_probe.py`): **Depop and StockX emit NO product OG meta tags** on listing pages. The OG approach extracted 0 fields → fell through to LLM every time. Removed. See git history for `OG_PRODUCT_SCHEMA`.

**Attempt 2 (failed): bump `delay_before_return_html` from 1.5s → 3s, keep LLM extraction.**
- Improvement, but the LLM still occasionally grabbed prices from "More from seller" / "Similar items" rails because the markdown contained both the listing AND those sections.

**Attempt 3 (succeeded): structured-data extraction tier (`structured_extractors.py`).**
- Probed raw HTML with `debug_probe.py` to discover:
  - **Depop**: emits Schema.org JSON-LD `<script type="application/ld+json">` with `@type: "Product"` and `offers.price = "45.00"` for jeff250 — the actual listing price.
  - **StockX**: does NOT emit listing-level JSON-LD with the Ask. `__NEXT_DATA__` only contains i18n strings (market data is loaded client-side via React Query post-hydration). The Lowest Ask lives in `<h2 data-testid="trade-box-buy-amount">$74</h2>`. Related-product carousel asks use `data-testid="product-tile-lowest-ask-amount"` — must be ignored.
- **Critical realization**: StockX's "There are no Asks at this time" string is in the i18n bundle ALWAYS, regardless of whether the listing actually has an Ask. Don't use the string as a signal — use whether `trade-box-buy-amount` actually contains a value.
- Bumped `delay_before_return_html` to 5s (Depop's JSON-LD wasn't even in the HTML before this — page hadn't painted).
- End-to-end verification (live, against the running sidecar, 2026-05-15 PM):
  - Depop jeff250 → **$45.00** ✓ (was $39.55)
  - Depop finnbra → **$40.00** ✓ (was $32.20)
  - StockX FW24 → **$74** ✓ (was correct in dump but raced; structured-tier still right)
  - StockX SS25 → **price=null** ✓ (correctly reflects "no Asks"; was a hallucinated number before)

**Gotchas discovered during this iteration**:
1. `cleaned_html` from crawl4ai strips `<script>` tags. **For structured extraction, read `result.html` (raw), not `result.cleaned_html`**, or JSON-LD blocks vanish.
2. `target_elements` in `CrawlerRunConfig` scopes the markdown to that element and drops `<head>`. **Gate it to the LLM-fallback tier only** (`scope_to_target=True`); tier 1 needs full HTML.
3. `wait_until="networkidle"` times out on Depop/StockX (~45s) because they hold long-lived telemetry connections. Use `wait_until="domcontentloaded"` + a longer `delay_before_return_html` instead.
4. StockX's main listing Ask is rendered client-side; if the page didn't fully paint, the testid will be missing. `extract_stockx` returns None when **both** title and price are missing (page didn't render) but a valid dict with `price=None` when only the Ask is missing (genuinely no Ask).
5. StockX prices change in real time — a $74 ask scraped now can be $87 by the time the user clicks. That's not a scraper bug.

### 6.5b Third iteration (2026-05-15 evening) — Mercari, Vinted, Poshmark

User flagged: Mercari prices off (75 vs 110, 38 vs 42.75, 47 vs 115) and showing no/wrong pictures; Vinted prices correct but pictures showed a "green checkmark" icon and one listing was labeled CZK; Poshmark only returning 1 result despite multiple successful crawls (because the structured extractor always missed and the LLM fallback was the only thing that ever succeeded).

**Probe findings** (via `debug_probe.py` with 6s render delay):
- **Mercari**: no JSON-LD, no OG product meta. **`__NEXT_DATA__`** is the answer:
  - Path: `props.pageProps.serverState['ItemDetail:m21075527136']`
  - `price = 11000` — **CENTS, not dollars**. Divide by 100.
  - `name` → title; `photos[0].imageUrl` → real product photo
  - `status` enum: `"on_sale"` (available) vs `"sold_out"`/`"trading"`/`"completed"` (sold)
  - **`og:image` is a generic Mercari OGP placeholder (`ogp_image_1.png`) — the "green checkmark" the user saw was this placeholder. Use `photos[0].imageUrl` instead.**
- **Vinted**: no JSON-LD, no `__NEXT_DATA__`. Uses Next.js RSC streaming. The price lives in inline `<script>` tags as escaped JSON. Two key patterns:
  - `\"price\":{\"amount\":\"75.0\",\"currency_code\":\"USD\"}` — **listing pricing block**, underscored `currency_code`
  - `\"price\":{\"amount\":\"40\",\"currencyCode\":\"CZK\"}` — **shipping option** (per-market), camelCase `currencyCode`
  - Easy to mistake one for the other. The CZK number was a Czech shipping option, not the item price. **Match only the underscored variant.**
  - `og:image` IS the real product photo on Vinted (unlike Mercari). Use it.
  - `og:title` includes a `" | Vinted"` suffix — strip it.
- **Poshmark**: no JSON-LD, no `__NEXT_DATA__`. But:
  - `<meta property="og:type" content="product">` confirms it's a listing page (anti-bot walls won't have this)
  - `<meta property="og:title">` and `<meta property="og:image">` are present and correct
  - The main listing price is in `<p class="h1"><span>$68</span><span>$180</span></p>` — first span is listing, second is original/MSRP
  - `data-et-prop-listing_price="68"` (tracking attr) is also clean, but only appears on tile elements
  - `data-et-prop-inventory_status="available"|"sold"` is the sold signal

**Gotchas discovered**:
6. **Mercari prices are in CENTS in `__NEXT_DATA__`** — `11000` is $110.00. Forgetting `/100` will multiply the number by 100x.
7. **Mercari's `og:image` is a static placeholder** (`u-web-assets.mercdn.net/.../ogp_image_1.png`). Never use it — always use `photos[0].imageUrl` from `__NEXT_DATA__`.
8. **Vinted's RSC payload is double-escaped**: actual bytes are `\"price\":{\"amount\":\"75.0\"...` (backslash + quote, but `{` is NOT escaped). Regex must use `\\"price\\":\{\\"amount\\":...` — literal-backslash literal-quote for the field markers but a plain `\{` for the brace. **Off-by-one is easy to introduce here.** First version had `\\{` (literal `\{`) and matched nothing.
9. **Vinted's `currency_code` (underscored) vs `currencyCode` (camelCase) means very different things.** The underscored version is the item's listing pricing block. The camelCase version is a per-market shipping-option block — it can carry CZK, EUR, etc. even for a USD listing. Always match the underscored form.
10. **Vinted's RSC payload includes multiple `currency_code` matches** (item price, service fee, total). The **first** match is the item price. Subsequent matches are derived.
11. **Poshmark's `og:type=product`** distinguishes a real listing page from an anti-bot wall or login redirect — use it as a gate before parsing.
12. **Poshmark doesn't emit JSON-LD on listing pages**. The prior `extract_poshmark` that called `_extract_from_jsonld` always returned `None` — every Poshmark scrape was hitting LLM fallback. Don't add platforms to the generic JSON-LD extractor without verifying they actually emit Schema.org.

**Verification (live sidecar, 2026-05-15 evening)** — all 6 URLs the user flagged returned correct results:

| URL | Old | New | Truth |
|---|---|---|---|
| Mercari m21075527136 | $75 + placeholder image | **$110.00 + real photo** | $110 ✓ |
| Mercari m59794235815 | $38 + placeholder image | **$42.75 + real photo** | $42.75 ✓ |
| Mercari m14419494382 | $47 + placeholder image | **$115.00 + real photo** | $115 ✓ |
| Vinted 8139626124 | (price OK) + checkmark icon | **$75 USD + real photo** | $75 ✓ |
| Vinted 7287762265 | (price OK in CZK) + icon | **$32.25 USD + real photo** | $32.25 USD ✓ |
| Poshmark State-Black-Hoodie | LLM fallback (slow/flaky) | **$68 + real photo** (structured) | $68 ✓ |

### 6.5c Fourth iteration (2026-05-15 late evening) — overlay-removal corruption + Poshmark sold

User reported a sold Poshmark listing surfacing as available (NWT FullZip URL ending `…681ccba7db3a6f2599b10120`) and asked whether the recurring `Page.content: Unable to retrieve content because the page is navigating` was an anti-bot measure with a workaround.

**Smoking gun:** the live sidecar returned `price=100, isSold=false, image=icon-seller-discount.png` for that URL, while a local `extract_poshmark()` call on the same URL's HTML returned `price=$81, isSold=true, image=real photo`. Same code, different HTML.

**Root cause:** the sidecar's `CrawlerRunConfig(remove_overlay_elements=True)` was different from `debug_probe.py`'s `False`. Comparing both with identical wait/delay/UA:

| overlay_elements | html length | has `og:type="product"` | extractor result |
|---|---|---|---|
| ON (sidecar) | 762KB | ❌ NO | `None` (miss → LLM hallucinates) |
| OFF (probe)  | 534KB | ✅ YES | correct (sold detected, real photo) |

The overlay-removal JS runs inside the page; on Poshmark it either triggers a navigation (logged as `Failed to remove overlay elements: Execution context was destroyed`) or mutates the DOM such that the post-removal HTML is *larger* but missing key SSR meta tags. Disabling overlay-removal fixes Poshmark AND silences the cascading "page is navigating" warnings across all platforms.

The "anti-bot" the user asked about wasn't from Poshmark — **it was our own JS** trying to clean up overlays on a page that was still loading.

**Verification (overlay=OFF, against all working platforms):**

| Platform | URL | Result |
|---|---|---|
| Depop | jeff250 | $45.00 ✓ |
| Grailed | 94836806 | $75 ✓ |
| StockX | fw24-black | $74 ✓ |
| Mercari | m21075527136 | $110.00 ✓ |
| Vinted | 8139626124 | $75 USD ✓ |
| Poshmark SOLD | NWT-FullZip | $81 + isSold=true ✓ (was price=100, isSold=false) |
| Poshmark AVAILABLE | State-Black | $68 + isSold=false ✓ |

**Sold-detection trap:** Poshmark's CSS for the sold-banner (`.listing__status-banner__title--sold { font-weight:500; color:#aa2516 }`) is defined inside the page's `<style>` block on **every** listing, not just sold ones. A naive `'listing__status-banner__title--sold' in html` substring check matches the CSS rule definition and false-fires for available listings. Use `BeautifulSoup(html).find(class_="listing__status-banner__title--sold")` to query the actual rendered DOM element.

**Three-signal sold detection on Poshmark (any one fires)**:
1. `data-et-prop-inventory_status="sold_out"` (tracking attribute, only on the usage element)
2. `"availability":"…schema.org/OutOfStock"` (embedded microdata)
3. `<element class="listing__status-banner__title--sold">` queried via BeautifulSoup (NOT substring)

### Search-side platform: Phase 1 fixes still apply
The original timeout-fix work (May 13–14, 2026) is intact:
- Concurrency cap: 2 concurrent scrapes per platform (was 5+, then 45 in parallel across platforms, which caused mass timeouts)
- URL dedupe before scraping
- Search limit: 15 per platform (was 10)
- Scrape timeout: 40s
- `Promise.allSettled` so one platform's failure doesn't crash the response

These survived the migration; `app/api/search/route.ts` is unchanged from the Firecrawl era except for what `scrapeListing` now does under the hood, plus the 2026-05-16 streaming conversion described in §6.6.

### 6.6 Streaming search response + live progress bar (2026-05-16)

**Problem:** A full multi-platform search takes 30–60s. Until 2026-05-16 the only UI feedback was the Search button switching to "Searching…", which read as a frozen page.

**Shape of the fix:**
- `POST /api/search` now returns `application/x-ndjson` (one JSON object per `\n`-delimited line) over chunked transfer instead of a single `NextResponse.json(...)` payload.
- Three event types in `lib/types.ts` as the discriminated union `SearchStreamEvent`:
  - `{ type: 'start', query, platforms }` — emitted immediately, lets the UI render a checkpoint per selected platform in the "loading" state.
  - `{ type: 'platform_done', platform, status: 'ok' | 'failed', listings, count, error? }` — emitted the moment a platform settles. Order reflects real completion order (because `await Promise.all(platforms.map(async ...))` writes from inside each platform's resolution callback), not the order of the input array.
  - `{ type: 'final', priceRange, averagePrice }` — emitted after every platform settles. The cross-platform USD price stats logic was lifted verbatim from the old non-streaming response.
- Response headers include `Cache-Control: no-cache, no-transform` and `X-Accel-Buffering: no` to prevent dev-server / proxy buffering. `export const dynamic = 'force-dynamic'` is preserved.
- `SearchForm.tsx` consumes the stream with `res.body!.getReader()` + `TextDecoder({ stream: true })`, splits the buffer on `\n`, parses each line, calls a new `onProgress(event)` prop, and accumulates `platform_done` events into a `Record<string, PlatformResults>` so it can hand `onResults` the same `SearchResponse` shape `ResultsDisplay` already expects. **No change** to `ResultsDisplay`.
- `SearchSection.tsx` owns a new `progress: { platforms, statuses, errors } | null` state. `start` initializes all checkpoints to `loading`; each `platform_done` flips one to `done` or `failed` (carrying the error message into a tooltip).
- `SearchProgress.tsx` (new) renders a horizontal track with N evenly-spaced checkpoints. Fill width = `settled / total`. Loading = pulsing gray dot, done = filled black circle with checkmark, failed = red circle with X. Tailwind only.

**`failed` vs `ok` semantics — gotcha for future implementers:** the checkpoint goes `failed` only when `searchAndScrape(platform, query)` actually throws. eBay (bot-blocked) and Vestiaire (no search hits) currently swallow their failures upstream and return empty arrays, so they appear as `ok` with `count: 0`. If you want them to render as red X, the failure surface needs to be raised inside `searchAndScrape` / `searchPlatform` — that is **out of scope for the progress bar work**, but is the right next step if "search returned nothing" should look different from "platform is broken."

**Verified live (2026-05-16):**
- Curl with 3 platforms (`grailed,mercari,vinted`) for `nike air max 90`: `start` at T+0s, `platform_done` events at T+51s/T+53s/T+54s, `final` at T+54s. Lines arrived as separate chunks, not as one blob.
- Response headers confirmed: `content-type: application/x-ndjson`, `transfer-encoding: chunked`, `x-accel-buffering: no`.
- Single-platform run renders one checkpoint that fills to 100% on completion.
- Multi-platform run with eBay/Vestiaire Collective selected: those platforms still emit `platform_done` (status `ok`, `count: 0`) and do not block the others — confirms the `Promise.all`-based dispatch keeps platforms independent.

**Not yet visually verified by Claude (user should confirm in browser):**
- Visual styling of the progress bar at all sizes (Claude can't open a browser).
- The forced-failure case (sabotage `scrapeListing` to throw for one platform) — would actually render the red-X / tooltip path. Recommended quick test if the failed-state UI matters: add `throw new Error('test')` at the top of `scrapeListing` for one platform in `lib/firecrawl.ts`, run a search, confirm the checkpoint goes red with the tooltip, then revert.

**Out of scope (deferred):**
- Per-URL progress within a platform ("3/5 listings scraped") — would need sidecar protocol changes.
- Cancel / abort button.
- Persisting progress across page reloads.
- Auto-retry on `failed` platforms.

---

## 7. Open Problems & Recommended Next Steps

### A. eBay — blocked at the edge

**Symptom:** every `/scrape` against `ebay.com/itm/<id>` returns `null`. Logs show the page fetches (HTTP 200) but the LLM gets no extractable content.

**Root cause:** eBay's edge proxy redirects to `/splashui/challenge?...`. The challenge gate uses signals beyond Playwright fingerprint (IP reputation, cookie history, request cadence). `enable_stealth=True` + `user_agent_mode="random"` cover Chrome fingerprint but don't beat it.

**Options (none implemented yet):**
1. Residential proxy pool — most reliable, real monthly cost.
2. `undetected-chromedriver` or a custom Playwright launch with full fingerprint patching.
3. eBay's official Browse API — requires developer account + OAuth, but cheap/legitimate.
4. Drop eBay from the platform list for now.

### B. Vestiaire Collective — URL discovery gap

**Symptom:** `site:vestiairecollective.com <query>` via Firecrawl returns 0 web results, so the pipeline never has any Vestiaire Collective URLs to scrape. (Memory entry `project_vestiaire_search_gap.md` documents this.)

**Important:** the **scrape side works fine** — given a vestiairecollective.com URL directly, the sidecar extracts price/title/etc. correctly. The gap is purely in URL discovery.

**Proposed fix (to be implemented next session):**
- **Option 1 (recommended):** Crawl `vestiairecollective.com/search/?q=<query>` with the sidecar itself and extract listing URLs from the rendered results page. One extra render per search; no new dependency; keeps everything in-house.
- **Option 2:** Use a different search backend just for Vestiaire Collective (DuckDuckGo HTML, Bing Search API, SerpAPI).
- **Option 3:** Drop Vestiaire Collective.

User has agreed to **option 1** but has chosen to defer implementation. Next steps when picking this up: inspect `vestiairecollective.com/search/` HTML to determine if listing URLs are present in server-rendered HTML or require waiting for client-side hydration, then either parse with a regex/selector or add a second LLM-extraction prompt for "extract listing URLs from this search results page."

### C. Grailed — occasional first-call null

LLM extraction occasionally returns malformed JSON on the first request after a cold sidecar start. Retry succeeds. Not worth fixing yet — UI would already retry as part of the normal search loop. Worth a retry-once-on-null wrapper in `lib/scraper.ts` if it becomes a user-visible problem.

### E. StockX price drift / stale testid (deferred — user request)

**Symptom (2026-05-15 evening, user testing):**
- `…fleece-hoodie-black` → ours: $74, page: $175
- `…fleece-hoodie-jet-black` → ours: $130, page: $195
- `…modern-fleece-hoodie-jet-black` → ours: $542, page: "no Asks at this time"

The structured extractor reads `[data-testid="trade-box-buy-amount"]` faithfully. The value in our scrape *did* appear on the page at scrape time (we confirmed the same number is in the SSR HTML). But by the time the user clicks through, the Ask is gone or has changed dramatically. Two possibilities, both unverified:
1. **Real-time market drift.** StockX asks change as buyers consume them; what we see in SSR is a snapshot, the live page is up-to-date. The `542 → no Asks` case suggests the testid sometimes contains a *cached* Ask that has since been pulled.
2. **SSR vs CSR divergence.** StockX may emit a placeholder/stale value in the SSR HTML and replace it via React Query on hydration. We're reading SSR, not the hydrated DOM.

**User decision:** leave StockX as-is for now; revisit after eBay/anti-bot work. Document and move on.

**Investigation plan when picking back up:**
- Compare `trade-box-buy-amount` in raw SSR HTML vs the DOM after `await page.wait_for_selector("[data-testid='trade-box-buy-amount']"); await page.wait_for_timeout(5000)`.
- If they differ, structured extraction needs to wait for React Query to hydrate (or read the React Query cache out of the DOM).
- If they're the same, the issue is purely market drift and there's nothing to fix — possibly add a "scraped at" timestamp to the UI so users know prices can be stale.
- Check StockX's GraphQL endpoint (`/api/p/v2/products/<slug>/market`) — may be callable directly and would give us the live Ask without scraping.

### D. Carryover from Phase 1 (still open)

- **Grailed ~83% sold rate** — Google indexes lots of sold Grailed listings; nothing to do without paying for more search results or finding a different discovery method.
- **Depop GBP/EUR listings** — currency badge handles UI flagging; FX conversion would be a nice-to-have.
- **No pagination** — 15 search results per platform, no "load more."
- **No seller info, no price history, no auth, no watchlist** — all Phase 2.

---

## 8. Environment Setup

`.env` at repo root (`/Users/kevingui/Documents/Work/me/fashion-crawler-crawl4ai/.env`) must contain:

```
# Firecrawl — search only, no scraping
FIRECRAWL_API_KEY=fc-...

# LLM provider for the sidecar (litellm format: <provider>/<model>)
LLM_PROVIDER=openai/gpt-4o-mini
OPENAI_API_KEY=sk-proj-...

# Backup provider — switch LLM_PROVIDER above if needed; do not use as default
GEMINI_API_KEY=...

# Optional
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
PORT=8000
```

**Provider rules:**
- Default: OpenAI. Card on file, no rate-limit pain.
- Backup: Gemini. Rate-limits aggressively; only use when OpenAI is unavailable.
- Do **not** silently default to Groq/Anthropic/Mistral/Ollama. No card on those, or local-only.

### Python venv (already provisioned)
- `crawl4ai-service/venv/` — Python 3.11, crawl4ai 0.8.6, playwright 1.59.0, playwright_stealth 2.0.3, fastapi, uvicorn, litellm
- Playwright Chromium binaries at `~/Library/Caches/ms-playwright/chromium-1217` (already installed)
- No reinstall needed unless requirements change

### Running the stack

```bash
# Sidecar only (for testing extraction in isolation)
npm run dev:sidecar
# → uvicorn on :8000

# Full stack (Next.js + sidecar in parallel)
npm run dev:all
# → Next.js on :3000, sidecar on :8000
```

If port 8000 is already taken, `lsof -ti:8000 | xargs kill -9` and retry. The sidecar logs to `/tmp/sidecar.log` when started via the background pattern used during this session.

### Health check

```bash
curl http://localhost:8000/health
# {"status":"ok","llm_mode":"active","provider":"openai/gpt-4o-mini"}
```

If `llm_mode` is `stub`, the API key isn't being read — check `.env` and that `LLM_PROVIDER` matches a known prefix in `main.py`'s `_PROVIDER_KEY_ENV`.

---

## 9. Cost Model

| Operation | Cost |
|---|---|
| Firecrawl search (per platform per query) | 2 credits |
| Firecrawl scrape (deprecated, no longer used) | ~9–10 credits |
| Sidecar scrape | ~$0.0005–$0.002 in OpenAI tokens |
| Full search across 6 working platforms | ~12 Firecrawl credits + ~$0.02 OpenAI |

**Before the migration:** a full search burned ~400–450 Firecrawl credits and ate the $16/mo Hobby plan's 3,000 credits in ~7 sessions.
**After the migration:** ~12–16 Firecrawl credits per search. The same plan now affords hundreds of sessions per month.

### Be conservative with diagnostic scripts

| Script | Cost |
|---|---|
| `diagnose-counts.mjs` | 3 Firecrawl credits (search only) |
| `test-all-platforms.mjs` | ~16 Firecrawl credits (search) + ~$0.02 OpenAI |
| `diagnose-scrape.mjs` | 9 Firecrawl scrape credits — **legacy, uses old Firecrawl scraping; avoid** |
| `diagnose-parallel.mjs` | 25+ Firecrawl scrape credits — **legacy; avoid** |

The diagnose-scrape and diagnose-parallel scripts were written before the migration and still call Firecrawl's scrape endpoint directly. They're useful as a baseline comparison but cost real credits. Prefer `test-all-platforms.mjs` for end-to-end validation now.

---

## 10. Testing Checklist

When picking this up in a future session, verify in this order before making changes:

1. `curl http://localhost:8000/health` → `llm_mode: active`
2. Single-listing smoke test, e.g.
   ```bash
   curl -X POST http://localhost:8000/scrape -H 'Content-Type: application/json' \
     -d '{"url":"https://www.grailed.com/listings/<active-listing>","platform":"grailed"}'
   ```
   Expect non-null `result` with price + image.
3. Full sweep: `node --env-file=.env scripts/test-all-platforms.mjs`
   Expect ~6/8 platforms to extract. eBay and Vestiaire failures are known.
4. Full UI test (only if needed — costs real Firecrawl credits): `npm run dev:all`, search via UI.

---

## 11. Key Gotchas & Learnings

1. **Sidecar must be running before `/api/search` works.** Use `npm run dev:all` during development, not `npm run dev`.
2. **`enable_stealth=True` is non-negotiable** — StockX returns garbage without it. eBay still beats it.
3. **`word_count_threshold: 0` for Depop and eBay** — without it, the LLM gets the sidebar's "similar items" instead of the actual listing.
4. **Do not enable `light_mode`/`text_mode`/`memory_saving_mode`** on the crawl4ai BrowserConfig — they break SPA rendering on Grailed/Depop/StockX.
5. **First LLM call after a cold sidecar can produce malformed JSON.** Retry usually works. Mostly affects Grailed in observation.
6. **Firecrawl's `site:vestiairecollective.com` returns zero results.** Known platform-specific search-index gap; Vestiaire Collective needs its own discovery path.
7. **Concurrency cap of 2 per platform** — going higher caused mass timeouts in the original Firecrawl architecture. Hasn't been re-tested under the sidecar; raise only with care since the sidecar shares one Playwright browser.
8. **`onlyMainContent` was the Firecrawl name; the crawl4ai equivalent is `word_count_threshold`** (lower = keep more short blocks). Same intent, different knob.
9. **The schema in `extractors.py` must match the TypeScript `ScrapedListing` shape in `lib/firecrawl.ts` and `lib/scraper.ts`.** They're independently defined and silent drift will null-out fields.
10. **Image URLs expire on some platforms.** Frontend has `onError` handlers; don't try to validate URLs at scrape time.
11. **Structured extraction (JSON-LD / testid CSS) is now the primary tier.** LLM is only a fallback. If you're debugging a wrong price, check `structured_extractors.py` first — most listings won't even reach the LLM.
12. **Read `result.html` for structured extraction, NOT `result.cleaned_html`.** The latter strips `<script>` tags and JSON-LD with it.
13. **`target_elements` is gated to the LLM tier** (`scope_to_target=True`). Don't apply it to the structured tier — it drops `<head>` meta and JSON-LD.
14. **`wait_until="networkidle"` is unreliable on Depop/StockX** (times out). Use `domcontentloaded` + `delay_before_return_html=5s` (6s Poshmark; 7s on retry). The Depop JSON-LD doesn't paint until ~3–5s in.
15. **StockX's "There are no Asks at this time" string is ALWAYS present** in the i18n bundle — don't use the string as a signal. Use whether `[data-testid="trade-box-buy-amount"]` has text.
16. **Related-product carousels on StockX use `data-testid="product-tile-lowest-ask-amount"`** (with `tile`). The main listing uses `trade-box-buy-amount`. Don't confuse them.
17. **`debug_probe.py` exists** for future debugging — it dumps OG meta, JSON-LD, `__NEXT_DATA__`, inline script JSON, and visible `$`-adjacent text from any URL. Saves raw HTML to `crawl4ai-service/debug_dumps/` for offline grepping.
18. **Mercari prices in `__NEXT_DATA__` are in CENTS.** `11000` = $110.00. Always `/100`.
19. **Mercari's `og:image` is a generic placeholder** (`ogp_image_1.png`). Read `photos[0].imageUrl` from `__NEXT_DATA__.props.pageProps.serverState['ItemDetail:<id>'].photos` instead.
20. **Vinted's RSC payload is double-escaped.** Literal bytes: `\"price\":{\"amount\":\"75.0\",\"currency_code\":\"USD\"}`. Regex must use `\\"price\\":\{...` — backslash-quote for field markers, plain `\{` for the brace. Off-by-one is easy: first version had `\\{` and matched nothing.
21. **Vinted's `currency_code` (underscored) ≠ `currencyCode` (camelCase).** Underscored = listing pricing. CamelCase = per-market shipping option (can be CZK on a USD listing). **Always match the underscored form.**
22. **Poshmark does NOT emit Schema.org JSON-LD on listing pages.** Don't add new platforms to `_extract_from_jsonld` without first verifying via `debug_probe.py` that they actually emit `<script type="application/ld+json">` with `@type: "Product"`. Poshmark's signals are `<meta property="og:type" content="product">` (gate), `og:title`, `og:image`, `<p class="h1"><span>$N</span></p>` (first span = listing price), and `data-et-prop-inventory_status` (sold).
23. **`remove_overlay_elements=True` is HARMFUL.** It runs JS in the page to remove overlay nodes; on Poshmark this triggers a navigation (logged as `Failed to remove overlay elements: Execution context was destroyed`) or strips `<meta property="og:type">` and other critical SSR meta. The recurring "Page.content: Unable to retrieve content because the page is navigating" errors that look like anti-bot are actually caused by *our own JS*. Keep it set to `False` in `_build_run_cfg`.
24. **CSS rule definitions are NOT element presence.** Poshmark defines `.listing__status-banner__title--sold { … }` in every page's `<style>` block whether or not the listing is sold. `'listing__status-banner__title--sold' in html` matches the CSS rule, not the rendered element. Always query via `BeautifulSoup(html).find(class_="…")` when checking for a rendered DOM element. (Same trap applies to any class detection on any platform.)
25. **Schema.org availability can be reused in vocabulary references.** A page can mention `schema.org/OutOfStock` as a generic enum link without the listing actually being sold. Match the FULL `"availability":"…OutOfStock"` JSON key/value pair, not just the URL substring.

---

## 12. What's Next (proposed order)

1. **Investigate StockX SSR-vs-CSR price drift** (§7 E). User has deferred this; revisit when picking up the project. The structured extractor is reading the SSR snapshot, which sometimes contains a stale Ask. Investigation steps are in §7 E.
2. **Decide on eBay** (§7 A) — either invest in proxy/API solution, or formally drop eBay from `PLATFORM_DOMAINS` so the UI stops surfacing the empty tab.
3. **Implement Vestiaire URL discovery** via sidecar (§7 B option 1). Scoped, low-risk.
4. **Add retry-once-on-null wrapper** in `lib/scraper.ts` for residual flaky-first-call cases (cheap, ~10 lines).
5. **Phase 2 work** — saved searches, price history, watchlist, auth. Supabase env vars already in place.

---

## 13. Code Reference Card

```typescript
// lib/firecrawl.ts — entry points
export async function searchPlatform(platform: string, query: string): Promise<RawSearchResult[]>
export async function scrapeListing(url: string, platform: string): Promise<ScrapedListing | null>
// scrapeListing delegates to scrapeViaSidecar() in lib/scraper.ts

// ScrapedListing shape (must match crawl4ai-service/extractors.py:LISTING_SCHEMA)
interface ScrapedListing {
  url: string;
  title: string | null;
  price: number | null;
  currency: string;       // defaults "USD"
  isSold: boolean;
  condition: string | null;
  imageUrl: string | null;
}
```

```python
# crawl4ai-service/extractors.py — sources of truth for prompts/options
LISTING_SCHEMA         # JSON schema, mirrors ScrapedListing
PLATFORM_PROMPTS       # per-platform extraction instructions
PLATFORM_CRAWLER_OPTIONS    # crawl4ai BrowserConfig tweaks (word_count_threshold etc.)
PLATFORM_EXTRACTION_OPTIONS # LLMExtractionStrategy tweaks (apply_chunking etc.)
```
