import { NextResponse } from 'next/server';
import { z } from 'zod';
import { searchPlatform, scrapeListing, ScrapedListing } from '@/lib/firecrawl';
import { SEARCH_PAGE_PLATFORMS, scrapeSearchPageViaSidecar } from '@/lib/scraper';
import { filterListingUrls, parseScrapedListings } from '@/lib/parse';
import { PLATFORM_DOMAINS, Listing, SearchStreamEvent } from '@/lib/types';
import type { FilterState } from '@/lib/filterOptions';
import { detectSizeFromQuery, matchListingSize } from '@/lib/sizeFilter';
import { matchListingColor } from '@/lib/colorFilter';
import { convertToUSD } from '@/lib/currency';
import { buildCacheKey, getCachedEvents, setCachedEvents } from '@/lib/searchCache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const FREE_SEARCH_CAP = 10;
const PRO_SEARCH_CAP = 100;
const FREE_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

const VALID_PLATFORMS = Object.keys(PLATFORM_DOMAINS) as [string, ...string[]];

const filtersSchema = z
  .object({
    color: z.string().nullable().optional(),
    category: z.string().nullable().optional(),
    condition: z.string().nullable().optional(),
    size: z.string().nullable().optional(),
    minPrice: z.number().nullable().optional(),
    maxPrice: z.number().nullable().optional(),
  })
  .partial()
  .optional();

const requestSchema = z.object({
  query: z.string().min(1).max(200),
  platforms: z.array(z.enum(VALID_PLATFORMS)).min(1),
  filters: filtersSchema,
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

function matchListingPrice(listing: Listing, filters: FilterState | undefined): boolean {
  if (listing.price === null) return true;
  if (filters?.minPrice != null && listing.price < filters.minPrice) return false;
  if (filters?.maxPrice != null && listing.price > filters.maxPrice) return false;
  return true;
}

async function searchAndScrape(
  platform: string,
  query: string,
  filters: FilterState | undefined,
): Promise<Listing[]> {
  // ThredUp (and any other SEARCH_PAGE_PLATFORMS) skip Firecrawl entirely.
  // Their individual listing URLs aren't surfaced by `site:` search, but the
  // platform's own search page returns a grid with all the listing data we
  // need in one render. Sidecar's /scrape-search handles the fetch + extract.
  if (SEARCH_PAGE_PLATFORMS.has(platform)) {
    // ThredUp returns ~119 products per page in a single JSON-LD blob; the
    // limit just caps in-memory iteration of that array, not network cost.
    // Pull 100 so the post-filter has plenty to find ~10 size-matching items
    // for selective filters (uncommon sizes still get a full page of results).
    const scraped = await scrapeSearchPageViaSidecar(platform, query, 100);
    const listings = parseScrapedListings(scraped, platform, query);
    // Prefer the explicit FilterState.size; otherwise scan the query text for
    // a typed-in size word (handles "nike shoes large" with no panel filter).
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
    toScrape.map((r) => () => scrapeListing(r.url, platform)),
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
  const colorFiltered = sizeFiltered.filter((l) => matchListingColor(l.title, filters?.color, query));
  return colorFiltered.filter((l) => matchListingPrice(l, filters));
}

export async function POST(request: Request) {
  // Auth gate — Crawli is a hosted service for signed-in users. Anonymous
  // requests are rejected so the quota counter has a user to attach to.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized', message: 'Sign in to search' }, { status: 401 });
  }

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

  // Quota check. Pro/past_due users get PRO_SEARCH_CAP per billing period
  // (reset by Stripe's invoice.payment_succeeded webhook). Free users get
  // FREE_SEARCH_CAP per 30-day rolling window (reset lazily here on first
  // search after the window expires).
  const admin = createAdminClient();
  const { data: profile, error: profileErr } = await admin
    .from('profiles')
    .select('subscription_status, searches_used_this_period, searches_period_start')
    .eq('id', user.id)
    .single();

  if (profileErr || !profile) {
    console.error(`[search] profile load failed for user=${user.id}:`, profileErr);
    return NextResponse.json({ error: 'profile_unavailable' }, { status: 500 });
  }

  const status = profile.subscription_status ?? 'free';
  const isPro = status === 'active' || status === 'past_due';
  const cap = isPro ? PRO_SEARCH_CAP : FREE_SEARCH_CAP;

  let used = profile.searches_used_this_period ?? 0;
  if (!isPro) {
    const periodStartMs = profile.searches_period_start
      ? new Date(profile.searches_period_start).getTime()
      : 0;
    if (Date.now() - periodStartMs > FREE_PERIOD_MS) {
      const { error: resetErr } = await admin
        .from('profiles')
        .update({
          searches_used_this_period: 0,
          searches_period_start: new Date().toISOString(),
        })
        .eq('id', user.id);
      if (resetErr) console.error(`[search] free-tier reset failed for user=${user.id}:`, resetErr);
      else used = 0;
    }
  }

  if (used >= cap) {
    return NextResponse.json(
      {
        error: 'quota_exceeded',
        message: isPro
          ? 'You have used all 100 searches for this billing period.'
          : 'You have used all 10 free searches this month. Upgrade to Crawli Pro for 100/month.',
        used,
        cap,
        plan: isPro ? 'pro' : 'free',
      },
      { status: 402 },
    );
  }

  const { query, platforms, filters } = parsed.data;
  const encoder = new TextEncoder();
  const cacheKey = buildCacheKey(query, platforms, filters as FilterState | undefined);

  const stream = new ReadableStream({
    async start(controller) {
      const write = (event: SearchStreamEvent) => {
        controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'));
      };

      const cached = await getCachedEvents(cacheKey);
      if (cached && cached.length > 0) {
        console.log(`[search-cache] hit key=${cacheKey.slice(0, 12)} events=${cached.length}`);
        for (const event of cached) write(event);
        controller.close();
        return;
      }

      write({ type: 'start', query, platforms });

      const recordedEvents: SearchStreamEvent[] = [{ type: 'start', query, platforms }];
      const allListings: Listing[] = [];

      // A5: cap how many platforms enter the scrape phase at once. The
      // sidecar has its own semaphore (SIDECAR_MAX_CONCURRENT_RENDERS) so
      // this is the across-platform layer — it stops 8 selected platforms
      // × 2 per-platform scrapes = 16 concurrent Chromium renders, which
      // killed the Playwright driver on small machines. Overflow platforms
      // queue here and start as the first batch drains.
      //
      // Firecrawl plan tier is informational only — free=2, paid=5
      // concurrent search calls. Raising this above your plan won't error;
      // Firecrawl will just queue search calls on its end.
      const platformConcurrency = Math.max(
        1,
        parseInt(process.env.SEARCH_PLATFORM_CONCURRENCY ?? '3', 10) || 3,
      );

      const writeAndRecord = (event: SearchStreamEvent) => {
        write(event);
        recordedEvents.push(event);
      };

      await allSettledWithConcurrency(
        platforms.map((platform) => async () => {
          try {
            const listings = await searchAndScrape(platform, query, filters as FilterState | undefined);
            allListings.push(...listings);
            writeAndRecord({
              type: 'platform_done',
              platform,
              status: 'ok',
              listings,
              count: listings.length,
            });
          } catch (err) {
            console.error(`[search] ${platform} failed:`, err);
            writeAndRecord({
              type: 'platform_done',
              platform,
              status: 'failed',
              listings: [],
              count: 0,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }),
        platformConcurrency,
      );

      const usdPrices = allListings
        .filter((l) => l.price !== null)
        .map((l) => l.currency === 'USD' ? l.price as number : convertToUSD(l.price as number, l.currency))
        .filter((p): p is number => p !== null);

      const priceRange =
        usdPrices.length > 0
          ? { min: Math.min(...usdPrices), max: Math.max(...usdPrices) }
          : null;

      const averagePrice =
        usdPrices.length > 0
          ? Math.round(usdPrices.reduce((a, b) => a + b, 0) / usdPrices.length)
          : null;

      const finalEvent: SearchStreamEvent = { type: 'final', priceRange, averagePrice };
      write(finalEvent);
      recordedEvents.push(finalEvent);
      controller.close();

      // Cache only successful searches that returned at least one listing.
      // Skips empty/all-failed results so transient failures retry next time.
      if (allListings.length > 0) {
        void setCachedEvents(cacheKey, recordedEvents);
        // Charge the quota only when the search actually produced results.
        // Mirrors the cache-write rule: transient all-failure responses don't
        // burn a search slot. Cache hits never reach this code path (early
        // return above), so they're also free to the user — correct UX since
        // they cost us nothing.
        void admin
          .from('profiles')
          .update({ searches_used_this_period: used + 1 })
          .eq('id', user.id)
          .then(({ error }) => {
            if (error) console.error(`[search] quota increment failed for user=${user.id}:`, error);
          });
      }
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
