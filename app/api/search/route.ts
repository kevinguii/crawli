import { NextResponse } from 'next/server';
import { z } from 'zod';
import { searchPlatform, scrapeListing, ScrapedListing } from '@/lib/firecrawl';
import { filterListingUrls, parseScrapedListings } from '@/lib/parse';
import { PLATFORM_DOMAINS, Listing, SearchResponse } from '@/lib/types';

export const dynamic = 'force-dynamic';

const VALID_PLATFORMS = Object.keys(PLATFORM_DOMAINS) as [string, ...string[]];

const requestSchema = z.object({
  query: z.string().min(1).max(200),
  platforms: z.array(z.enum(VALID_PLATFORMS)).min(1),
});

// Run at most `limit` promises concurrently, returns results in input order.
async function allSettledWithConcurrency<T>(
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

async function searchAndScrape(platform: string, query: string): Promise<Listing[]> {
  // 1. Get URLs from Google-indexed search results
  const raw = await searchPlatform(platform, query);

  // 2. Keep only individual listing URLs, drop browse/category pages + deduplicate
  const filtered = filterListingUrls(raw, platform).filter(
    (r, i, arr) => arr.findIndex((x) => x.url === r.url) === i
  );
  if (filtered.length === 0) return [];

  // Cap at 5 URLs per platform — in-house Playwright scraping is sequential and
  // CPU-heavy; scraping all 15 search results would saturate a laptop.
  const toScrape = filtered.slice(0, 5);

  // 4. Scrape each listing page for live price, sold status, image, condition.
  //    Cap at 2 concurrent to avoid timeouts under parallel load across platforms.
  const scrapeSettled = await allSettledWithConcurrency(
    toScrape.map((r) => () => scrapeListing(r.url, platform)),
    2
  );

  const scraped = scrapeSettled
    .filter((s): s is PromiseFulfilledResult<ScrapedListing | null> => s.status === 'fulfilled')
    .map((s) => s.value)
    .filter((s): s is ScrapedListing => s !== null);

  // 4. Map to Listing objects, filtering out sold items
  return parseScrapedListings(scraped, platform);
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { query, platforms } = parsed.data;

  // Search + scrape all platforms in parallel; failures return empty results
  const settled = await Promise.allSettled(
    platforms.map((platform) => searchAndScrape(platform, query))
  );

  const results: SearchResponse['results'] = {};
  for (let i = 0; i < platforms.length; i++) {
    const platform = platforms[i];
    const outcome = settled[i];
    if (outcome.status === 'fulfilled') {
      results[platform] = { listings: outcome.value, count: outcome.value.length };
    } else {
      console.error(`[search] ${platform} failed:`, outcome.reason);
      results[platform] = { listings: [], count: 0 };
    }
  }

  // Compute price stats across all platforms (USD prices only for accuracy)
  const allPrices = Object.values(results)
    .flatMap((r) => r.listings)
    .filter((l) => l.price !== null && l.currency === 'USD')
    .map((l) => l.price as number);

  const priceRange =
    allPrices.length > 0
      ? { min: Math.min(...allPrices), max: Math.max(...allPrices) }
      : null;

  const averagePrice =
    allPrices.length > 0
      ? Math.round(allPrices.reduce((a, b) => a + b, 0) / allPrices.length)
      : null;

  const response: SearchResponse = {
    success: true,
    query,
    results,
    priceRange,
    averagePrice,
  };

  return NextResponse.json(response);
}
