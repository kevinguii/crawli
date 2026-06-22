import { FirecrawlClient } from '@mendable/firecrawl-js';
import { PLATFORM_DOMAINS } from './types';
import { scrapeViaSidecar } from './scraper';
import { searchPlatformViaSerper } from './serper';
import { searchPlatformViaBrave } from './brave';
import { filterListingUrls } from './parse';

const client = new FirecrawlClient({
  apiKey: process.env.FIRECRAWL_API_KEY,
});

function isRetryable(err: unknown): boolean {
  const status =
    (err as { statusCode?: number })?.statusCode ??
    (err as { status?: number })?.status;
  return status === 429 || (typeof status === 'number' && status >= 500);
}

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt < maxAttempts - 1 && isRetryable(err)) {
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
      } else {
        throw err;
      }
    }
  }
  throw new Error('Max retries exceeded');
}

export interface RawSearchResult {
  url: string;
  title?: string;
  description?: string;
}

async function searchPlatformViaFirecrawl(
  platform: string,
  query: string,
  limit: number,
): Promise<RawSearchResult[]> {
  const domain = PLATFORM_DOMAINS[platform];
  if (!domain) throw new Error(`Unknown platform: ${platform}`);

  const siteQuery = `site:${domain} ${query}`;

  const data = await withRetry(() =>
    client.search(siteQuery, { limit })
  );

  const web = data.web ?? [];
  return web.map((item) => ({
    url: (item as RawSearchResult).url ?? '',
    title: (item as RawSearchResult).title,
    description: (item as RawSearchResult).description,
  }));
}

// Per-platform routing strategy for SEARCH_PROVIDER=hybrid mode.
// Derived from scripts/search_bakeoff_results.csv (20 queries × 8 platforms):
//   - BRAVE_ONLY:    Brave matches or beats Firecrawl on listing-URL count.
//   - HYBRID:        Brave usually wins; fall back to Firecrawl if Brave
//                    returns fewer than BRAVE_HYBRID_THRESHOLD listings.
//   - FIRECRAWL_ONLY: Brave too unreliable (eBay/Mercari); skip the Brave
//                    call entirely to save a round-trip.
type PlatformStrategy = 'brave-only' | 'hybrid' | 'firecrawl-only';

const PLATFORM_STRATEGY: Record<string, PlatformStrategy> = {
  vinted: 'brave-only',
  stockx: 'brave-only',
  poshmark: 'brave-only',
  depop: 'hybrid',
  grailed: 'hybrid',
  vestiaire: 'hybrid',
  mercari: 'firecrawl-only',
  ebay: 'firecrawl-only',
};

function getHybridThreshold(): number {
  const raw = parseInt(process.env.BRAVE_HYBRID_THRESHOLD ?? '5', 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 5;
}

function logSearch(
  platform: string,
  provider: 'firecrawl' | 'brave' | 'serper',
  strategy: 'single' | 'brave-only' | 'firecrawl-only' | 'hybrid-hit' | 'hybrid-fallback' | 'hybrid-error-fallback',
  results: RawSearchResult[],
  extra?: Record<string, string | number>,
): void {
  const listings = filterListingUrls(results, platform).length;
  const extras = extra
    ? ' ' + Object.entries(extra).map(([k, v]) => `${k}=${v}`).join(' ')
    : '';
  console.info(
    `[search] platform=${platform} provider=${provider} strategy=${strategy} urls=${results.length} listings=${listings}${extras}`,
  );
}

async function searchPlatformHybrid(
  platform: string,
  query: string,
  searchLimit: number,
): Promise<RawSearchResult[]> {
  const strategy = PLATFORM_STRATEGY[platform] ?? 'hybrid';

  if (strategy === 'firecrawl-only') {
    const results = await searchPlatformViaFirecrawl(platform, query, searchLimit);
    logSearch(platform, 'firecrawl', 'firecrawl-only', results);
    return results;
  }
  if (strategy === 'brave-only') {
    const results = await searchPlatformViaBrave(platform, query, searchLimit);
    logSearch(platform, 'brave', 'brave-only', results);
    return results;
  }

  // hybrid: try Brave first, fall back to Firecrawl if listing-shape URL
  // count is below the threshold OR Brave errors out (rate limit, outage).
  const threshold = getHybridThreshold();
  try {
    const braveResults = await searchPlatformViaBrave(platform, query, searchLimit);
    const listingCount = filterListingUrls(braveResults, platform).length;
    if (listingCount >= threshold) {
      logSearch(platform, 'brave', 'hybrid-hit', braveResults, { threshold });
      return braveResults;
    }
    const fcResults = await searchPlatformViaFirecrawl(platform, query, searchLimit);
    logSearch(platform, 'firecrawl', 'hybrid-fallback', fcResults, {
      threshold,
      brave_listings: listingCount,
    });
    return fcResults;
  } catch (err) {
    console.warn(
      `[search] brave failed for ${platform}, falling back to firecrawl:`,
      err instanceof Error ? err.message : err,
    );
    const fcResults = await searchPlatformViaFirecrawl(platform, query, searchLimit);
    logSearch(platform, 'firecrawl', 'hybrid-error-fallback', fcResults, { threshold });
    return fcResults;
  }
}

export async function searchPlatform(
  platform: string,
  query: string
): Promise<RawSearchResult[]> {
  const provider = (process.env.SEARCH_PROVIDER ?? 'firecrawl').toLowerCase();
  const searchLimit = 20;

  if (provider === 'serper') {
    const results = await searchPlatformViaSerper(platform, query, searchLimit);
    logSearch(platform, 'serper', 'single', results);
    return results;
  }
  if (provider === 'brave') {
    const results = await searchPlatformViaBrave(platform, query, searchLimit);
    logSearch(platform, 'brave', 'single', results);
    return results;
  }
  if (provider === 'hybrid') {
    return searchPlatformHybrid(platform, query, searchLimit);
  }
  const results = await searchPlatformViaFirecrawl(platform, query, searchLimit);
  logSearch(platform, 'firecrawl', 'single', results);
  return results;
}

// ── Individual listing scraping (delegated to crawl4ai sidecar) ────────────
// Per-platform extraction prompts and the LLM JSON schema now live in the
// Python sidecar (crawl4ai-service/extractors.py).

export interface ScrapedListing {
  url: string;
  title: string | null;
  price: number | null;
  currency: string;
  isSold: boolean;
  condition: string | null;
  imageUrl: string | null;
  size: string | null;
  color: string | null;
}

export async function scrapeListing(
  url: string,
  platform: string,
  signal?: AbortSignal,
): Promise<ScrapedListing | null> {
  return scrapeViaSidecar(url, platform, 3, signal);
}
