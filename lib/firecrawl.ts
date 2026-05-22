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

async function searchPlatformHybrid(
  platform: string,
  query: string,
  searchLimit: number,
): Promise<RawSearchResult[]> {
  const strategy = PLATFORM_STRATEGY[platform] ?? 'hybrid';

  if (strategy === 'firecrawl-only') {
    return searchPlatformViaFirecrawl(platform, query, searchLimit);
  }
  if (strategy === 'brave-only') {
    return searchPlatformViaBrave(platform, query, searchLimit);
  }

  // hybrid: try Brave first, fall back to Firecrawl if listing-shape URL
  // count is below the threshold OR Brave errors out (rate limit, outage).
  try {
    const braveResults = await searchPlatformViaBrave(platform, query, searchLimit);
    const listingCount = filterListingUrls(braveResults, platform).length;
    if (listingCount >= getHybridThreshold()) {
      return braveResults;
    }
  } catch (err) {
    console.warn(`[search] brave failed for ${platform}, falling back to firecrawl:`, err instanceof Error ? err.message : err);
  }
  return searchPlatformViaFirecrawl(platform, query, searchLimit);
}

export async function searchPlatform(
  platform: string,
  query: string
): Promise<RawSearchResult[]> {
  const provider = (process.env.SEARCH_PROVIDER ?? 'firecrawl').toLowerCase();
  const searchLimit = 20;

  if (provider === 'serper') {
    return searchPlatformViaSerper(platform, query, searchLimit);
  }
  if (provider === 'brave') {
    return searchPlatformViaBrave(platform, query, searchLimit);
  }
  if (provider === 'hybrid') {
    return searchPlatformHybrid(platform, query, searchLimit);
  }
  return searchPlatformViaFirecrawl(platform, query, searchLimit);
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
}

export async function scrapeListing(
  url: string,
  platform: string
): Promise<ScrapedListing | null> {
  return scrapeViaSidecar(url, platform);
}
