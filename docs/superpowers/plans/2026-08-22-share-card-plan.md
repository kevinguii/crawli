# Share Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user generate and share a static PNG card from a search results page showing how many listings were found, across how many marketplaces, and the cheapest match's photo and price — no incentive, no referral tracking, no persistence.

**Architecture:** A pure-TypeScript helper picks the cheapest listing and builds a query-string URL. A stateless Next.js route (`next/og`'s `ImageResponse`, same pattern already used by `app/opengraph-image.tsx`) renders that URL's params into a 1080×1350 PNG on the fly — no DB row, nothing to clean up. A client button on the results page fetches that PNG as a blob, previews it in a modal, and hands it to `navigator.share()` (native OS share sheet) with a plain download as the fallback.

**Tech Stack:** Next.js 16 App Router route handlers, `next/og` (`ImageResponse`/Satori, already a dependency via `app/opengraph-image.tsx`), React 19 client components, existing `lib/currency.ts` and `lib/types.ts`.

**Spec:** `docs/superpowers/specs/2026-08-22-share-card-design.md`

## Global Constraints

- **No new Supabase tables, no persistence, no analytics event.** The route is stateless; everything needed to render the card travels in its own URL.
- **No incentive/referral logic of any kind.** This ships the artifact only.
- **Scope is search results only.** Do not touch alerts, alert emails, or `AlertRunner` — that is explicitly deferred future work per the spec.
- **Copy must never use a superlative price claim** ("best price", "lowest price guaranteed") — state the cheapest listing's price as a plain fact. See spec's claim-ledger section.
- **No punctuation dashes (em/en dash) anywhere** — in code comments, commit messages, or any UI copy this plan adds.
- **CSS theming uses the existing `var(--token)` custom properties** (`--bg-elevated`, `--border-strong`, `--text`, `--text-dim`, `--text-muted`, `--surface`, `--accent-text`), never Tailwind's `dark:` variant — this project's dark mode is driven by `[data-theme="dark"]` on `<html>`.
- **This repo has no Jest/Vitest.** Its test convention is a plain script run with `npx tsx scripts/verify-<feature>.mts` that prints `PASS`/`FAIL` per check and a final tally (see `scripts/verify-sold-comps.mts` for the exact shape). Use that convention for every pure-logic piece in this plan. UI/route pieces with no automated harness are verified by hand with the exact steps given in that task — do not invent a fake automated test for them.
- **`npx tsc --noEmit` must be clean** before any commit that touches a `.ts`/`.tsx` file.
- Every currency conversion must go through the existing `convertToUSD()` in `lib/currency.ts` — do not reimplement or hardcode a rate.

---

### Task 1: `lib/shareCard.ts` — pure share-card data logic

**Files:**
- Create: `lib/shareCard.ts`
- Create: `scripts/verify-share-card.mts`

**Interfaces:**
- Consumes: `Listing` from `lib/types.ts` (`{ id, title, price: number | null, currency, condition, size, color, seller, url, image: string | null, platform }`); `convertToUSD(price: number, currency: string): number | null` from `lib/currency.ts`.
- Produces (used by Tasks 2, 4, 5):
  - `SHARE_CARD_WIDTH: number` (`1080`), `SHARE_CARD_HEIGHT: number` (`1350`)
  - `interface ShareCardData { query: string; totalCount: number; platformCount: number; listing: Listing }`
  - `pickShareCardListing(query: string, results: Record<string, { count: number; listings: Listing[] }>): ShareCardData | null`
  - `buildShareCardUrl(data: ShareCardData): string` — returns a relative URL starting `/api/share-card?...`

- [ ] **Step 1: Write the failing verification script**

Create `scripts/verify-share-card.mts`:

```ts
import { pickShareCardListing, buildShareCardUrl, ShareCardData } from '@/lib/shareCard';
import type { Listing } from '@/lib/types';

let failures = 0;
function check(name: string, cond: boolean, extra = '') {
  console.log(`${cond ? '  PASS' : '  FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
  if (!cond) failures++;
}

function listing(over: Partial<Listing>): Listing {
  return {
    id: over.id ?? Math.random().toString(36),
    title: over.title ?? 'Carhartt WIP jacket',
    price: over.price ?? 50,
    currency: over.currency ?? 'USD',
    condition: null,
    size: null,
    color: null,
    seller: null,
    url: over.url ?? 'https://example.com/listing',
    image: over.image ?? 'https://example.com/photo.jpg',
    platform: over.platform ?? 'grailed',
  };
}

console.log('\n=== pickShareCardListing ===');

// Empty results -> null
{
  const result = pickShareCardListing('carhartt wip jacket', {});
  check('empty results returns null', result === null);
}

// All null-price listings -> null (nothing to feature)
{
  const results = {
    grailed: { count: 2, listings: [listing({ price: null }), listing({ price: null })] },
  };
  const result = pickShareCardListing('carhartt wip jacket', results);
  check('all-null-price results returns null', result === null);
}

// Picks the cheapest by effective USD price, across currencies
{
  const usdListing = listing({ id: 'usd-50', price: 50, currency: 'USD', platform: 'grailed' });
  // EUR rate is 1.17 in lib/currency.ts: 40 EUR -> $46.80, cheaper than the $50 USD listing
  const eurListing = listing({ id: 'eur-40', price: 40, currency: 'EUR', platform: 'vinted' });
  const results = {
    grailed: { count: 1, listings: [usdListing] },
    vinted: { count: 1, listings: [eurListing] },
  };
  const result = pickShareCardListing('carhartt wip jacket', results);
  check('cross-currency cheapest picked correctly', result?.listing.id === 'eur-40',
    `got ${result?.listing.id}`);
  check('totalCount sums per-platform count', result?.totalCount === 2, `got ${result?.totalCount}`);
  check('platformCount counts both platforms', result?.platformCount === 2, `got ${result?.platformCount}`);
}

// A platform key present with count 0 is excluded from platformCount
{
  const results = {
    grailed: { count: 1, listings: [listing({ id: 'g1' })] },
    stockx: { count: 0, listings: [] },
  };
  const result = pickShareCardListing('carhartt wip jacket', results);
  check('zero-count platform excluded from platformCount', result?.platformCount === 1,
    `got ${result?.platformCount}`);
  check('zero-count platform still included in totalCount sum', result?.totalCount === 1,
    `got ${result?.totalCount}`);
}

// An unrecognized currency (convertToUSD returns null) is skipped, not crashed on
{
  const badCurrency = listing({ id: 'xxx', price: 1, currency: 'XXX', platform: 'grailed' });
  const goodListing = listing({ id: 'usd-50', price: 50, currency: 'USD', platform: 'grailed' });
  const results = { grailed: { count: 2, listings: [badCurrency, goodListing] } };
  const result = pickShareCardListing('carhartt wip jacket', results);
  check('unconvertible currency is skipped, valid one still picked', result?.listing.id === 'usd-50',
    `got ${result?.listing.id}`);
}

console.log('\n=== buildShareCardUrl ===');

// Round-trips special characters safely through URLSearchParams
{
  const data: ShareCardData = {
    query: 'bape & supreme',
    totalCount: 12,
    platformCount: 3,
    listing: listing({ title: '100% Authentic "Bape" Hoodie #1', price: 45, currency: 'USD', platform: 'depop' }),
  };
  const url = buildShareCardUrl(data);
  check('starts with the route path', url.startsWith('/api/share-card?'), url);
  const parsed = new URL(url, 'http://localhost');
  check('query param round-trips', parsed.searchParams.get('query') === 'bape & supreme');
  check('title param round-trips special chars', parsed.searchParams.get('title') === '100% Authentic "Bape" Hoodie #1');
  check('count param round-trips as string', parsed.searchParams.get('count') === '12');
  check('platforms param round-trips as string', parsed.searchParams.get('platforms') === '3');
  check('price param round-trips', parsed.searchParams.get('price') === '45');
  check('currency param round-trips', parsed.searchParams.get('currency') === 'USD');
  check('platform param round-trips', parsed.searchParams.get('platform') === 'depop');
}

console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILURE(S)`}\n`);
process.exit(failures === 0 ? 0 : 1);
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx tsx scripts/verify-share-card.mts`
Expected: fails immediately with a module-not-found error for `@/lib/shareCard` (the file does not exist yet).

- [ ] **Step 3: Implement `lib/shareCard.ts`**

```ts
import type { Listing } from '@/lib/types';
import { convertToUSD } from '@/lib/currency';

export const SHARE_CARD_WIDTH = 1080;
export const SHARE_CARD_HEIGHT = 1350;

export interface ShareCardData {
  query: string;
  totalCount: number;
  platformCount: number;
  listing: Listing;
}

/** Picks the cheapest listing (by effective USD price) across every platform's
 *  results, plus the total listing count and the number of platforms actually
 *  represented. Returns null when there is nothing to feature. */
export function pickShareCardListing(
  query: string,
  results: Record<string, { count: number; listings: Listing[] }>,
): ShareCardData | null {
  const platformKeys = Object.keys(results);
  const totalCount = platformKeys.reduce((sum, p) => sum + results[p].count, 0);
  const platformCount = platformKeys.filter((p) => results[p].count > 0).length;

  let cheapest: { listing: Listing; effectiveUSD: number } | null = null;
  for (const p of platformKeys) {
    for (const listing of results[p].listings) {
      if (listing.price === null) continue;
      const effectiveUSD = listing.currency === 'USD' ? listing.price : convertToUSD(listing.price, listing.currency);
      if (effectiveUSD === null) continue;
      if (!cheapest || effectiveUSD < cheapest.effectiveUSD) cheapest = { listing, effectiveUSD };
    }
  }

  if (!cheapest || totalCount === 0) return null;
  return { query, totalCount, platformCount, listing: cheapest.listing };
}

/** Builds the stateless GET url for /api/share-card. All card content travels
 *  as query params -- the route has nothing to look up. */
export function buildShareCardUrl(data: ShareCardData): string {
  const params = new URLSearchParams({
    query: data.query,
    count: String(data.totalCount),
    platforms: String(data.platformCount),
    price: data.listing.price !== null ? String(data.listing.price) : '',
    currency: data.listing.currency,
    platform: data.listing.platform,
    title: data.listing.title,
    image: data.listing.image ?? '',
  });
  return `/api/share-card?${params.toString()}`;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx tsx scripts/verify-share-card.mts`
Expected: `ALL PASS`, exit code 0.

- [ ] **Step 5: Type check**

Run: `npx tsc --noEmit`
Expected: clean, no new errors.

- [ ] **Step 6: Commit**

```bash
git add lib/shareCard.ts scripts/verify-share-card.mts
git commit -m "feat: add pure share-card data logic (cheapest listing + URL builder)"
```

---

### Task 2: `app/api/share-card/route.tsx` — image generation route

**Files:**
- Create: `app/api/share-card/route.tsx`

**Interfaces:**
- Consumes: `SHARE_CARD_WIDTH`, `SHARE_CARD_HEIGHT` from `lib/shareCard.ts` (Task 1); `ImageResponse` from `next/og` (already used by `app/opengraph-image.tsx`).
- Produces (used by Task 4): `GET /api/share-card?query=&count=&platforms=&price=&currency=&platform=&title=&image=` → `200` PNG image on success, `400` plain-text response when a required param is missing.

- [ ] **Step 1: Implement the route**

Create `app/api/share-card/route.tsx`:

```tsx
import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { SHARE_CARD_WIDTH, SHARE_CARD_HEIGHT } from '@/lib/shareCard';

// Node runtime (default) -- the app is self-hosted on Node (Hetzner), not edge,
// same as app/opengraph-image.tsx.

const MAX_TITLE_LENGTH = 80;
const MAX_QUERY_LENGTH = 60;
const IMAGE_FETCH_TIMEOUT_MS = 4000;

// Brand gradient, matches app/opengraph-image.tsx.
const GRADIENT = 'linear-gradient(to right, #E24B4A, #E84D1D, #D85A30, #EF9F27, #FAC775)';

function truncate(value: string, max: number): string {
  return value.length > max ? value.slice(0, max - 1).trimEnd() + '…' : value;
}

function formatPrice(rawPrice: string, currency: string): string {
  const amount = Number(rawPrice);
  if (!Number.isFinite(amount)) return '';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `$${amount.toFixed(0)}`;
  }
}

/** Pre-validates the listing photo before handing it to Satori -- a dead or
 *  hotlink-protected CDN url must fall back to a placeholder block instead of
 *  breaking image generation. */
async function resolveImageUrl(rawUrl: string | null): Promise<string | null> {
  if (!rawUrl) return null;
  try {
    const res = await fetch(rawUrl, { signal: AbortSignal.timeout(IMAGE_FETCH_TIMEOUT_MS) });
    return res.ok ? rawUrl : null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const query = params.get('query');
  const count = params.get('count');
  const platforms = params.get('platforms');
  const price = params.get('price');
  const currency = params.get('currency') ?? 'USD';
  const platform = params.get('platform');
  const title = params.get('title');
  const rawImage = params.get('image');

  if (!query || !count || !platforms || !price || !platform || !title) {
    return new Response('Missing required parameter', { status: 400 });
  }

  const imageUrl = await resolveImageUrl(rawImage);
  const priceLabel = formatPrice(price, currency);
  const safeTitle = truncate(title, MAX_TITLE_LENGTH);
  const safeQuery = truncate(query, MAX_QUERY_LENGTH);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: '#111110',
          fontFamily: 'sans-serif',
          padding: '64px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '9999px',
              background: GRADIENT,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontSize: '28px',
              fontWeight: 700,
            }}
          >
            Cr
          </div>
          <div style={{ color: '#ffffff', fontSize: '32px', fontWeight: 700 }}>Crawli</div>
        </div>

        <div
          style={{
            display: 'flex',
            color: '#ffffff',
            fontSize: '52px',
            fontWeight: 700,
            lineHeight: 1.15,
            marginTop: '48px',
            maxWidth: '900px',
          }}
        >
          Found {count} {safeQuery} across {platforms} marketplaces
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            marginTop: '56px',
            borderRadius: '24px',
            overflow: 'hidden',
            background: '#1c1b19',
            flexGrow: 1,
          }}
        >
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- Satori renders this itself, next/image does not apply
            <img src={imageUrl} width={SHARE_CARD_WIDTH - 128} height={600} style={{ objectFit: 'cover' }} />
          ) : (
            <div style={{ display: 'flex', width: '100%', height: '600px', background: '#2a2926' }} />
          )}
          <div style={{ display: 'flex', flexDirection: 'column', padding: '32px' }}>
            <div style={{ display: 'flex', color: '#ffffff', fontSize: '36px', fontWeight: 700 }}>{safeTitle}</div>
            <div style={{ display: 'flex', color: '#b8b6b0', fontSize: '28px', marginTop: '8px' }}>
              {priceLabel} · {platform}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', color: '#77746e', fontSize: '24px', marginTop: '40px' }}>
          via Crawli · thecrawli.com
        </div>
      </div>
    ),
    { width: SHARE_CARD_WIDTH, height: SHARE_CARD_HEIGHT },
  );
}
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Manual verification — happy path**

Start the dev server: `npm run dev`

Run, substituting a real listing photo URL you can find from an actual search result (e.g. open `/search?q=carhartt` in the app, copy an image URL from the network tab or `<img>` src of a listing card):

```bash
curl -s -o /tmp/share-card-test.png -w "%{http_code}\n" \
  "http://localhost:3000/api/share-card?query=carhartt+wip+jacket&count=47&platforms=8&price=45&currency=USD&platform=grailed&title=Carhartt+WIP+Detroit+Jacket&image=<a real listing photo URL>"
```

Expected: prints `200`, and `open /tmp/share-card-test.png` shows a 1080×1350 dark card with the Crawli mark, "Found 47 carhartt wip jacket across 8 marketplaces", the photo, "$45 · grailed", and the "via Crawli · thecrawli.com" footer.

- [ ] **Step 4: Manual verification — missing param**

```bash
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/api/share-card?query=test"
```

Expected: prints `400`.

- [ ] **Step 5: Manual verification — dead image URL falls back to placeholder**

Re-run the Step 3 curl with `image=https://example.com/definitely-not-a-real-image.jpg`.

Expected: still `200`, and the saved PNG shows the plain `#2a2926` placeholder block in place of a photo, not an error or a broken image.

- [ ] **Step 6: Commit**

```bash
git add app/api/share-card/route.tsx
git commit -m "feat: add share-card image generation route"
```

---

### Task 3: `app/components/ShareCardPreviewModal.tsx` — presentational preview modal

**Files:**
- Create: `app/components/ShareCardPreviewModal.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks — a standalone presentational component.
- Produces (used by Task 4):
  ```ts
  interface Props {
    blob: Blob | null;
    sharing: boolean;
    onClose: () => void;
    onShare: () => void;
  }
  export default function ShareCardPreviewModal(props: Props): JSX.Element | null;
  ```
  Renders nothing when `blob` is `null`. Manages its own object-URL lifecycle for the preview `<img>` (creates on `blob` change, revokes on cleanup) so callers never handle `URL.createObjectURL`/`revokeObjectURL` themselves.

- [ ] **Step 1: Implement the component**

Create `app/components/ShareCardPreviewModal.tsx`, following the existing overlay pattern in `app/components/MoveToFolderModal.tsx` (fixed overlay, click-outside-to-close, Escape-to-close, body scroll lock while open):

```tsx
'use client';

import { useEffect, useState } from 'react';

interface Props {
  blob: Blob | null;
  sharing: boolean;
  onClose: () => void;
  onShare: () => void;
}

export default function ShareCardPreviewModal({ blob, sharing, onClose, onShare }: Props) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!blob) {
      setObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(blob);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [blob]);

  useEffect(() => {
    if (!blob) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [blob, onClose]);

  if (!blob || !objectUrl) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0, 0, 0, 0.55)' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-sm flex-col gap-4 rounded-2xl p-5 shadow-xl"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)' }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>
            Share your find
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-lg leading-none"
            style={{ color: 'var(--text-dim)' }}
          >
            ×
          </button>
        </div>

        <img src={objectUrl} alt="Share card preview" className="w-full rounded-xl" />

        <button
          type="button"
          onClick={onShare}
          disabled={sharing}
          className="btn-primary rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
        >
          {sharing ? 'Preparing…' : 'Share'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Manual verification**

This component has no consumer yet (Task 4 wires it up), so verify it in isolation: temporarily render `<ShareCardPreviewModal blob={someTestBlob} sharing={false} onClose={() => {}} onShare={() => {}} />` from a throwaway scratch page (e.g. a temporary route under `app/(protected)/`, deleted before finishing — the same technique HANDOFF.md describes using for the flip-margin calculator's dashboard layout check), passing a real `Blob` (e.g. `await (await fetch('/api/share-card?...')).blob()` with the Task 2 curl params). Confirm in a real browser:
- Modal opens centered with a dimmed backdrop.
- Escape key closes it.
- Clicking the backdrop closes it; clicking the card itself does not.
- Light and dark mode both render correctly (toggle via the app's theme switch).
- Delete the scratch page afterward.

- [ ] **Step 4: Commit**

```bash
git add app/components/ShareCardPreviewModal.tsx
git commit -m "feat: add presentational share-card preview modal"
```

---

### Task 4: `app/components/ShareFindButton.tsx` — button, fetch, and share/download orchestration

**Files:**
- Create: `app/components/ShareFindButton.tsx`

**Interfaces:**
- Consumes: `ShareCardData`, `buildShareCardUrl` from `lib/shareCard.ts` (Task 1); `ShareCardPreviewModal` from `app/components/ShareCardPreviewModal.tsx` (Task 3).
- Produces (used by Task 5):
  ```ts
  interface ShareFindButtonProps { data: ShareCardData | null }
  export default function ShareFindButton(props: ShareFindButtonProps): JSX.Element | null;
  ```
  Renders nothing when `data` is `null` (no results to share).

- [ ] **Step 1: Implement the component**

Create `app/components/ShareFindButton.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { buildShareCardUrl, ShareCardData } from '@/lib/shareCard';
import ShareCardPreviewModal from './ShareCardPreviewModal';

interface Props {
  data: ShareCardData | null;
}

export default function ShareFindButton({ data }: Props) {
  const [loading, setLoading] = useState(false);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!data) return null;

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(buildShareCardUrl(data as ShareCardData));
      if (!res.ok) throw new Error('share-card generation failed');
      setBlob(await res.blob());
    } catch {
      setError("Couldn't generate the image, try again");
    } finally {
      setLoading(false);
    }
  }

  async function handleShare() {
    if (!blob || !data) return;
    setSharing(true);
    try {
      const file = new File([blob], 'crawli-find.png', { type: 'image/png' });
      const nav = navigator as Navigator & { canShare?: (data: { files: File[] }) => boolean };
      if (nav.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          text: `Found ${data.totalCount} ${data.query} across ${data.platformCount} marketplaces via Crawli`,
        });
      } else {
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = 'crawli-find.png';
        a.click();
        URL.revokeObjectURL(objectUrl);
      }
    } catch {
      // User cancelled the native share sheet -- not an error.
    } finally {
      setSharing(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading}
          className="btn-secondary rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {loading ? 'Generating…' : 'Share your find'}
        </button>
        {error && (
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {error}
          </span>
        )}
      </div>
      <ShareCardPreviewModal blob={blob} sharing={sharing} onClose={() => setBlob(null)} onShare={handleShare} />
    </>
  );
}
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Manual verification**

Using the same throwaway scratch page technique as Task 3 (delete afterward), render `<ShareFindButton data={{ query: 'carhartt wip jacket', totalCount: 47, platformCount: 8, listing: { ...a real Listing object... } }} />`. In a real browser:
- Click "Share your find" — button shows "Generating…", then the preview modal opens with the rendered card image.
- On a desktop browser (no Web Share API for files, or none available): clicking "Share" in the modal triggers a file download of `crawli-find.png` and the modal stays open (no crash).
- On an actual mobile browser that supports `navigator.canShare` with files (e.g. iOS Safari, Android Chrome): clicking "Share" opens the native OS share sheet with the image attached.
- Trigger the error path (e.g. temporarily break the fetch URL) and confirm the inline error text appears instead of a silent failure or thrown exception.
- Light and dark mode both render correctly.

- [ ] **Step 4: Commit**

```bash
git add app/components/ShareFindButton.tsx
git commit -m "feat: add share-find button with native share sheet and download fallback"
```

---

### Task 5: Wire into `ResultsDisplay.tsx`

**Files:**
- Modify: `app/components/ResultsDisplay.tsx`

**Interfaces:**
- Consumes: `pickShareCardListing` from `lib/shareCard.ts` (Task 1); `ShareFindButton` from `app/components/ShareFindButton.tsx` (Task 4).
- Produces: nothing further downstream — this is the integration point.

- [ ] **Step 1: Add the import and the memoized share-card data**

In `app/components/ResultsDisplay.tsx`, add to the import block at the top (near the existing `convertToUSD` import):

```ts
import { pickShareCardListing } from '@/lib/shareCard';
import ShareFindButton from './ShareFindButton';
```

Immediately after the existing `cheapestId` `useMemo` (around line 65, right before the `pickPriceSources` call), add a second memo that computes the full share-card payload independently — this deliberately does not reuse `cheapestId` so this task cannot change what `ListingCard`'s `isLowest` prop highlights:

```ts
const shareCardData = useMemo(
  () => pickShareCardListing(data.query, results),
  [data.query, results],
);
```

- [ ] **Step 2: Render the button next to `PriceSummary`**

Find the existing `<PriceSummary ... />` block (around line 124). Immediately after its closing tag, add:

```tsx
<ShareFindButton data={shareCardData} />
```

So the two render together:

```tsx
<PriceSummary
  query={data.query}
  priceRange={dataPriceRange}
  averagePrice={averagePrice}
  totalCount={totalCount}
  lowSource={lowSource ? (PLATFORM_NAMES[lowSource] ?? lowSource) : null}
  highSource={highSource ? (PLATFORM_NAMES[highSource] ?? highSource) : null}
/>
<ShareFindButton data={shareCardData} />
```

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Manual end-to-end verification**

Run `npm run dev:all`, sign in, run a real search (e.g. "carhartt wip jacket") on `/search`. Confirm:
- The "Share your find" button appears below the price summary whenever the search returns at least one listing with a price.
- The button does not render (no crash, nothing shown) for a query that returns zero results.
- Clicking through generates and previews a card showing the correct total count, platform count, the cheapest listing's real photo, price, and platform name, and the Crawli branding footer.
- Sharing/downloading from the preview works as verified in Task 4.
- Light and dark mode both correct.
- No console errors, no failed network requests other than the deliberate error-path test.

- [ ] **Step 5: Update the docs per CLAUDE.md's per-session rule**

Add one bullet under "Recent changes" in `HANDOFF.md` (top of the list), and move the current 5th-from-top entry into `docs/CHANGELOG.md` per the file's own maintenance rule. The new bullet:

```markdown
**2026-08-22 — Share card: generate and share a "found N listings" image from search results**
New stateless `GET /api/share-card` route (`next/og`'s `ImageResponse`, same pattern as `app/opengraph-image.tsx`) renders a 1080×1350 PNG from query params only — no DB row, nothing persisted. `lib/shareCard.ts` picks the cheapest listing (by effective USD price, reusing `convertToUSD`) and builds the route's URL; `ShareFindButton.tsx` + `ShareCardPreviewModal.tsx` render it on the results page next to `PriceSummary`, fetch it as a blob, and hand it to `navigator.share()` (native OS share sheet) with a plain download fallback where Web Share isn't available. No incentive, no referral tracking — scoped to search results only, alerts is deferred future work. Verify with `npx tsx scripts/verify-share-card.mts`. Design: `docs/superpowers/specs/2026-08-22-share-card-design.md`.
```

- [ ] **Step 6: Commit**

```bash
git add app/components/ResultsDisplay.tsx HANDOFF.md docs/CHANGELOG.md
git commit -m "feat: wire share-find button into search results page"
```
