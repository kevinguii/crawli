// Grailed sold comps via their Algolia index.
//
// Why not the grid scraper: Grailed's /shop page is filtered to active listings and
// its sold toggle is login-gated: `?sold=true` is read into Next.js query state but
// never switches the index, and clicking the checkbox logged-out fires no request at
// all (verified 2026-08-10). The sold data lives in a separate Algolia index that
// answers to the public search key embedded in every shop page's SSR HTML.
//
// This index is the richest sold source we have: true final `sold_price`, an exact
// `sold_at`, and `created_at` for days-to-sell, with server-side date filtering.

import type { SoldComp } from './types';

const ALGOLIA_APP_ID = 'MNRWEFSS2Q';
const ALGOLIA_HOST = `https://${ALGOLIA_APP_ID.toLowerCase()}-dsn.algolia.net/1/indexes`;
const SOLD_INDEX = 'Listing_sold_production';

// Grailed's public, search-only key as of 2026-08-10. If they rotate it we recover
// automatically via refreshSearchKey() below, so this is a starting point rather
// than a hard dependency.
const DEFAULT_SEARCH_KEY = 'c89dbaddf15fe70e1941a109bf7c2a3d';

const KEY_SOURCE_PAGE = 'https://www.grailed.com/shop?query=jacket';
// The key ships in the SSR HTML under both snake_case and camelCase spellings.
const KEY_RE = /"public_?[sS]earch_?[kK]ey"\s*:\s*"([a-f0-9]{32})"/;

const HITS_PER_PAGE = 100;

let cachedKey: string | null = null;

function currentKey(): string {
  return cachedKey ?? DEFAULT_SEARCH_KEY;
}

/** Re-read the public search key from a Grailed page. Called only after a 403, so
 *  the happy path never pays for this request. */
async function refreshSearchKey(): Promise<string | null> {
  try {
    const res = await fetch(KEY_SOURCE_PAGE, {
      headers: { 'User-Agent': UA, Accept: 'text/html' },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const key = KEY_RE.exec(html)?.[1] ?? null;
    if (key && key !== currentKey()) {
      console.warn('[soldComps/grailed] public search key rotated, picked up new key');
    }
    cachedKey = key;
    return key;
  } catch {
    return null;
  }
}

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

interface AlgoliaHit {
  objectID?: string;
  title?: string;
  sold_price?: number;
  price_i?: number;
  sold_at_i?: number;
  created_at_i?: number;
  size?: string;
  condition?: string;
}

async function queryIndex(query: string, sinceEpoch: number, key: string) {
  return fetch(`${ALGOLIA_HOST}/${SOLD_INDEX}/query`, {
    method: 'POST',
    headers: {
      'X-Algolia-API-Key': key,
      'X-Algolia-Application-Id': ALGOLIA_APP_ID,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      hitsPerPage: HITS_PER_PAGE,
      numericFilters: [`sold_at_i>=${sinceEpoch}`],
    }),
    signal: AbortSignal.timeout(15_000),
  });
}

/**
 * Fetch Grailed sales for `query` that closed on/after `sinceEpoch` (unix seconds).
 * Throws on failure so the caller can distinguish an error from a genuine zero.
 */
export async function fetchGrailedSold(query: string, sinceEpoch: number): Promise<SoldComp[]> {
  let res = await queryIndex(query, sinceEpoch, currentKey());

  // A 403 means the key was rotated or revoked. Re-read it and retry exactly once.
  if (res.status === 403) {
    const fresh = await refreshSearchKey();
    if (!fresh) throw new Error('grailed: search key rejected and could not be refreshed');
    res = await queryIndex(query, sinceEpoch, fresh);
  }

  if (!res.ok) throw new Error(`grailed: algolia HTTP ${res.status}`);

  const body = (await res.json()) as { hits?: AlgoliaHit[] };
  const hits = Array.isArray(body.hits) ? body.hits : [];

  const out: SoldComp[] = [];
  for (const h of hits) {
    // sold_price is the true final. price_i is the last asking price and is only a
    // fallback for the rare hit missing sold_price.
    const price = typeof h.sold_price === 'number' ? h.sold_price : h.price_i;
    if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) continue;
    if (typeof h.sold_at_i !== 'number') continue;
    if (!h.objectID) continue;

    out.push({
      url: `https://www.grailed.com/listings/${h.objectID}`,
      title: h.title ?? null,
      price,
      soldAt: new Date(h.sold_at_i * 1000),
      listedAt: typeof h.created_at_i === 'number' ? new Date(h.created_at_i * 1000) : null,
      size: h.size ?? null,
      condition: h.condition ?? null,
    });
  }
  return out;
}
