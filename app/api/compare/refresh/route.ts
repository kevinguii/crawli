import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { scrapeSearchPageViaSidecar } from '@/lib/scraper';
import { parseScrapedListings } from '@/lib/parse';
import { convertToUSD } from '@/lib/currency';
import { allSettledWithConcurrency } from '@/lib/searchWorker';
import { NATIVE_PLATFORMS } from '@/lib/types';
import type { CompareItem } from '@/lib/compare';
import type { Listing } from '@/lib/types';

export const dynamic = 'force-dynamic';
// Long timeout: scraping 8 platforms × N slugs can take a while.
export const maxDuration = 300;

const DISPLAY_LIMIT = 6;   // listings stored per platform for page display
const SCRAPE_LIMIT  = 10;  // listings requested from sidecar per platform (kept low — single browser pool)
const CONCURRENCY   = 4;   // platforms scraped in parallel per slug

function computeStats(listings: Listing[]): {
  minPriceUsd: number | null;
  maxPriceUsd: number | null;
  avgPriceUsd: number | null;
} {
  const usdPrices = listings
    .map((l) => (l.price !== null ? convertToUSD(l.price, l.currency) : null))
    .filter((p): p is number => p !== null);

  if (usdPrices.length === 0) return { minPriceUsd: null, maxPriceUsd: null, avgPriceUsd: null };

  const min = Math.min(...usdPrices);
  const max = Math.max(...usdPrices);
  const avg = usdPrices.reduce((a, b) => a + b, 0) / usdPrices.length;

  return {
    minPriceUsd: Math.round(min * 100) / 100,
    maxPriceUsd: Math.round(max * 100) / 100,
    avgPriceUsd: Math.round(avg * 100) / 100,
  };
}

async function refreshSlug(
  item: CompareItem,
  admin: ReturnType<typeof createAdminClient>,
): Promise<{ slug: string; platforms: number; errors: string[] }> {
  const platforms = Array.from(NATIVE_PLATFORMS);
  const errors: string[] = [];

  const tasks = platforms.map((platform) => async () => {
    const scraped = await scrapeSearchPageViaSidecar(platform, item.query, SCRAPE_LIMIT, 2);
    const listings = parseScrapedListings(scraped, platform, item.query);
    const stats = computeStats(listings);

    // Sort by price asc (cheapest first) for display
    const sorted = [...listings].sort((a, b) => {
      const aUsd = a.price !== null ? (convertToUSD(a.price, a.currency) ?? Infinity) : Infinity;
      const bUsd = b.price !== null ? (convertToUSD(b.price, b.currency) ?? Infinity) : Infinity;
      return aUsd - bUsd;
    });

    const { error } = await admin.from('compare_snapshots').upsert(
      {
        slug: item.slug,
        platform,
        listings: sorted.slice(0, DISPLAY_LIMIT),
        listing_count: listings.length,
        min_price_usd: stats.minPriceUsd,
        max_price_usd: stats.maxPriceUsd,
        avg_price_usd: stats.avgPriceUsd,
        scraped_at: new Date().toISOString(),
      },
      { onConflict: 'slug,platform' },
    );

    if (error) errors.push(`${platform}: ${error.message}`);
    return platform;
  });

  await allSettledWithConcurrency(tasks, CONCURRENCY);
  return { slug: item.slug, platforms: platforms.length, errors };
}

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: items, error } = await admin
    .from('compare_items')
    .select('*')
    .eq('enabled', true)
    .order('slug');

  if (error || !items?.length) {
    return NextResponse.json({ error: error?.message ?? 'no items' }, { status: 500 });
  }

  const results: Awaited<ReturnType<typeof refreshSlug>>[] = [];

  // Refresh slugs one at a time (each fans out 3 parallel platform scrapes)
  for (const item of items as CompareItem[]) {
    const result = await refreshSlug(item, admin);
    results.push(result);
  }

  const totalErrors = results.flatMap((r) => r.errors);
  return NextResponse.json({
    ok: true,
    refreshed: results.length,
    errors: totalErrors.length > 0 ? totalErrors : undefined,
    at: new Date().toISOString(),
  });
}
