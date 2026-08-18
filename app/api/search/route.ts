import { NextResponse } from 'next/server';
import { z } from 'zod';
import { PLATFORM_DOMAINS, Listing, SearchStreamEvent } from '@/lib/types';
import type { FilterState } from '@/lib/filterOptions';
import { convertToUSD } from '@/lib/currency';
import { buildCacheKey, getCachedEvents, setCachedEvents } from '@/lib/searchCache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { allSettledWithConcurrency, searchAndScrape } from '@/lib/searchWorker';
import { TIER_CAPS, resolveTier } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

const RESET_PERIOD_MS = 7 * 24 * 60 * 60 * 1000;  // 7 days for weekly reset
const DEFAULT_FREE_CAP = 5;         // fallback if profile column null (pre-migration); mirrors TIER_CAPS.free

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

  // Quota check. pg_cron resets expired periods at midnight UTC daily.
  // This lazy reset is a fallback for users who search before the cron fires.
  const admin = createAdminClient();
  const { data: profile, error: profileErr } = await admin
    .from('profiles')
    .select('subscription_status, subscription_tier, searches_used_this_period, searches_period_start, max_searches_per_period, native_results_cap, search_credits')
    .eq('id', user.id)
    .single();

  if (profileErr || !profile) {
    console.error(`[search] profile load failed for user=${user.id}:`, profileErr);
    return NextResponse.json({ error: 'profile_unavailable' }, { status: 500 });
  }

  const tier = resolveTier(profile.subscription_status, profile.subscription_tier);
  const cap = profile.max_searches_per_period ?? DEFAULT_FREE_CAP;
  // Native results cap derives from the user's tier via TIER_CAPS (single
  // source of truth). The profiles.native_results_cap column is no longer
  // read here so a TIER_CAPS bump auto-applies without a DB backfill.
  const nativeCap = TIER_CAPS[tier].nativeResultsCap;

  let used = profile.searches_used_this_period ?? 0;
  if (profile.searches_period_start) {
    const periodDayStart = new Date(profile.searches_period_start);
    periodDayStart.setUTCHours(0, 0, 0, 0);
    if (Date.now() - periodDayStart.getTime() > RESET_PERIOD_MS) {
      const todayMidnight = new Date();
      todayMidnight.setUTCHours(0, 0, 0, 0);
      const { error: resetErr } = await admin
        .from('profiles')
        .update({
          searches_used_this_period: 0,
          searches_period_start: todayMidnight.toISOString(),
        })
        .eq('id', user.id);
      if (resetErr) console.error(`[search] weekly reset failed for user=${user.id}:`, resetErr);
      else used = 0;
    }
  }

  // DEBT-PROOF OVERAGE: once the tier's included searches are spent, draw down
  // prepaid credits (bought up front) instead of granting free-unlimited search.
  // Only 402 when BOTH the included cap is exhausted AND the credit balance is 0.
  // When a credit is used, we decrement search_credits at charge time instead of
  // incrementing searches_used_this_period (see the charge block below).
  const credits = profile.search_credits ?? 0;
  const usingCredit = used >= cap;
  if (usingCredit && credits <= 0) {
    // Paid tiers are marketed as "Unlimited searches" (see PricingCards.tsx), so
    // the cap is an abuse backstop, not a product limit — nobody real has ever
    // come near it. Never tell a paying user they are out of searches or to
    // "upgrade your plan" (Pro IS the top plan); tell them to reach out, and log
    // it loudly so the ceiling gets raised rather than silently enforced.
    const isPaid = tier !== 'free';
    if (isPaid) {
      console.warn(
        `[quota] PAID user hit the abuse backstop — tier=${tier} used=${used} cap=${cap}. ` +
        `Raise TIER_CAPS.${tier}.maxSearchesPerPeriod or drop the "Unlimited" copy.`,
      );
    }
    return NextResponse.json(
      {
        error: 'quota_exceeded',
        message: isPaid
          ? 'You have hit an unusually high number of searches this week, so we have paused new ones as an anti-abuse check. Get in touch and we will lift it right away.'
          : `You have used all ${cap} searches for this week. Buy a credit pack to keep sourcing, or upgrade your plan.`,
        used,
        cap,
        credits,
        plan: tier,
      },
      { status: 402 },
    );
  }

  const { query, platforms, filters } = parsed.data;
  const encoder = new TextEncoder();
  const cacheKey = buildCacheKey(query, platforms, filters as FilterState | undefined);
  const { signal } = request;

  const stream = new ReadableStream({
    async start(controller) {
      const write = (event: SearchStreamEvent) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'));
        } catch {
          // Client disconnected (ERR_INVALID_STATE). In-flight sidecar work
          // completes naturally — no signal to abort it from here.
        }
      };

      const cached = await getCachedEvents(cacheKey);
      if (cached && cached.length > 0) {
        console.log(`[search-cache] hit key=${cacheKey.slice(0, 12)} events=${cached.length}`);
        for (const event of cached) write(event);
        controller.close();
        return;
      }

      write({ type: 'start', query, platforms, nativeResultsCap: nativeCap });

      const recordedEvents: SearchStreamEvent[] = [{ type: 'start', query, platforms, nativeResultsCap: nativeCap }];
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
            const listings = await searchAndScrape(platform, query, filters as FilterState | undefined, signal, nativeCap);
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
        //
        // KNOWN ABUSE VECTOR (route.ts:303): a user can cancel the browser
        // fetch after the Firecrawl/Brave URL-discovery calls fire but before
        // results stream back. The signal aborts sidecar HTTP calls (scraper.ts)
        // but Firecrawl credits are already burned. Since allListings is empty
        // at the cancel point, this block is skipped → 0 quota charged.
        // Fix: charge immediately after the platform fan-out starts (before
        // results are streamed) so cancel-after-start still costs 1 quota.
        // Deferred: low-frequency enough at launch; add to Phase 3 checklist.
        // Overage: if the included cap was already spent, draw down a prepaid
        // credit instead of incrementing period usage. Otherwise charge the
        // normal included-search slot. (Same read-at-start / write-at-end race
        // as the original increment — acceptable at current volume.)
        const charge = usingCredit
          ? { search_credits: Math.max(0, credits - 1) }
          : { searches_used_this_period: used + 1 };
        void admin
          .from('profiles')
          .update(charge)
          .eq('id', user.id)
          .then(({ error }) => {
            if (error) console.error(`[search] quota charge failed for user=${user.id}:`, error);
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
