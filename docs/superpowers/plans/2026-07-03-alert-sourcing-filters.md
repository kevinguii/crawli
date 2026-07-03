# Simplify Alert Sourcing Filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the Brand and Keywords sourcing-filter fields from the search alert create/edit modal, and replace the free-text Size field with a dropdown backed by the same size table the main search filter panel uses.

**Architecture:** One shared modal (`CreateAlertModal.tsx`) drives both create (POST) and edit (PATCH) — changes apply to both. The `AlertCriteria` shape shrinks from `{ brand, keywordsAll, size, minPrice, maxPrice }` to `{ size, minPrice, maxPrice }`. Size values switch from arbitrary free text to structured keys from `lib/filterOptions.ts`'s `SIZE_OPTIONS` (e.g. `'l'`, `'m7_5'`), and the alert-matching code swaps its naive substring size-matcher for the already-correct `matchListingSize()` used by the main search path.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Zod, Supabase. No test framework in this repo (no jest/vitest) — verification is `npx tsc --noEmit` plus manual browser checks per project convention (see `CLAUDE.md` testing checklist).

## Global Constraints

- `npx tsc --noEmit` must be clean after every task.
- No DB migration — the one existing alert with `criteria.size = "L"` (free text) is left as-is in the DB; only matching/display logic changes to interpret it correctly.
- No changes to `app/api/saved-searches/[id]/route.ts` — its PATCH schema already uses `z.record(z.string(), z.unknown())` for `criteria`, so it needs no edits.
- Do not touch platforms, cadence, or any part of the modal's confirm step other than the filters summary line.

---

### Task 1: Backend — drop brand/keywords, swap size matcher in `alertRunner.ts`

**Files:**
- Modify: `lib/alertRunner.ts:22-100`

**Interfaces:**
- Consumes: `matchListingSize(title: string | null | undefined, sizeKey: string | null | undefined, rawSize?: string | null): boolean` from `lib/sizeFilter.ts` (already exists, no changes needed to that file).
- Produces: `AlertCriteria` shrinks to `{ size?: string | null; minPrice?: number | null; maxPrice?: number | null }` — consumed by Task 2 (API schema) and Task 3 (frontend `buildCriteria()`).

- [ ] **Step 1: Read the current file to confirm line numbers haven't drifted**

Run: `sed -n '1,100p' lib/alertRunner.ts`
Expected: matches the excerpt below (import block, `AlertCriteria` interface, `escapeRegExp`, `sizeMatches`, `applyCriteria`).

- [ ] **Step 2: Add the `matchListingSize` import**

In `lib/alertRunner.ts`, change the import block at the top:

```typescript
import { createAdminClient } from '@/lib/supabase/admin';
import { runSearchJob } from '@/lib/searchWorker';
import { buildCacheKey, withListingsCache } from '@/lib/searchCache';
import type { FilterState } from '@/lib/filterOptions';
import type { Listing } from '@/lib/types';
import { convertToUSD } from '@/lib/currency';
import { matchListingSize } from '@/lib/sizeFilter';
import { Resend } from 'resend';
import { buildAlertEmailHtml } from '@/lib/email/alertEmailTemplate';
import { ALERT_EXCLUDED_PLATFORMS } from '@/lib/alertConstants';
import { nextAnchoredRunAt } from '@/lib/alertSchedule';
import { TIER_CAPS, type Tier } from '@/lib/stripe';
```

(This inserts the `matchListingSize` import line; everything else is unchanged.)

- [ ] **Step 3: Shrink `AlertCriteria` — remove `brand` and `keywordsAll`**

Replace:

```typescript
export interface AlertCriteria {
  brand?: string | null;       // must appear in listing.title (case-insensitive)
  keywordsAll?: string[];      // every token must appear in listing.title
  size?: string | null;        // must appear in listing.size or title
  minPrice?: number | null;    // listing price >= minPrice (USD-normalized)
  maxPrice?: number | null;    // listing price <= maxPrice (USD-normalized)
}
```

with:

```typescript
export interface AlertCriteria {
  size?: string | null;        // SIZE_OPTIONS key (e.g. 'l', 'm7_5'); matched via matchListingSize
  minPrice?: number | null;    // listing price >= minPrice (USD-normalized)
  maxPrice?: number | null;    // listing price <= maxPrice (USD-normalized)
}
```

- [ ] **Step 4: Remove `escapeRegExp` and `sizeMatches`, since `matchListingSize` replaces both**

Delete these two functions entirely:

```typescript
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Size match: prefer the structured `size` field (substring is fine — values are
 * like 'm', 'm7_5'); fall back to a WHOLE-WORD match in the title so a
 * single-letter size like "M" doesn't false-match inside words like "atom".
 */
function sizeMatches(listing: Listing, size: string): boolean {
  if ((listing.size ?? '').toLowerCase().includes(size)) return true;
  return new RegExp(`\\b${escapeRegExp(size)}\\b`, 'i').test(listing.title ?? '');
}
```

- [ ] **Step 5: Update `applyCriteria()` — drop brand/keywords matching, use `matchListingSize`**

Replace:

```typescript
export function applyCriteria(
  listings: Listing[],
  criteria: AlertCriteria | null | undefined,
): Listing[] {
  if (!criteria) return listings;
  const brand = criteria.brand?.trim().toLowerCase();
  const keywords = (criteria.keywordsAll ?? [])
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean);
  const size = criteria.size?.trim().toLowerCase();
  const { minPrice, maxPrice } = criteria;
  const hasPriceBound = minPrice != null || maxPrice != null;

  return listings.filter((l) => {
    const title = (l.title ?? '').toLowerCase();

    if (brand && !title.includes(brand)) return false;
    if (keywords.length && !keywords.every((k) => title.includes(k))) return false;
    if (size && !sizeMatches(l, size)) return false;

    if (hasPriceBound) {
      const usd = priceInUSD(l);
      if (usd == null) return false; // a price bound is set but this listing has no usable price
      if (minPrice != null && usd < minPrice) return false;
      if (maxPrice != null && usd > maxPrice) return false;
    }

    return true;
  });
}
```

with:

```typescript
export function applyCriteria(
  listings: Listing[],
  criteria: AlertCriteria | null | undefined,
): Listing[] {
  if (!criteria) return listings;
  const size = criteria.size?.trim().toLowerCase();
  const { minPrice, maxPrice } = criteria;
  const hasPriceBound = minPrice != null || maxPrice != null;

  return listings.filter((l) => {
    if (size && !matchListingSize(l.title, size, l.size)) return false;

    if (hasPriceBound) {
      const usd = priceInUSD(l);
      if (usd == null) return false; // a price bound is set but this listing has no usable price
      if (minPrice != null && usd < minPrice) return false;
      if (maxPrice != null && usd > maxPrice) return false;
    }

    return true;
  });
}
```

- [ ] **Step 6: Verify no other file references the removed symbols**

Run: `grep -rn "criteria.brand\|criteria\.keywordsAll\|AlertCriteria" lib/ app/ --include="*.ts" --include="*.tsx" | grep -v node_modules`
Expected: only `lib/alertRunner.ts` (the interface definition) and `app/components/alerts/CreateAlertModal.tsx` (fixed in Task 3) show up. If any other file references `criteria.brand` or `criteria.keywordsAll`, stop and report it before continuing.

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit`
Expected: fails only on `app/components/alerts/CreateAlertModal.tsx` and `app/api/saved-searches/route.ts` (not yet updated — Tasks 2 and 3). No errors in `lib/alertRunner.ts` itself.

- [ ] **Step 8: Commit**

```bash
git add lib/alertRunner.ts
git commit -m "$(cat <<'EOF'
Drop brand/keywords alert criteria, match size via matchListingSize

No production alert uses brand or keywords criteria (verified against
prod data), so they're removed rather than kept dormant. Size matching
now reuses the same matchListingSize() logic as the main search filter
panel instead of a bespoke substring/regex matcher.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: API — drop brand/keywords from the POST criteria schema

**Files:**
- Modify: `app/api/saved-searches/route.ts:30-40`

**Interfaces:**
- Consumes: nothing new (zod only).
- Produces: `createSchema.criteria` now only validates `{ size, minPrice, maxPrice }` — the frontend's `buildCriteria()` (Task 3) must only ever send these three keys.

- [ ] **Step 1: Remove `brand` and `keywordsAll` from the criteria schema**

Replace:

```typescript
  // AND-only boolean sourcing criteria (brand AND size AND price<X), applied as
  // a post-filter in alertRunner. All fields optional; null/absent = no-op.
  criteria: z
    .object({
      brand: z.string().max(80).nullable().optional(),
      keywordsAll: z.array(z.string().max(40)).max(10).optional(),
      size: z.string().max(40).nullable().optional(),
      minPrice: z.number().nonnegative().nullable().optional(),
      maxPrice: z.number().nonnegative().nullable().optional(),
    })
    .partial()
    .nullable()
    .optional(),
```

with:

```typescript
  // AND-only boolean sourcing criteria (size AND price<X), applied as
  // a post-filter in alertRunner. All fields optional; null/absent = no-op.
  criteria: z
    .object({
      size: z.string().max(40).nullable().optional(),
      minPrice: z.number().nonnegative().nullable().optional(),
      maxPrice: z.number().nonnegative().nullable().optional(),
    })
    .partial()
    .nullable()
    .optional(),
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors introduced by this file (still expected to fail in `CreateAlertModal.tsx`, fixed next).

- [ ] **Step 3: Commit**

```bash
git add app/api/saved-searches/route.ts
git commit -m "$(cat <<'EOF'
Drop brand/keywords from alert creation criteria schema

Matches the AlertCriteria shape change in lib/alertRunner.ts.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Frontend — remove Brand/Keywords inputs, add Size dropdown

**Files:**
- Modify: `app/components/alerts/CreateAlertModal.tsx`

**Interfaces:**
- Consumes: `SIZE_OPTIONS`, `CLOTHING_SIZE_OPTIONS`, `SHOE_SIZE_OPTIONS` from `@/lib/filterOptions` (each entry: `{ key: string; label: string; queryTerm: string }`).
- Produces: `buildCriteria()` returns `{ size?: string; maxPrice?: number } | undefined` — matches the `AlertCriteria`/schema shape from Tasks 1–2.

- [ ] **Step 1: Import the size option tables**

At the top of `app/components/alerts/CreateAlertModal.tsx`, change:

```typescript
import { PLATFORM_NAMES } from '@/lib/types';
```

to:

```typescript
import { PLATFORM_NAMES } from '@/lib/types';
import { CLOTHING_SIZE_OPTIONS, SHOE_SIZE_OPTIONS } from '@/lib/filterOptions';
```

- [ ] **Step 2: Remove `brand` and `keywords` state, lowercase the size prefill**

Replace:

```typescript
  const [cadence, setCadence] = useState<24 | 168>(editingAlert?.cadence_hours ?? 24);
  // Optional AND-only sourcing criteria — narrows matches to brand AND size AND
  // price<X. Empty fields are omitted (no-op).
  const [brand, setBrand] = useState(critField(editingAlert?.criteria, 'brand'));
  const [keywords, setKeywords] = useState(critField(editingAlert?.criteria, 'keywordsAll'));
  const [critSize, setCritSize] = useState(critField(editingAlert?.criteria, 'size'));
  const [maxPrice, setMaxPrice] = useState(critField(editingAlert?.criteria, 'maxPrice'));
```

with:

```typescript
  const [cadence, setCadence] = useState<24 | 168>(editingAlert?.cadence_hours ?? 24);
  // Optional AND-only sourcing criteria — narrows matches to size AND price<X.
  // Empty fields are omitted (no-op). critSize stores a SIZE_OPTIONS key
  // (e.g. 'l', 'm7_5'); lowercased on load so a pre-dropdown free-text value
  // like "L" still pre-selects the matching option.
  const [critSize, setCritSize] = useState(critField(editingAlert?.criteria, 'size').toLowerCase());
  const [maxPrice, setMaxPrice] = useState(critField(editingAlert?.criteria, 'maxPrice'));
```

- [ ] **Step 3: Update `buildCriteria()`**

Replace:

```typescript
  function buildCriteria(): Record<string, unknown> | undefined {
    const criteria: Record<string, unknown> = {};
    if (brand.trim()) criteria.brand = brand.trim();
    const kw = keywords.split(',').map((s) => s.trim()).filter(Boolean);
    if (kw.length) criteria.keywordsAll = kw;
    if (critSize.trim()) criteria.size = critSize.trim();
    const mp = parseFloat(maxPrice);
    if (!isNaN(mp) && mp > 0) criteria.maxPrice = mp;
    return Object.keys(criteria).length ? criteria : undefined;
  }
```

with:

```typescript
  function buildCriteria(): Record<string, unknown> | undefined {
    const criteria: Record<string, unknown> = {};
    if (critSize.trim()) criteria.size = critSize.trim();
    const mp = parseFloat(maxPrice);
    if (!isNaN(mp) && mp > 0) criteria.maxPrice = mp;
    return Object.keys(criteria).length ? criteria : undefined;
  }
```

- [ ] **Step 4: Replace the Brand/Size/Keywords inputs with Size dropdown + Max price**

Replace the whole "Sourcing criteria" block:

```typescript
            {/* Sourcing criteria (optional, AND-only) */}
            <div className="mb-4">
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                Sourcing filters <span style={{ color: 'var(--text-dim)' }}>(optional)</span>
              </label>
              <p className="text-[11px] mb-2" style={{ color: 'var(--text-dim)' }}>
                Only notify when a listing matches all of these. e.g. brand AND size AND under $X.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  placeholder="Brand (e.g. Arc'teryx)"
                  className="rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
                />
                <input
                  type="text"
                  value={critSize}
                  onChange={(e) => setCritSize(e.target.value)}
                  placeholder="Size (e.g. M, 10.5)"
                  className="rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
                />
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  placeholder="Max price ($)"
                  className="rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
                />
                <input
                  type="text"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  placeholder="Keywords (comma sep.)"
                  className="rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
                />
              </div>
            </div>
```

with:

```typescript
            {/* Sourcing criteria (optional, AND-only) */}
            <div className="mb-4">
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                Sourcing filters <span style={{ color: 'var(--text-dim)' }}>(optional)</span>
              </label>
              <p className="text-[11px] mb-2" style={{ color: 'var(--text-dim)' }}>
                Only notify when a listing matches all of these. e.g. size AND under $X.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={critSize}
                  onChange={(e) => setCritSize(e.target.value)}
                  className="rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
                >
                  <option value="">Any size</option>
                  <optgroup label="Clothing">
                    {CLOTHING_SIZE_OPTIONS.map((o) => (
                      <option key={o.key} value={o.key}>{o.label}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Shoes">
                    {SHOE_SIZE_OPTIONS.map((o) => (
                      <option key={o.key} value={o.key}>{o.label}</option>
                    ))}
                  </optgroup>
                </select>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  placeholder="Max price ($)"
                  className="rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
                />
              </div>
            </div>
```

- [ ] **Step 5: Update the confirm-step filter summary**

Replace:

```typescript
              {(() => {
                const c = buildCriteria();
                if (!c) return null;
                const parts: string[] = [];
                if (c.brand) parts.push(`brand: ${c.brand}`);
                if (Array.isArray(c.keywordsAll)) parts.push(`has: ${(c.keywordsAll as string[]).join(' + ')}`);
                if (c.size) parts.push(`size: ${c.size}`);
                if (c.maxPrice != null) parts.push(`under $${c.maxPrice}`);
                return (
```

with:

```typescript
              {(() => {
                const c = buildCriteria();
                if (!c) return null;
                const parts: string[] = [];
                if (c.size) {
                  const opt = [...CLOTHING_SIZE_OPTIONS, ...SHOE_SIZE_OPTIONS].find((o) => o.key === c.size);
                  parts.push(`size: ${opt?.label ?? c.size}`);
                }
                if (c.maxPrice != null) parts.push(`under $${c.maxPrice}`);
                return (
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: clean, no errors anywhere.

- [ ] **Step 7: Commit**

```bash
git add app/components/alerts/CreateAlertModal.tsx
git commit -m "$(cat <<'EOF'
Replace alert Brand/Keywords inputs with a Size dropdown

Reuses the same CLOTHING_SIZE_OPTIONS/SHOE_SIZE_OPTIONS tables the main
search filter panel uses, so alert sourcing filters stay consistent
with search filters. Brand and keywords are removed — zero production
alerts used them.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Manual verification

**Files:** none (verification only).

- [ ] **Step 1: Start the dev servers**

Run: `npm run dev:all`
Expected: Next.js on :3000, Python sidecar on :8000, no startup errors.

- [ ] **Step 2: Open the Create alert modal in a browser**

Navigate to the page that opens `CreateAlertModal` (search alerts tab / "Save as alert" CTA). Confirm:
- No Brand or Keywords inputs are present.
- "Sourcing filters" shows exactly two controls: a Size dropdown (default "Any size", with "Clothing" and "Shoes" optgroups) and a Max price number input.
- Selecting a clothing size (e.g. "L") and a max price, clicking Next, shows `size: L · under $<price>` in the confirm-step Filters row.
- Light and dark mode both render the `<select>` correctly (check `[data-theme="dark"]` toggle).

- [ ] **Step 3: Edit the existing "black longsleeve messi jersey" alert**

Open its Edit modal. Confirm:
- Size dropdown pre-selects "L" (Clothing group) — this exercises the `.toLowerCase()` prefill fix from Task 3, Step 2.
- Saving without changing the size keeps `criteria.size` as `"l"` after the PATCH (verify via `mcp__claude_ai_Supabase__execute_sql`: `select criteria from saved_searches where query = 'black longsleeve messi jersey';` → expect `{"size": "l"}` after this edit, replacing the old `{"size": "L"}`).

- [ ] **Step 4: Confirm no console/network errors**

Check the browser Network tab for the `POST /api/saved-searches` and `PATCH /api/saved-searches/<id>` calls made in Steps 2–3 — both should return 2xx with no console errors.

- [ ] **Step 5: Free ports and update docs**

Run: `lsof -ti:3000,8000 | xargs kill -9 2>/dev/null; true` (or the project's documented cleanup steps in `docs/CLEANUP.md`)

Update `HANDOFF.md` "Recent changes" with a one-line bullet, e.g.: "Alert sourcing filters: removed brand/keywords, size is now a dropdown (`lib/filterOptions.ts` SIZE_OPTIONS)." No `docs/PLATFORM_STATUS.md` or `docs/PITFALLS.md` update needed — this doesn't touch platform extraction or introduce a new gotcha.

- [ ] **Step 6: Final commit for docs**

```bash
git add HANDOFF.md
git commit -m "$(cat <<'EOF'
Update HANDOFF.md for alert sourcing filter changes

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review Notes

- **Spec coverage:** All four spec changes (remove brand/keywords, size dropdown, `matchListingSize` swap, layout/copy) map to Tasks 1–3. Testing checklist from the spec maps to Task 4.
- **Type consistency:** `AlertCriteria.size` (Task 1) is `string | null | undefined`; frontend `critSize` (Task 3) is always a `string` (possibly `''`), and `buildCriteria()` only sets `criteria.size` when non-empty — consistent with how `maxPrice` is already handled. `matchListingSize`'s signature (`title`, `sizeKey`, `rawSize`) matches the call site `matchListingSize(l.title, size, l.size)` using `Listing.title: string` and `Listing.size: string | null`.
- **No placeholders:** every step has literal before/after code or an exact command with expected output.
