import { NextResponse } from 'next/server';
import { z } from 'zod';
import { searchPlatform, scrapeListing, ScrapedListing } from '@/lib/firecrawl';
import { SEARCH_PAGE_PLATFORMS, scrapeSearchPageViaSidecar } from '@/lib/scraper';
import { filterListingUrls, parseScrapedListings } from '@/lib/parse';
import { PLATFORM_DOMAINS, Listing, SearchStreamEvent } from '@/lib/types';

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
  // ThredUp (and any other SEARCH_PAGE_PLATFORMS) skip Firecrawl entirely.
  // Their individual listing URLs aren't surfaced by `site:` search, but the
  // platform's own search page returns a grid with all the listing data we
  // need in one render. Sidecar's /scrape-search handles the fetch + extract.
  if (SEARCH_PAGE_PLATFORMS.has(platform)) {
    const scraped = await scrapeSearchPageViaSidecar(platform, query, 10);
    return parseScrapedListings(scraped, platform, query);
  }

  const raw = await searchPlatform(platform, query);

  const filtered = filterListingUrls(raw, platform).filter(
    (r, i, arr) => arr.findIndex((x) => x.url === r.url) === i
  );
  if (filtered.length === 0) return [];

  const toScrape = filtered.slice(0, 10);

  const scrapeSettled = await allSettledWithConcurrency(
    toScrape.map((r) => () => scrapeListing(r.url, platform)),
    2
  );

  const scraped = scrapeSettled
    .filter((s): s is PromiseFulfilledResult<ScrapedListing | null> => s.status === 'fulfilled')
    .map((s) => s.value)
    .filter((s): s is ScrapedListing => s !== null);

  return parseScrapedListings(scraped, platform, query);
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
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const write = (event: SearchStreamEvent) => {
        controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'));
      };

      write({ type: 'start', query, platforms });

      const allListings: Listing[] = [];

      await Promise.all(
        platforms.map(async (platform) => {
          try {
            const listings = await searchAndScrape(platform, query);
            allListings.push(...listings);
            write({
              type: 'platform_done',
              platform,
              status: 'ok',
              listings,
              count: listings.length,
            });
          } catch (err) {
            console.error(`[search] ${platform} failed:`, err);
            write({
              type: 'platform_done',
              platform,
              status: 'failed',
              listings: [],
              count: 0,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        })
      );

      const usdPrices = allListings
        .filter((l) => l.price !== null && l.currency === 'USD')
        .map((l) => l.price as number);

      const priceRange =
        usdPrices.length > 0
          ? { min: Math.min(...usdPrices), max: Math.max(...usdPrices) }
          : null;

      const averagePrice =
        usdPrices.length > 0
          ? Math.round(usdPrices.reduce((a, b) => a + b, 0) / usdPrices.length)
          : null;

      write({ type: 'final', priceRange, averagePrice });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}
