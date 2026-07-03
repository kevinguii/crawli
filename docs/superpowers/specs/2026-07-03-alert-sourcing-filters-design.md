# Simplify search alert sourcing filters

## Problem

The "Create/Edit search alert" modal (`app/components/alerts/CreateAlertModal.tsx`) has an optional "Sourcing filters" section with four inputs: Brand, Size, Max price, Keywords. Feedback: brand and keywords add clutter for a use case nobody exercises, and size-as-free-text is error-prone (typos, inconsistent formats like "L" vs "Large" vs "large").

Data check (2026-07-03, prod Supabase, `saved_searches` table): 3 total alerts, 0 use `criteria.brand`, 0 use `criteria.keywordsAll`, 1 uses `criteria.size` (`"L"`, free text). Safe to remove brand/keywords outright with no migration.

## Scope

One shared modal drives both create and edit (`editingAlert` prop toggles PATCH vs POST). Changes apply to both flows — there is no separate "edit-only" mode.

Files touched:
- `app/components/alerts/CreateAlertModal.tsx` — form UI, `buildCriteria()`, confirm-step summary
- `app/api/saved-searches/route.ts` — POST zod schema (`createSchema.criteria`)
- `lib/alertRunner.ts` — `AlertCriteria` interface, `applyCriteria()`, size matching
- `app/api/saved-searches/[id]/route.ts` — **no change**; PATCH already uses `z.record(z.string(), z.unknown())` for `criteria`, so it's schema-agnostic.

## Changes

### 1. Remove brand and keywords entirely

- `CreateAlertModal.tsx`: delete the `brand`/`keywords` state, their two `<input>`s, and their lines in `buildCriteria()` and the confirm-step filter summary (`c.brand`, `c.keywordsAll` parts).
- `lib/alertRunner.ts`: drop `brand` and `keywordsAll` from `AlertCriteria`, and their matching branches in `applyCriteria()`.
- `app/api/saved-searches/route.ts`: drop `brand` and `keywordsAll` from `createSchema.criteria`.

No backward-compat shim — 0 rows use these fields today, so nothing breaks.

### 2. Size becomes a `<select>` dropdown

- Replace the free-text `critSize` `<input>` with a native `<select>`, reusing `SIZE_OPTIONS` from `lib/filterOptions.ts` (the same table the main search `FilterPanel` uses).
- Structure: default option "Any size" (empty value), then two `<optgroup>`s — "Clothing" (from `CLOTHING_SIZE_OPTIONS`: XS–XXL) and "Shoes" (from `SHOE_SIZE_OPTIONS`: labels like "M 7 / W 8.5").
- Stored value is the option `key` (e.g. `'l'`, `'m7_5'`), not a display label.
- `editingAlert?.criteria.size` pre-fills the select via `critField(editingAlert?.criteria, 'size').toLowerCase()` — lowercasing on load means the existing `"L"` row correctly pre-selects the `'l'` (Clothing → L) option, matching how `alertRunner.ts` already lowercases `criteria.size` before matching.

### 3. Backend size matching: swap in `matchListingSize`

- `lib/alertRunner.ts` currently matches size via a naive `sizeMatches()` (substring on `listing.size`, else whole-word regex on title).
- Replace with `matchListingSize(title, sizeKey, rawSize)` from `lib/sizeFilter.ts`, which already handles structured keys correctly for both clothing (`CLOTHING_PATTERNS`/`CLOTHING_RAW_TOKENS`) and shoes (`shoeKeyToNumber`/`shoeRegex`).
- `criteria.size` is already lowercased before use (`criteria.size?.trim().toLowerCase()`), so the existing `"L"` row still matches correctly as key `"l"`.

### 4. Layout and copy

- "Sourcing filters" grid goes from 4 inputs to 2 (Size select + Max price), still `grid-cols-2 gap-2`, one row.
- Helper text: "Only notify when a listing matches all of these. e.g. size AND under $X." (drop "brand AND").

## Out of scope

- No changes to platforms, cadence, or the confirm/summary step beyond removing the brand/keywords line.
- No DB migration — the one existing free-text `"L"` value is left as-is; only the matching logic changes to interpret it correctly going forward.
- No changes to `[id]/route.ts` (PATCH schema is already generic).

## Testing

- `npx tsc --noEmit` clean.
- Manual: open Create alert modal — confirm Brand/Keywords gone, Size renders as a grouped dropdown, Max price still works, confirm-step summary shows only size/price filters when set.
- Manual: edit the existing "black longsleeve messi jersey" alert (size `"L"`) — confirm it loads, saving with a freshly-picked size persists the lowercase key, and the alert cron matching still works for that listing size going forward.
- Light + dark mode check on the new `<select>`.
