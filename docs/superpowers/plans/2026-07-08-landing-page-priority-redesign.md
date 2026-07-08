# Landing Page Priority Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorder the Crawli landing page so cross-platform price comparison leads the hero, search alerts + tracked listings are pitched together immediately after, and the margin calculator moves to its own supporting section further down — replacing the current margin-calculator-led hero.

**Architecture:** A new pure/async data-layer function (`getCompareHeroData`) reads the existing `compare_snapshots` cache (no new scrape, no new endpoint) and feeds a new client-side hero widget (`CompareHeroWidget`) that rotates through real per-platform prices for a curated set of items. Two mock sections (`AlertsMock`, `SavesMock`) are merged into one tabbed section (`AlertsAndTrackedSection`). The margin calculator (`FlipCalculator`, unchanged) is relocated into its own new section (`MarginSection`). `BentoFeatures` is trimmed since its three "hero" cards now have full sections of their own. `app/page.tsx` is the final integration point that reorders everything and wires the new data fetch.

**Tech Stack:** Next.js 16 App Router (React Server + Client Components), TypeScript, Tailwind v4, Supabase (admin client), no test framework in this repo — verification is `npx tsc --noEmit` + manual browser check, per this project's established convention (see `docs/core/PITFALLS.md` and `HANDOFF.md`'s "mobile overflow fixes" entry, which used a throwaway harness with real components + worst-case data instead of a unit-test suite).

## Global Constraints

- No new backend endpoints, no live/on-demand scraping triggered by anonymous visitors, no DB schema changes. Only reads from the existing `compare_snapshots` table, refreshed by the existing daily 6am cron.
- No changes to `/api/`, `lib/marketplaceFees.ts`, alert/tracking logic, or any `(protected)/*` behavior — landing-page-only (`app/page.tsx` + `app/components/landing/*`).
- Keep the existing design system: `[data-theme]` dark/light theming via CSS custom properties (`--accent`, `--accent-soft`, `--accent-text`, `--bg-elevated`, `--surface`, `--border`, `--border-strong`, `--text`, `--text-muted`, `--text-dim`), `rounded-2xl` cards, tabular-nums for all prices, gradient-text accent (`linear-gradient(to right, #E24B4A, #E84D1D, #D85A30, #EF9F27, #FAC775)`).
- New motion (rotation, tab crossfade) stays 150–300ms and respects `prefers-reduced-motion`, checked via `window.matchMedia?.('(prefers-reduced-motion: reduce)').matches` — the exact pattern already used in `app/components/landing/Reveal.tsx`.
- No dashes-as-punctuation in any new landing copy (project-wide rule).
- Curated hero rotation set (verified live against `compare_snapshots` on 2026-07-08 via Supabase): `jordan-1-retro-high`, `bape-shark-hoodie`, `carhartt-wip-jacket`, `nike-dunk-low`, `supreme-box-logo-hoodie`. (`levis-501-jeans` was in the original spec's draft list but is swapped for `nike-dunk-low` here — its StockX average was a $792 outlier skewed by what's almost certainly a single rare/collab listing, which reads as noise rather than proof. `nike-dunk-low` has a clean 7-platform spread from $19.86 to $248.90.)
- Every task must leave `npx tsc --noEmit` clean, even before the final integration task — components not yet imported by `page.tsx` are still valid TypeScript, so this is achievable without stubs.

---

### Task 1: Data layer — `getCompareHeroData()` in `lib/compare.ts`

**Files:**
- Modify: `lib/compare.ts`

**Interfaces:**
- Produces: `export interface CompareHeroPlatformPrice { platform: string; avgPriceUsd: number; }`
- Produces: `export interface CompareHeroItem { slug: string; name: string; category: string | null; platforms: CompareHeroPlatformPrice[]; }` (`platforms` sorted ascending by `avgPriceUsd`)
- Produces: `export function buildCompareHeroItems(items: CompareItem[], snapshots: CompareSnapshot[], slugs: string[]): CompareHeroItem[]` — pure, no I/O. Skips any slug missing from `items`, and skips any item with fewer than 2 platforms with a non-null `avg_price_usd` (a single-platform item doesn't demonstrate cross-platform comparison).
- Produces: `export async function getCompareHeroData(slugs: string[]): Promise<CompareHeroItem[]>` — fetches `compare_items` and `compare_snapshots` for the given slugs, calls `buildCompareHeroItems`, returns `[]` on any error (best-effort, matches `getCompareTeasers()`'s existing pattern in this same file).
- Consumes: existing `CompareItem`, `CompareSnapshot` types and `createAdminClient` already in `lib/compare.ts`.

- [ ] **Step 1: Add the two new types and the pure `buildCompareHeroItems` function**

Add after the existing `cheapestSnapshot` function at the bottom of `lib/compare.ts`:

```ts
export interface CompareHeroPlatformPrice {
  platform: string;
  avgPriceUsd: number;
}

export interface CompareHeroItem {
  slug: string;
  name: string;
  category: string | null;
  platforms: CompareHeroPlatformPrice[];
}

/**
 * Groups snapshot rows by slug and sorts each item's platforms cheapest-first.
 * Pure — no I/O — so it can be exercised with sample data without Supabase.
 * Items with fewer than 2 priced platforms are dropped: a single-platform
 * result doesn't demonstrate a cross-platform comparison.
 */
export function buildCompareHeroItems(
  items: CompareItem[],
  snapshots: CompareSnapshot[],
  slugs: string[],
): CompareHeroItem[] {
  const itemBySlug = new Map(items.map((i) => [i.slug, i]));
  const platformsBySlug = new Map<string, CompareHeroPlatformPrice[]>();

  for (const snap of snapshots) {
    if (snap.avg_price_usd === null) continue;
    const list = platformsBySlug.get(snap.slug) ?? [];
    list.push({ platform: snap.platform, avgPriceUsd: snap.avg_price_usd });
    platformsBySlug.set(snap.slug, list);
  }

  const result: CompareHeroItem[] = [];
  for (const slug of slugs) {
    const item = itemBySlug.get(slug);
    const platforms = platformsBySlug.get(slug);
    if (!item || !platforms || platforms.length < 2) continue;
    result.push({
      slug: item.slug,
      name: item.name,
      category: item.category,
      platforms: [...platforms].sort((a, b) => a.avgPriceUsd - b.avgPriceUsd),
    });
  }
  return result;
}

/**
 * Real per-platform prices for a curated set of compare items, for the
 * landing-page hero widget. Reads only the existing daily-cron-refreshed
 * compare_snapshots cache — never triggers a live scrape. Best-effort:
 * returns [] on any error so the hero can never break the landing page.
 */
export async function getCompareHeroData(slugs: string[]): Promise<CompareHeroItem[]> {
  try {
    const admin = createAdminClient();
    const [{ data: items }, { data: snapshots }] = await Promise.all([
      admin.from('compare_items').select('*').in('slug', slugs).eq('enabled', true),
      admin
        .from('compare_snapshots')
        .select('*')
        .in('slug', slugs)
        .not('avg_price_usd', 'is', null),
    ]);
    return buildCompareHeroItems(
      (items ?? []) as CompareItem[],
      (snapshots ?? []) as CompareSnapshot[],
      slugs,
    );
  } catch {
    return [];
  }
}
```

- [ ] **Step 2: Verify `buildCompareHeroItems` with a throwaway script (this repo has no test runner — plain Node script matches the convention already used by `scripts/cogs-per-search.mjs`)**

Create a scratch file (do not commit — delete after verifying) at
`/private/tmp/claude-501/-Users-kevingui-Documents-me-fashion-crawler-crawl4ai/*/scratchpad/verify-hero-grouping.mjs` (or any scratchpad path) with:

```js
// Throwaway verification for buildCompareHeroItems grouping/sort/filter logic.
// Re-implements the function inline since lib/compare.ts is TypeScript and
// this project has no ts-node/tsx dependency (see scripts/cogs-per-search.mjs
// for why plain .mjs scripts duplicate logic rather than importing lib/*.ts).

function buildCompareHeroItems(items, snapshots, slugs) {
  const itemBySlug = new Map(items.map((i) => [i.slug, i]));
  const platformsBySlug = new Map();
  for (const snap of snapshots) {
    if (snap.avg_price_usd === null) continue;
    const list = platformsBySlug.get(snap.slug) ?? [];
    list.push({ platform: snap.platform, avgPriceUsd: snap.avg_price_usd });
    platformsBySlug.set(snap.slug, list);
  }
  const result = [];
  for (const slug of slugs) {
    const item = itemBySlug.get(slug);
    const platforms = platformsBySlug.get(slug);
    if (!item || !platforms || platforms.length < 2) continue;
    result.push({
      slug: item.slug,
      name: item.name,
      category: item.category,
      platforms: [...platforms].sort((a, b) => a.avgPriceUsd - b.avgPriceUsd),
    });
  }
  return result;
}

const items = [
  { slug: 'jordan-1-retro-high', name: 'Jordan 1 Retro High', category: 'sneakers' },
  { slug: 'single-platform-item', name: 'Single Platform Item', category: 'tops' },
  { slug: 'missing-snapshot-item', name: 'No Snapshots', category: 'denim' },
];
const snapshots = [
  { slug: 'jordan-1-retro-high', platform: 'poshmark', avg_price_usd: 84.9 },
  { slug: 'jordan-1-retro-high', platform: 'vestiaire', avg_price_usd: 146.7 },
  { slug: 'jordan-1-retro-high', platform: 'grailed', avg_price_usd: null },
  { slug: 'single-platform-item', platform: 'depop', avg_price_usd: 20 },
];
const out = buildCompareHeroItems(items, snapshots, [
  'jordan-1-retro-high',
  'single-platform-item',
  'missing-snapshot-item',
  'not-in-items-at-all',
]);

console.assert(out.length === 1, `expected 1 item, got ${out.length}`);
console.assert(out[0].slug === 'jordan-1-retro-high', 'wrong slug survived');
console.assert(out[0].platforms.length === 2, `expected 2 priced platforms, got ${out[0].platforms.length}`);
console.assert(out[0].platforms[0].platform === 'poshmark', 'not sorted cheapest-first');
console.assert(out[0].platforms[1].platform === 'vestiaire', 'not sorted cheapest-first');
console.log('All assertions passed:', JSON.stringify(out, null, 2));
```

Run: `node /path/to/verify-hero-grouping.mjs`
Expected output: `All assertions passed:` followed by the single `jordan-1-retro-high` item with 2 sorted platforms. No `console.assert` failures printed to stderr.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add lib/compare.ts
git commit -m "feat: add getCompareHeroData for landing hero widget"
```

---

### Task 2: `CompareHeroWidget.tsx` — the hero's live comparison card

**Files:**
- Create: `app/components/landing/CompareHeroWidget.tsx`

**Interfaces:**
- Consumes: `CompareHeroItem` from `@/lib/compare` (Task 1). `PlatformBadge` from `@/app/components/PlatformBadge` (existing, takes `{ platform: string; className?: string }`).
- Produces: `export default function CompareHeroWidget({ items }: { items: CompareHeroItem[] }): JSX.Element` — a client component. `Hero.tsx` (Task 3) renders this with `id="hero-compare"` on its wrapper so the hero's secondary CTA can anchor to it.

- [ ] **Step 1: Write the component**

Create `app/components/landing/CompareHeroWidget.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import PlatformBadge from '@/app/components/PlatformBadge';
import type { CompareHeroItem } from '@/lib/compare';

const ROTATE_MS = 4500;
const FADE_MS = 200;

function fmtPrice(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

function EmptyState() {
  return (
    <div
      className="w-full rounded-2xl p-5 text-left sm:p-6"
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-strong)',
        boxShadow: '0 20px 50px -20px rgba(226,75,74,0.28), 0 4px 12px rgba(0,0,0,0.06)',
      }}
    >
      <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
        Live price comparison
      </p>
      <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
        Real cross-platform prices are updating. Check back in a moment, or
        see the full grid below.
      </p>
      <a
        href="#compare"
        className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold"
        style={{ color: 'var(--accent)' }}
      >
        Browse compare items ↓
      </a>
    </div>
  );
}

export default function CompareHeroWidget({ items }: { items: CompareHeroItem[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const [paused, setPaused] = useState(false);
  const reducedMotion = useRef(false);

  useEffect(() => {
    reducedMotion.current =
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  }, []);

  useEffect(() => {
    if (items.length < 2 || paused || reducedMotion.current) return;
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setActiveIndex((i) => (i + 1) % items.length);
        setVisible(true);
      }, FADE_MS);
    }, ROTATE_MS);
    return () => clearInterval(interval);
  }, [items.length, paused]);

  if (items.length === 0) return <EmptyState />;

  const active = items[activeIndex];
  const cheapest = active.platforms[0];

  function selectItem(index: number) {
    if (index === activeIndex) return;
    setVisible(false);
    setTimeout(() => {
      setActiveIndex(index);
      setVisible(true);
    }, FADE_MS);
  }

  return (
    <div
      id="hero-compare"
      className="w-full rounded-2xl p-5 text-left sm:p-6"
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-strong)',
        boxShadow: '0 20px 50px -20px rgba(226,75,74,0.28), 0 4px 12px rgba(0,0,0,0.06)',
      }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="mb-4 flex items-center gap-2">
        <span
          className="flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M3 17l6-6 4 4 7-8" /><path d="M14 7h6v6" />
          </svg>
        </span>
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Live price comparison</p>
          <p className="text-[11px]" style={{ color: 'var(--text-dim)' }}>Prices update daily · no login</p>
        </div>
      </div>

      <div style={{ opacity: visible ? 1 : 0, transition: `opacity ${FADE_MS}ms ease-out` }}>
        <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{active.name}</p>

        <div className="mt-3 space-y-1.5">
          {active.platforms.map((p) => {
            const isCheapest = p.platform === cheapest.platform;
            return (
              <div
                key={p.platform}
                className="flex items-center justify-between rounded-lg px-2.5 py-1.5"
                style={{
                  background: isCheapest ? 'var(--accent-soft)' : 'var(--surface)',
                  border: `1px solid ${isCheapest ? 'var(--accent)' : 'var(--border)'}`,
                }}
              >
                <PlatformBadge platform={p.platform} />
                <span
                  className="text-sm font-bold tabular-nums"
                  style={{ color: isCheapest ? 'var(--accent-text)' : 'var(--text)' }}
                >
                  {fmtPrice(p.avgPriceUsd)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {items.map((item, i) => (
          <button
            key={item.slug}
            type="button"
            onClick={() => selectItem(i)}
            className="rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors"
            style={{
              background: i === activeIndex ? 'var(--accent)' : 'var(--surface)',
              color: i === activeIndex ? '#fff' : 'var(--text-muted)',
              border: `1px solid ${i === activeIndex ? 'var(--accent)' : 'var(--border)'}`,
            }}
          >
            {item.name}
          </button>
        ))}
      </div>

      <Link
        href={`/compare/${active.slug}`}
        className="mt-4 flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
        style={{
          background: 'linear-gradient(to right, #E24B4A, #E84D1D, #D85A30, #EF9F27)',
          color: '#fff',
        }}
      >
        See full breakdown
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
        </svg>
      </Link>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. (This component isn't imported anywhere yet — that's expected and fine; an unused file is still valid TypeScript.)

- [ ] **Step 3: Commit**

```bash
git add app/components/landing/CompareHeroWidget.tsx
git commit -m "feat: add CompareHeroWidget for landing hero"
```

---

### Task 3: `Hero.tsx` — swap in the comparison widget, reprioritize copy

**Files:**
- Modify: `app/components/landing/Hero.tsx`

**Interfaces:**
- Consumes: `CompareHeroWidget` (Task 2), `CompareHeroItem` from `@/lib/compare` (Task 1).
- Produces: `export default function Hero({ heroItems }: { heroItems: CompareHeroItem[] })` — note the prop is **required**, not defaulted, because Task 7 always passes it; `tsc --noEmit` stays clean in the interim because nothing calls `<Hero />` without it until Task 7 replaces the current no-prop call in `app/page.tsx` in the same task.

- [ ] **Step 1: Update imports and the `PILLARS` order**

In `app/components/landing/Hero.tsx`, replace the top of the file:

```tsx
import Link from 'next/link';
import CompareHeroWidget from './CompareHeroWidget';
import type { CompareHeroItem } from '@/lib/compare';

const PILLARS = [
  {
    label: 'Cross-platform comp in seconds',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M3 17l6-6 4 4 7-8" /><path d="M14 7h6v6" />
      </svg>
    ),
  },
  {
    label: 'Alerts the moment deals land',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
  },
  {
    label: 'Net flip profit after fees',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="10" /><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" /><path d="M12 18V6" />
      </svg>
    ),
  },
];
```

(This is the same three pillar objects as before, reordered: comp stays first, alerts moves to second, margin/"Net flip profit" moves to third. Only the array order changed — the icon markup is byte-identical to the current file, just relocated.)

- [ ] **Step 2: Update the headline**

Replace:

```tsx
            <h1
              className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl"
              style={{ color: 'var(--text)', lineHeight: 1.05 }}
            >
              Stop guessing.{' '}
              <span
                style={{
                  background: 'linear-gradient(to right, #E24B4A, #E84D1D, #D85A30, #EF9F27, #FAC775)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                Know your margin before you buy.
              </span>
            </h1>
```

with:

```tsx
            <h1
              className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl"
              style={{ color: 'var(--text)', lineHeight: 1.05 }}
            >
              Stop guessing.{' '}
              <span
                style={{
                  background: 'linear-gradient(to right, #E24B4A, #E84D1D, #D85A30, #EF9F27, #FAC775)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                See the real price, across every platform.
              </span>
            </h1>
```

The body paragraph directly below the headline is unchanged — it already reads "Search 9 resale platforms at once, see what the market is really paying, and know your net flip profit after fees before you spend a dollar," which already orders breadth → price truth → margin, consistent with the new priority. Leave it as-is.

- [ ] **Step 3: Update the secondary CTA anchor and label**

Replace:

```tsx
              <a
                href="#compare"
                className="w-full rounded-xl px-6 py-3 text-center text-sm font-semibold transition-colors sm:w-auto"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                }}
              >
                See live prices ↓
              </a>
```

with:

```tsx
              <a
                href="#hero-compare"
                className="w-full rounded-xl px-6 py-3 text-center text-sm font-semibold transition-colors sm:w-auto"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                }}
              >
                See it live ↓
              </a>
```

- [ ] **Step 4: Swap the hero's right column widget and the function signature**

Replace:

```tsx
export default function Hero() {
```

with:

```tsx
export default function Hero({ heroItems }: { heroItems: CompareHeroItem[] }) {
```

Replace:

```tsx
          {/* Right: live calculator */}
          <div className="mx-auto w-full max-w-md lg:mx-0 lg:max-w-none">
            <FlipCalculator />
          </div>
```

with:

```tsx
          {/* Right: live cross-platform comparison */}
          <div className="mx-auto w-full max-w-md lg:mx-0 lg:max-w-none">
            <CompareHeroWidget items={heroItems} />
          </div>
```

Remove the now-unused `import FlipCalculator from './FlipCalculator';` line at the top of the file (it moves to `MarginSection.tsx` in Task 5).

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: an error that `app/page.tsx` calls `<Hero />` without the required `heroItems` prop — this is expected at this point since `page.tsx` isn't updated until Task 7. To keep this task's diff self-contained and still leave the *file* correct, add a temporary default so the tree type-checks between tasks. **Correction (found during implementation):** the form `{ heroItems = [] }: { heroItems: CompareHeroItem[] }` does NOT type-check for a zero-arg `<Hero />` call — TypeScript's explicit type annotation overrides the implicit-optional inference a per-field default would otherwise provide, so `<Hero />` still errors with "Property 'heroItems' is missing." Use this form instead, which does type-check: `export default function Hero({ heroItems = [] }: { heroItems?: CompareHeroItem[] } = {})`. Re-run `npx tsc --noEmit` — expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add app/components/landing/Hero.tsx
git commit -m "feat: lead landing hero with live price comparison, demote margin calc"
```

---

### Task 4: `AlertsAndTrackedSection.tsx` — combine alerts + tracked listings

**Files:**
- Create: `app/components/landing/AlertsAndTrackedSection.tsx`

**Interfaces:**
- Consumes: `MockFrame` (`./MockFrame`, existing, `{ url: string; id?: string; children: ReactNode }`), `PlatformBadge` (`@/app/components/PlatformBadge`, existing).
- Produces: `export default function AlertsAndTrackedSection(): JSX.Element` — no props, self-contained, matches `AlertsMock`/`SavesMock`'s existing no-props pattern. Not yet imported anywhere (expected until Task 7).

- [ ] **Step 1: Write the component**

Create `app/components/landing/AlertsAndTrackedSection.tsx`:

```tsx
'use client';

import { useState } from 'react';
import PlatformBadge from '@/app/components/PlatformBadge';
import MockFrame from './MockFrame';

type Alert = {
  query: string;
  platforms: string[];
  newCount: number;
  lastChecked: string;
};

const ALERTS: Alert[] = [
  { query: 'stussy world tour hoodie', platforms: ['Grailed', 'Depop', 'Vinted'], newCount: 4, lastChecked: '12m ago' },
  { query: 'maison margiela tabi 39', platforms: ['Grailed', 'Vestiaire'], newCount: 1, lastChecked: '1h ago' },
  { query: 'arcteryx beta ar medium', platforms: ['Grailed', 'eBay', 'Poshmark'], newCount: 0, lastChecked: '3h ago' },
];

type Saved = {
  platform: string;
  title: string;
  price: string;
  oldPrice?: string;
  drop?: string;
};

const SAVED: Saved[] = [
  { platform: 'grailed', title: 'Rick Owens DRKSHDW Geobasket', price: '$320' },
  { platform: 'depop', title: 'Carhartt Detroit Jacket — Hamilton Brown', price: '$118', oldPrice: '$140', drop: '16%' },
  { platform: 'vestiaire', title: 'Margiela 5AC Mini Bag', price: '$680' },
  { platform: 'stockx', title: 'Air Jordan 1 Mocha — 10', price: '$268', oldPrice: '$295', drop: '9%' },
];

function AlertsPanel() {
  return (
    <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
      {ALERTS.map((a, i) => (
        <div
          key={i}
          className="flex items-center justify-between gap-4 px-5 py-4"
          style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}
        >
          <div className="flex min-w-0 items-center gap-3">
            {a.newCount > 0 ? (
              <span
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{ background: 'var(--accent)' }}
              >
                {a.newCount}
              </span>
            ) : (
              <span
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
                style={{ background: 'var(--surface)', color: 'var(--text-dim)' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                </svg>
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold" style={{ color: 'var(--text)' }}>{a.query}</p>
              <p className="mt-0.5 truncate text-xs" style={{ color: 'var(--text-muted)' }}>
                {a.platforms.join(' · ')} · checked {a.lastChecked}
              </p>
            </div>
          </div>
          <span
            className="hidden flex-shrink-0 rounded-md px-3 py-1.5 text-xs font-medium sm:inline-block"
            style={{
              background: a.newCount > 0 ? 'var(--accent-soft)' : 'var(--surface)',
              color: a.newCount > 0 ? 'var(--accent-text)' : 'var(--text-muted)',
            }}
          >
            {a.newCount > 0 ? `${a.newCount} new` : 'No new matches'}
          </span>
        </div>
      ))}
      <div
        className="flex items-center justify-between gap-3 px-5 py-3"
        style={{ borderTop: '1px solid var(--border)', background: 'var(--surface)' }}
      >
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Daily auto-check · Pro: 8 alerts · Max: 20 alerts
        </span>
        <button
          type="button"
          tabIndex={-1}
          aria-hidden
          className="rounded-md px-3 py-1.5 text-xs font-semibold text-white"
          style={{ background: 'var(--accent)' }}
        >
          + New alert
        </button>
      </div>
    </div>
  );
}

function TrackedPanel() {
  return (
    <>
      <div
        className="flex items-center gap-3 px-5 py-3"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <span className="rounded-md px-3 py-1.5 text-xs font-medium" style={{ background: 'var(--accent)', color: '#fff' }}>
          All
        </span>
        <span className="ml-auto text-xs" style={{ color: 'var(--text-dim)' }}>{SAVED.length} tracked</span>
      </div>
      <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
        {SAVED.map((s, i) => (
          <div key={i} className="overflow-hidden rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div
              className="relative h-32 w-full"
              style={{ background: 'linear-gradient(135deg, var(--surface-hover), var(--track))' }}
            >
              <div className="absolute left-2 top-2">
                <PlatformBadge platform={s.platform} />
              </div>
              <div className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full" style={{ background: 'var(--bg-elevated)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="#E24B4A" stroke="#E24B4A" strokeWidth="2">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
              </div>
            </div>
            <div className="p-3">
              <p className="line-clamp-2 text-xs" style={{ color: 'var(--text-muted)' }}>{s.title}</p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-lg font-bold tabular-nums" style={{ color: 'var(--text)' }}>{s.price}</span>
                {s.oldPrice && (
                  <span className="text-xs line-through tabular-nums" style={{ color: 'var(--text-dim)' }}>{s.oldPrice}</span>
                )}
                {s.drop && (
                  <span className="ml-auto rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-white" style={{ background: 'var(--success)' }}>
                    ↓ {s.drop}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

const TABS = [
  { key: 'alerts' as const, label: 'Alerts', url: 'thecrawli.com/alerts' },
  { key: 'tracked' as const, label: 'Tracked Listings', url: 'thecrawli.com/saves' },
];

export default function AlertsAndTrackedSection() {
  const [tab, setTab] = useState<'alerts' | 'tracked'>('alerts');
  const [visible, setVisible] = useState(true);
  const active = TABS.find((t) => t.key === tab)!;

  function selectTab(key: 'alerts' | 'tracked') {
    if (key === tab) return;
    setVisible(false);
    setTimeout(() => {
      setTab(key);
      setVisible(true);
    }, 150);
  }

  return (
    <section className="py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--accent-text)' }}>
            Never lose a deal
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl" style={{ color: 'var(--text)' }}>
            Save it. We&apos;ll watch it.
          </h2>
          <p className="mt-3 text-base" style={{ color: 'var(--text-muted)' }}>
            Save a search or save a listing. Crawli rechecks both every day and
            notifies you the moment a new match appears or a price drops.
          </p>
        </div>

        <div className="mx-auto mt-8 flex w-fit gap-1 rounded-full p-1" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => selectTab(t.key)}
              className="rounded-full px-4 py-2 text-sm font-semibold transition-colors"
              style={{
                background: tab === t.key ? 'var(--accent)' : 'transparent',
                color: tab === t.key ? '#fff' : 'var(--text-muted)',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-8" style={{ opacity: visible ? 1 : 0, transition: 'opacity 150ms ease-out' }}>
          <MockFrame url={active.url}>
            {tab === 'alerts' ? <AlertsPanel /> : <TrackedPanel />}
          </MockFrame>
        </div>
      </div>
    </section>
  );
}
```

Note: the alert-cap copy ("Pro: 8 alerts · Max: 20 alerts") is updated from the old `AlertsMock.tsx`'s stale "Pro: 3 alerts · Max: 10 alerts" to match the current real `TIER_CAPS` values in `lib/stripe.ts` (`HANDOFF.md` confirms alerts are `2/8/20` as of 2026-06-29) — this was a pre-existing staleness bug in the file being replaced, fixed here since it's being rewritten anyway.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/components/landing/AlertsAndTrackedSection.tsx
git commit -m "feat: add combined alerts + tracked listings landing section"
```

---

### Task 5: `MarginSection.tsx` — the demoted margin calculator section

**Files:**
- Create: `app/components/landing/MarginSection.tsx`

**Interfaces:**
- Consumes: `FlipCalculator` (`./FlipCalculator`, existing, no props).
- Produces: `export default function MarginSection(): JSX.Element` — no props.

- [ ] **Step 1: Write the component**

Create `app/components/landing/MarginSection.tsx`:

```tsx
import FlipCalculator from './FlipCalculator';

export default function MarginSection() {
  return (
    <section id="margin" className="py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--accent-text)' }}>
            Before you buy
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl" style={{ color: 'var(--text)' }}>
            Found it. Now know what it&apos;s worth to you.
          </h2>
          <p className="mt-3 text-base" style={{ color: 'var(--text-muted)' }}>
            Enter your sourcing price and where you plan to sell. See net profit,
            margin, and ROI after real seller-side fees before you spend a dollar.
          </p>
        </div>

        <div className="mx-auto mt-10 w-full max-w-md">
          <FlipCalculator />
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/components/landing/MarginSection.tsx
git commit -m "feat: add demoted margin calculator landing section"
```

---

### Task 6: Trim `BentoFeatures.tsx` to the 3 supporting cards

**Files:**
- Modify: `app/components/landing/BentoFeatures.tsx`

**Interfaces:**
- Produces: `export default function BentoFeatures(): JSX.Element` — signature unchanged, still no props.

- [ ] **Step 1: Replace the entire file**

The three "hero" cards (margin calculator, alerts, tracked listings) and their preview components (`MarginPreview`, `AlertPreview`, `TrackedPreview`) are removed — that content now has its own full section elsewhere on the page (Hero, `AlertsAndTrackedSection`, `MarginSection`). The `hero`/`preview` props on the internal `Card` component are removed since nothing uses them anymore. Replace the full contents of `app/components/landing/BentoFeatures.tsx` with:

```tsx
import type { ReactNode } from 'react';

interface CardProps {
  title: string;
  body: string;
  icon: ReactNode;
}

function Card({ title, body, icon }: CardProps) {
  return (
    <div
      className="bento-card group flex flex-col rounded-2xl p-6"
      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
    >
      <div
        className="mb-4 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"
        style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
      >
        {icon}
      </div>
      <h3 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>
        {title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        {body}
      </p>
    </div>
  );
}

const stroke = {
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export default function BentoFeatures() {
  return (
    <section
      id="how-it-works"
      className="py-16 sm:py-20"
      style={{
        background:
          'linear-gradient(180deg, transparent, color-mix(in srgb, var(--accent) 4%, transparent), transparent)',
      }}
    >
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl" style={{ color: 'var(--text)' }}>
            Also built in
          </h2>
          <p className="mt-3 text-base" style={{ color: 'var(--text-muted)' }}>
            The details that make sourcing across 9 platforms actually usable.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          <Card
            title="9-platform search"
            body="Grailed, Depop, Poshmark, Mercari, Vinted, ThredUp, Vestiaire Collective, StockX, and eBay searched at once. One query, every major resale platform, in seconds."
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" {...stroke}>
                <circle cx="11" cy="11" r="7" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            }
          />
          <Card
            title="Price intelligence"
            body="See low, average, and high prices across all results. Know what the market actually pays before you decide to source."
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" {...stroke}>
                <path d="M3 17l6-6 4 4 7-8" />
                <path d="M14 7h6v6" />
              </svg>
            }
          />
          <Card
            title="Smart filters"
            body="Filter by platform, size, condition, color, and price range. Narrow to exactly the inventory you source, without leaving the page."
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" {...stroke}>
                <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
              </svg>
            }
          />
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/components/landing/BentoFeatures.tsx
git commit -m "refactor: trim BentoFeatures to supporting features only"
```

---

### Task 7: Wire it all together in `app/page.tsx`, delete retired mocks, full verification

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/components/landing/Hero.tsx:32` (remove the temporary `= []` default added in Task 3, Step 5, now that `page.tsx` always passes `heroItems`)
- Delete: `app/components/landing/AlertsMock.tsx`
- Delete: `app/components/landing/SavesMock.tsx`

**Interfaces:**
- Consumes: `getCompareHeroData` (Task 1), `CompareHeroItem` (Task 1, for the local slug constant's type inference — not directly needed as an import since `getCompareHeroData` returns it), `AlertsAndTrackedSection` (Task 4), `MarginSection` (Task 5), the updated `Hero` (Task 3) and `BentoFeatures` (Task 6).

- [ ] **Step 1: Rewrite `app/page.tsx`**

Replace the full contents of `app/page.tsx`:

```tsx
import { createClient } from '@/lib/supabase/server';
import { getAllCompareItems, getCompareTeasers, getCompareHeroData } from '@/lib/compare';
import { getPriceGuideSlugMap } from '@/lib/blog';
import LandingNav from '@/app/components/landing/LandingNav';
import Hero from '@/app/components/landing/Hero';
import CompareSection from '@/app/components/landing/CompareSection';
import PlatformLogos from '@/app/components/landing/PlatformLogos';
import AlertsAndTrackedSection from '@/app/components/landing/AlertsAndTrackedSection';
import MarginSection from '@/app/components/landing/MarginSection';
import BentoFeatures from '@/app/components/landing/BentoFeatures';
import AboutSection from '@/app/components/landing/AboutSection';
import FounderNote from '@/app/components/landing/FounderNote';
import CTASection from '@/app/components/landing/CTASection';
import FAQ from '@/app/components/landing/FAQ';
import Footer from '@/app/components/landing/Footer';
import StructuredData from '@/app/components/StructuredData';
import Reveal from '@/app/components/landing/Reveal';

// Curated for the hero's rotating comparison widget: category diversity + a
// visible cross-platform price spread, verified live against compare_snapshots
// on 2026-07-08. Keep this list in sync with docs/superpowers/plans/2026-07-08-landing-page-priority-redesign.md
// if items are swapped in/out later.
const HERO_COMPARE_SLUGS = [
  'jordan-1-retro-high',
  'bape-shark-hoodie',
  'carhartt-wip-jacket',
  'nike-dunk-low',
  'supreme-box-logo-hoodie',
];

export default async function LandingPage() {
  const supabase = await createClient();
  const [{ data, error }, items, teasers, heroItems] = await Promise.all([
    supabase.auth.getUser(),
    getAllCompareItems(),
    getCompareTeasers(),
    getCompareHeroData(HERO_COMPARE_SLUGS),
  ]);
  const isAuthenticated = !error && !!data.user;
  const priceGuideSlugs = getPriceGuideSlugMap();

  return (
    <main className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <StructuredData />
      <LandingNav isAuthenticated={isAuthenticated} />
      <Hero heroItems={heroItems} />
      <Reveal><PlatformLogos /></Reveal>
      <Reveal><CompareSection items={items} teasers={teasers} priceGuideSlugs={priceGuideSlugs} /></Reveal>
      <Reveal><AlertsAndTrackedSection /></Reveal>
      <Reveal><MarginSection /></Reveal>
      <Reveal><BentoFeatures /></Reveal>
      <Reveal><AboutSection /></Reveal>
      <Reveal><FounderNote /></Reveal>
      <Reveal><CTASection /></Reveal>
      <Reveal><FAQ /></Reveal>
      <Footer />
    </main>
  );
}
```

- [ ] **Step 2: Remove the temporary default in `Hero.tsx`**

**Note:** Task 3's actual interim signature (corrected during implementation — see that task's Step 5 note) is `{ heroItems = [] }: { heroItems?: CompareHeroItem[] } = {}`, not the originally-planned `{ heroItems = [] }: { heroItems: CompareHeroItem[] }`. Match against the real file content, not this plan's literal old text, if it doesn't line up exactly.

In `app/components/landing/Hero.tsx`, change:

```tsx
export default function Hero({ heroItems = [] }: { heroItems?: CompareHeroItem[] } = {}) {
```

back to the fully required, non-defaulted form (correct now that `page.tsx` always passes the real prop):

```tsx
export default function Hero({ heroItems }: { heroItems: CompareHeroItem[] }) {
```

- [ ] **Step 3: Delete the retired mock components**

```bash
rm app/components/landing/AlertsMock.tsx app/components/landing/SavesMock.tsx
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. (If there's an error about `AlertsMock`/`SavesMock` still being imported somewhere, grep for it: `grep -rn "AlertsMock\|SavesMock" app/` — there should be zero remaining references outside this plan/spec docs.)

- [ ] **Step 5: Start the dev server and verify in a real browser**

Run: `npm run dev` (or `npm run dev:all` if sidecar-dependent features are also being touched — not needed for this landing-page-only change, but harmless to run).

Open `http://localhost:3000` and verify, per this project's standard testing checklist:

- Hero shows the new headline ("See the real price, across every platform.") and the `CompareHeroWidget` renders on the right (desktop) / below the copy (mobile), showing a real item name, ranked per-platform prices with the cheapest highlighted, and rotates automatically every ~4.5s.
- Clicking a chip in the widget jumps directly to that item; hovering the widget pauses rotation; "See full breakdown" links to a working `/compare/[slug]` page.
- The secondary hero CTA ("See it live ↓") scrolls to the widget.
- Section order top-to-bottom matches: Hero → PlatformLogos → CompareSection → AlertsAndTrackedSection (tab toggle between Alerts/Tracked Listings works, content crossfades) → MarginSection (calculator works, same numbers as before) → BentoFeatures (3 cards only) → About → Founder → CTA → FAQ → Footer.
- Toggle dark/light mode (theme switcher in nav) — all new sections keep correct contrast, no unstyled flashes.
- Resize to 375px, 768px, 1280px — no horizontal overflow anywhere on the page, especially the new hero widget and the tabbed alerts/tracked section.
- Open DevTools → Rendering → emulate `prefers-reduced-motion: reduce`, reload — hero widget should stop auto-rotating (chips still work) and the alerts/tracked tab swap should not animate.
- Verify the hero widget's empty/fallback state doesn't break the layout: temporarily change `HERO_COMPARE_SLUGS` in `app/page.tsx` to `['this-slug-does-not-exist']`, reload, confirm the `EmptyState` card renders cleanly (no layout shift, no console error) instead of a blank hero column, then revert `HERO_COMPARE_SLUGS` back to the real list before continuing.
- Check the browser console — no errors.

- [ ] **Step 6: Commit**

```bash
git add app/page.tsx app/components/landing/Hero.tsx
git rm app/components/landing/AlertsMock.tsx app/components/landing/SavesMock.tsx
git commit -m "feat: reorder landing page to lead with price comparison"
```

---

### Task 8: Update `HANDOFF.md`

**Files:**
- Modify: `HANDOFF.md`

Per this project's `CLAUDE.md` rule: "Update docs after every session — the right doc, not just HANDOFF" and "Always update HANDOFF.md 'Current state' and 'Recent changes' sections." No `PLATFORM_STATUS.md`/`PITFALLS.md`/`SYSTEM_DESIGN.md` changes are needed — nothing about scraping, the data layer's shape, or n8n changed, only how already-cached data is displayed and how the landing page's sections are ordered.

- [ ] **Step 1: Replace the "Landing page:" paragraph under "Current state"**

In `HANDOFF.md`, find the paragraph starting `**Landing page:** reseller-first structure (2026-06-30)...` (currently around line 71) and replace it with:

```markdown
**Landing page:** comparison-first structure (2026-07-08). Order: Hero (live `CompareHeroWidget` — rotates real per-platform prices for 5 curated compare items, right column) → PlatformLogos → CompareSection (full item grid) → AlertsAndTrackedSection (combined tabbed pitch, replaces old AlertsMock+SavesMock) → MarginSection (demoted `FlipCalculator`, moved out of the hero) → BentoFeatures (trimmed to 3 supporting cards — 9-platform search, price intelligence, smart filters). `CompareHeroWidget` reads only the existing `compare_snapshots` cache via new `getCompareHeroData()` in `lib/compare.ts` — no new scrape, no new endpoint. Curated hero rotation slugs: `jordan-1-retro-high`, `bape-shark-hoodie`, `carhartt-wip-jacket`, `nike-dunk-low`, `supreme-box-logo-hoodie` (constant in `app/page.tsx`). Design spec: `docs/superpowers/specs/2026-07-08-landing-page-priority-redesign-design.md`.
```

- [ ] **Step 2: Add a bullet under "Recent changes"**

At the top of the "Recent changes" list in `HANDOFF.md` (directly under the `## Recent changes` heading, above the existing `**2026-07-08 — Fixed duplicate Sentry client init...**` entry), add:

```markdown
**2026-07-08 — Landing page reprioritized: comparison leads, margin calculator demoted**
- Hero no longer leads with the margin calculator. New `CompareHeroWidget.tsx` shows real, rotating per-platform prices (reads existing `compare_snapshots` cache, zero new backend cost) in the hero's right column instead. `AlertsMock.tsx` + `SavesMock.tsx` merged into one tabbed `AlertsAndTrackedSection.tsx`. `FlipCalculator` moved into its own new `MarginSection.tsx`, positioned after the alerts/tracked pitch. `BentoFeatures.tsx` trimmed from 6 cards to the 3 supporting ones (its former hero trio now has full sections elsewhere). See `docs/superpowers/specs/2026-07-08-landing-page-priority-redesign-design.md`.
```

- [ ] **Step 3: Commit**

```bash
git add HANDOFF.md
git commit -m "docs: update HANDOFF for landing page reprioritization"
```
