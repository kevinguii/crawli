import { searchPlatform, scrapeListing, ScrapedListing } from '@/lib/firecrawl';
import { SEARCH_PAGE_PLATFORMS, scrapeSearchPageViaSidecar } from '@/lib/scraper';
import { filterListingUrls, parseScrapedListings } from '@/lib/parse';
import { Listing } from '@/lib/types';
import type { FilterState } from '@/lib/filterOptions';
import { detectSizeFromQuery, matchListingSize } from '@/lib/sizeFilter';
import { matchListingColor } from '@/lib/colorFilter';

// Run at most `limit` promises concurrently, returns results in input order.
export async function allSettledWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  limit: number
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = new Array(tasks.length);
  let index = 0;

  async function worker() {
    while (index < tasks.length) {
      const i = index++;
      try {
        results[i] = { status: 'fulfilled', value: await tasks[i]() };
      } catch (reason) {
        results[i] = { status: 'rejected', reason };
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
}

export function matchListingPrice(listing: Listing, filters: FilterState | undefined): boolean {
  if (listing.price === null) return true;
  if (filters?.minPrice != null && listing.price < filters.minPrice) return false;
  if (filters?.maxPrice != null && listing.price > filters.maxPrice) return false;
  return true;
}

export async function searchAndScrape(
  platform: string,
  query: string,
  filters: FilterState | undefined,
  signal?: AbortSignal,
): Promise<Listing[]> {
  if (SEARCH_PAGE_PLATFORMS.has(platform)) {
    const scraped = await scrapeSearchPageViaSidecar(platform, query, 100, 2, signal);
    const listings = parseScrapedListings(scraped, platform, query);
    const sizeKey = filters?.size ?? detectSizeFromQuery(query);
    const sizeFiltered = sizeKey
      ? listings.filter((l) => matchListingSize(l.title, sizeKey, l.size))
      : listings;
    const colorFiltered = sizeFiltered.filter((l) =>
      matchListingColor(l.title, filters?.color, query),
    );
    return colorFiltered.filter((l) => matchListingPrice(l, filters)).slice(0, 10);
  }

  const raw = await searchPlatform(platform, query);

  const filtered = filterListingUrls(raw, platform).filter(
    (r, i, arr) => arr.findIndex((x) => x.url === r.url) === i
  );
  if (filtered.length === 0) return [];

  const toScrape = filtered.slice(0, 10);

  const scrapeSettled = await allSettledWithConcurrency(
    toScrape.map((r) => () => scrapeListing(r.url, platform, signal)),
    2
  );

  const scraped = scrapeSettled
    .filter((s): s is PromiseFulfilledResult<ScrapedListing | null> => s.status === 'fulfilled')
    .map((s) => s.value)
    .filter((s): s is ScrapedListing => s !== null);

  const parsed = parseScrapedListings(scraped, platform, query);
  const sizeKey = filters?.size ?? detectSizeFromQuery(query);
  const sizeFiltered = sizeKey
    ? parsed.filter((l) => matchListingSize(l.title, sizeKey, l.size))
    : parsed;
  const colorFiltered = sizeFiltered.filter((l) =>
    matchListingColor(l.title, filters?.color, query),
  );
  return colorFiltered.filter((l) => matchListingPrice(l, filters));
}

// Runs a full cross-platform search and returns all matched listings.
// Used by the alert runner (Phase 4). The streaming route uses this too
// so both paths share identical fan-out logic.
export async function runSearchJob(
  query: string,
  platforms: string[],
  filters: FilterState | undefined,
  signal?: AbortSignal,
): Promise<Listing[]> {
  const platformConcurrency = Math.max(
    1,
    parseInt(process.env.SEARCH_PLATFORM_CONCURRENCY ?? '3', 10) || 3,
  );

  const settled = await allSettledWithConcurrency(
    platforms.map((platform) => async () => {
      const listings = await searchAndScrape(platform, query, filters, signal);
      return { platform, listings };
    }),
    platformConcurrency,
  );

  const allListings: Listing[] = [];
  for (const result of settled) {
    if (result.status === 'fulfilled') {
      allListings.push(...result.value.listings);
    } else {
      console.error('[searchWorker] platform failed:', result.reason);
    }
  }

  return allListings;
}
