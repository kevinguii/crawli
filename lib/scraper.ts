import type { ScrapedListing } from './firecrawl';

const SIDECAR_URL = process.env.CRAWL4AI_URL ?? 'http://localhost:8000';

function isRetryable(status: number): boolean {
  return status === 429 || status >= 500;
}

// Platforms whose individual listings aren't discoverable via Firecrawl's
// `site:` search. For these, the orchestrator calls `scrapeSearchPageViaSidecar`
// instead of the Firecrawl-then-/scrape flow used for everything else.
// Re-exported from lib/types.ts (NATIVE_PLATFORMS) so client + server share a
// single source of truth.
export { NATIVE_PLATFORMS as SEARCH_PAGE_PLATFORMS } from '@/lib/types';

export async function scrapeSearchPageViaSidecar(
  platform: string,
  query: string,
  limit = 10,
  maxAttempts = 2,
  signal?: AbortSignal,
): Promise<ScrapedListing[]> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await fetch(`${SIDECAR_URL}/scrape-search`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ platform, query, limit }),
        signal: signal
          ? AbortSignal.any([signal, AbortSignal.timeout(60_000)])
          : AbortSignal.timeout(60_000),
      });
      if (!res.ok) {
        if (attempt < maxAttempts - 1 && isRetryable(res.status)) {
          await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
          continue;
        }
        return [];
      }
      const data = (await res.json()) as { results: ScrapedListing[] };
      return data.results ?? [];
    } catch {
      if (attempt < maxAttempts - 1) {
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
        continue;
      }
      return [];
    }
  }
  return [];
}

export interface RefreshPriceResult {
  price: number | null;
  isSold: boolean;
  fetched: boolean;
  tier: 'http' | 'playwright' | 'llm' | null;
  isGone: boolean; // true when HTTP 404 confirms the page is gone (sold or delisted)
}

// Watchlist-refresh-only path. Hits /refresh-price which tries plain HTTP
// first (fast, works for SSR'd platforms incl. ThredUp), falls back to
// Playwright + structured extract, and finally LLM. Returns null only if
// the sidecar HTTP call itself fails. A returned object with fetched=false
// means the sidecar tried but couldn't get a price.
export async function refreshListingViaSidecar(
  url: string,
  platform: string,
  maxAttempts = 2
): Promise<RefreshPriceResult | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await fetch(`${SIDECAR_URL}/refresh-price`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url, platform }),
        signal: AbortSignal.timeout(60_000),
      });
      if (!res.ok) {
        if (attempt < maxAttempts - 1 && isRetryable(res.status)) {
          await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
          continue;
        }
        return null;
      }
      const data = (await res.json()) as {
        price: number | null;
        isSold: boolean;
        fetched: boolean;
        tier: 'http' | 'playwright' | 'llm' | null;
        isGone?: boolean;
      };
      return {
        price: data.price ?? null,
        isSold: !!data.isSold,
        fetched: !!data.fetched,
        tier: data.tier ?? null,
        isGone: !!data.isGone,
      };
    } catch {
      if (attempt < maxAttempts - 1) {
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
        continue;
      }
      return null;
    }
  }
  return null;
}

export async function scrapeViaSidecar(
  url: string,
  platform: string,
  maxAttempts = 3,
  signal?: AbortSignal,
): Promise<ScrapedListing | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await fetch(`${SIDECAR_URL}/scrape`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url, platform }),
        signal: signal
          ? AbortSignal.any([signal, AbortSignal.timeout(60_000)])
          : AbortSignal.timeout(60_000),
      });

      if (!res.ok) {
        if (attempt < maxAttempts - 1 && isRetryable(res.status)) {
          await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
          continue;
        }
        return null;
      }

      const data = (await res.json()) as { result: ScrapedListing | null };
      return data.result;
    } catch {
      if (attempt < maxAttempts - 1) {
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
        continue;
      }
      return null;
    }
  }
  return null;
}
