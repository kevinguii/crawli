import { searchPlatform, scrapeListing, ScrapedListing } from '@/lib/firecrawl';
import { SEARCH_PAGE_PLATFORMS, scrapeSearchPageViaSidecar } from '@/lib/scraper';
import { filterListingUrls, parseScrapedListings } from '@/lib/parse';
import { primeExpansion } from '@/lib/queryExpansion';
import { Listing } from '@/lib/types';
import type { FilterState } from '@/lib/filterOptions';
import { detectSizeFromQuery, matchListingSize } from '@/lib/sizeFilter';
import { matchListingColor, sortByColorMatch } from '@/lib/colorFilter';
// extractColorFromTitle: only needed by the disabled refetchDepopColors below.

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

// DISABLED 2026-06-21: user decided Depop search speed matters more than
// the color-accuracy gain (see HANDOFF.md). Kept, not deleted: re-enable by
// uncommenting this function, the `extractColorFromTitle` import above, and
// the call site below.
//
// Depop's native search-grid cards carry no real title text at all, the
// title we use is synthesized from the URL slug (see
// `_depop_title_from_slug` in search_page_extractors.py), a much weaker
// signal than the seller's actual listing title. When a color filter is
// active and that slug guess resolved no color, fetch the real per-listing
// page (which has the genuine seller-written title) for a small, bounded
// number of still-unresolved listings and retry. Gated on filters.color so
// this never adds latency to a normal search, only fires for the specific
// case the slug guess already failed. Capped at 8 to keep added latency
// predictable; only updates `color`, leaves title/price/image untouched.
//
// const DEPOP_COLOR_REFETCH_CAP = 8;
//
// async function refetchDepopColors(
//   listings: Listing[],
//   signal?: AbortSignal,
// ): Promise<Listing[]> {
//   const candidates = listings.filter((l) => l.color === null).slice(0, DEPOP_COLOR_REFETCH_CAP);
//   if (candidates.length === 0) return listings;
//
//   const resolvedById = new Map<string, string>();
//   const settled = await allSettledWithConcurrency(
//     candidates.map((l) => async () => {
//       const real = await scrapeListing(l.url, 'depop', signal);
//       const color = real ? (real.color ?? extractColorFromTitle(real.title)) : null;
//       return { id: l.id, color };
//     }),
//     3,
//   );
//   for (const result of settled) {
//     if (result.status === 'fulfilled' && result.value.color) {
//       resolvedById.set(result.value.id, result.value.color);
//     }
//   }
//   if (resolvedById.size === 0) return listings;
//   return listings.map((l) => (resolvedById.has(l.id) ? { ...l, color: resolvedById.get(l.id)! } : l));
// }

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
  // Free-tier depth. Literal rather than TIER_CAPS to keep this module free of
  // the lib/stripe import chain; every real caller passes an explicit cap.
  nativeResultsCap: number = 8,
): Promise<Listing[]> {
  await primeExpansion(query);

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
    const priceFiltered = colorFiltered.filter((l) => matchListingPrice(l, filters));
    // Depop's per-listing color refetch is disabled, speed preferred over
    // the color-accuracy gain (see refetchDepopColors above, kept not deleted).
    return sortByColorMatch(priceFiltered, filters?.color).slice(0, nativeResultsCap);
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
  const priceFiltered = colorFiltered.filter((l) => matchListingPrice(l, filters));
  return sortByColorMatch(priceFiltered, filters?.color);
}

// Runs a full cross-platform search and returns all matched listings.
// Used by the alert runner (Phase 4). The streaming route uses this too
// so both paths share identical fan-out logic.
export async function runSearchJob(
  query: string,
  platforms: string[],
  filters: FilterState | undefined,
  signal?: AbortSignal,
  // Free-tier depth. Literal rather than TIER_CAPS to keep this module free of
  // the lib/stripe import chain; every real caller passes an explicit cap.
  nativeResultsCap: number = 8,
): Promise<Listing[]> {
  const platformConcurrency = Math.max(
    1,
    parseInt(process.env.SEARCH_PLATFORM_CONCURRENCY ?? '3', 10) || 3,
  );

  const settled = await allSettledWithConcurrency(
    platforms.map((platform) => async () => {
      const listings = await searchAndScrape(platform, query, filters, signal, nativeResultsCap);
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
