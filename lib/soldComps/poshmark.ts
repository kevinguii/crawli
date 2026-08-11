// Poshmark sold comps.
//
// Two things here are load-bearing and non-obvious (both verified 2026-08-10):
//
// 1. `sort_by=recently_sold` is REQUIRED. Poshmark's default sort returns sales up
//    to 6.6 years old (median 203 days), which makes the median meaningless. The
//    param is genuinely validated server-side — a nonsense sort value returns zero
//    rows, which is how this was proven real rather than silently ignored.
//
// 2. Parse `window.__INITIAL_STATE__`, not the DOM. Sold cards render differently
//    from live ones, so the grid selectors used by the Python extractor find 27 of
//    48 rows. The JSON blob has all 48, plus the timestamps the DOM never shows.
//
// Caveat that must survive into copy: Poshmark hides accepted offers, so
// `price_amount` is the asking price at the moment of sale, not necessarily what
// changed hands. Poshmark medians skew high.

import type { SoldComp } from './types';

const BASE = 'https://poshmark.com';
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/** Pages of 48. Two pages is plenty to clear the sample floor on any query with
 *  real volume, and keeps this to two requests. */
const MAX_PAGES = 2;

function soldSearchUrl(query: string, page: number): string {
  const q = encodeURIComponent(query.trim());
  // max_id is Poshmark's 1-indexed page cursor (verified: page 1 vs 2 share zero ids).
  return `${BASE}/search?query=${q}&type=listings&availability=sold_out&sort_by=recently_sold&max_id=${page}`;
}

interface PoshmarkPost {
  id?: string;
  title?: string;
  created_at?: string;
  first_published_at?: string;
  price_amount?: { val?: string };
  size_obj?: { display?: string };
  condition?: string;
  inventory?: { status?: string; status_changed_at?: string };
}

/**
 * Extract the `window.__INITIAL_STATE__ = {...}` object.
 *
 * Brace-matching rather than a greedy regex: the blob is ~3MB of nested JSON with
 * braces inside string values, so any regex approach mis-terminates.
 */
function extractInitialState(html: string): unknown | null {
  const marker = /window\.__INITIAL_STATE__\s*=\s*/.exec(html);
  if (!marker) return null;
  const start = marker.index + marker[0].length;

  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function postsFromState(state: unknown): PoshmarkPost[] {
  const grid = (state as Record<string, Record<string, Record<string, unknown>>>)?.['$_search']
    ?.gridData?.data;
  return Array.isArray(grid) ? (grid as PoshmarkPost[]) : [];
}

function toComp(p: PoshmarkPost): SoldComp | null {
  // Trust the row's own inventory status rather than the URL filter alone.
  if (p.inventory?.status !== 'sold_out') return null;
  const soldAtRaw = p.inventory?.status_changed_at;
  if (!soldAtRaw || !p.id) return null;

  const price = Number.parseFloat(p.price_amount?.val ?? '');
  if (!Number.isFinite(price) || price <= 0) return null;

  const soldAt = new Date(soldAtRaw);
  if (Number.isNaN(soldAt.getTime())) return null;

  // first_published_at is the listing date; created_at is the draft date and is the
  // fallback when a row omits it (a few percent do).
  const listedRaw = p.first_published_at ?? p.created_at ?? null;
  const listedAt = listedRaw ? new Date(listedRaw) : null;

  return {
    url: `${BASE}/listing/${p.id}`,
    title: p.title ?? null,
    price,
    soldAt,
    listedAt: listedAt && !Number.isNaN(listedAt.getTime()) ? listedAt : null,
    size: p.size_obj?.display ?? null,
    condition: p.condition ?? null,
  };
}

/**
 * Fetch recent Poshmark sales for `query`, newest first.
 *
 * No date filtering here: `recently_sold` already returns newest-first, so the
 * caller windows the results in memory rather than paying for extra requests.
 * Throws on failure so the caller can tell an error from a genuine zero.
 */
export async function fetchPoshmarkSold(query: string): Promise<SoldComp[]> {
  const out: SoldComp[] = [];
  const seen = new Set<string>();

  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await fetch(soldSearchUrl(query, page), {
      headers: { 'User-Agent': UA, Accept: 'text/html' },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      if (page === 1) throw new Error(`poshmark: HTTP ${res.status}`);
      break; // page 1 succeeded — a later page failing just caps the sample
    }

    const state = extractInitialState(await res.text());
    if (!state) {
      if (page === 1) throw new Error('poshmark: __INITIAL_STATE__ not found');
      break;
    }

    const posts = postsFromState(state);
    if (posts.length === 0) break;

    for (const p of posts) {
      const comp = toComp(p);
      if (comp && !seen.has(comp.url)) {
        seen.add(comp.url);
        out.push(comp);
      }
    }
  }

  return out;
}
