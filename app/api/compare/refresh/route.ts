import { NextResponse } from 'next/server';
import { writeFile } from 'node:fs/promises';
import { createAdminClient } from '@/lib/supabase/admin';
import { scrapeSearchPageViaSidecar } from '@/lib/scraper';
import { parseScrapedListings } from '@/lib/parse';
import { convertToUSD } from '@/lib/currency';
import { allSettledWithConcurrency } from '@/lib/searchWorker';
import { NATIVE_PLATFORMS } from '@/lib/types';
import { submitToIndexNow } from '@/lib/indexnow';
import type { CompareItem } from '@/lib/compare';
import type { Listing } from '@/lib/types';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://thecrawli.com';

// Written at the start of the run and after every slug so the smoke-test's
// auto-heal cron can tell "still refreshing" apart from "actually stuck" —
// see docs/reference/SERVER_REFERENCE.md "Auto-healing cron". Best-effort:
// a failure to write it must never break the refresh itself, and a run that
// crashes mid-batch just lets the file go stale rather than needing explicit
// cleanup.
const HEARTBEAT_PATH = '/run/crawli-compare-refresh.heartbeat';

async function touchHeartbeat(): Promise<void> {
  try {
    await writeFile(HEARTBEAT_PATH, new Date().toISOString());
  } catch {
    // best-effort — see comment above
  }
}

export const dynamic = 'force-dynamic';
// Long timeout: scraping 8 platforms × N slugs can take a while.
export const maxDuration = 300;

const DISPLAY_LIMIT = 6;   // listings stored per platform for page display
const SCRAPE_LIMIT  = 10;  // listings requested from sidecar per platform (kept low: single browser pool)
const CONCURRENCY   = 4;   // platforms scraped in parallel per slug

// A "brand + model" search query (e.g. "cartier tank watch") legitimately
// surfaces listings that share those tokens but aren't the item itself (real
// wallets, dust bags, charms) and, for luxury specifically, listings that
// openly signal they're not the genuine article ("dupe", "inspired", "style").
// Left unfiltered, the page's headline "lowest price" becomes something like a
// $39 "Rolex Datejust" that's actually a framed print ad, which is worse than
// no data: it's a wrong answer on the exact question ("is this a counterfeit")
// these pages exist to help answer. Scoped to this refresh path only. Does
// not touch lib/parse.ts or live search, which has no equivalent problem
// because a searcher sees full listing titles and photos, not a single
// aggregated "floor" number.
// Applies to every luxury category regardless of item type: an openly
// not-authentic listing is never a valid comp. "shufirst" is a manufacturer
// name specific to the replica market, not a brand; "like hermes" etc. catch
// the "[bag] like [brand]" phrasing replica sellers use to surface in brand
// searches without naming the brand as their own.
const REPLICA_SIGNALS = [
  'dupe', 'inspired by', ' inspired', 'replica', '1:1', 'aaa quality',
  'mirror quality', 'reps ', 'not authentic', 'faux ', 'vibe', ' style',
  'lookalike', 'look alike', 'homage', 'super fake', 'superfake', 'shufirst',
  'like hermes', 'like chanel', 'like gucci', 'like cartier', 'like rolex',
  'like dior', 'like prada', 'like celine', 'like fendi', 'like goyard',
  'like ysl', 'like saint laurent', 'like louis vuitton', 'like lv',
];

// Also applies everywhere: a dust bag or a framed print ad is never the
// item, whatever category the item is. Kept separate from REPLICA_SIGNALS
// because these are genuine products, just not the one being priced.
const NON_ITEM_SIGNALS = ['dust bag', 'dustbag', 'print ad'];

const CATEGORY_EXCLUDE_TERMS: Record<string, string[]> = {
  'luxury-handbags': [
    'wallet', 'card holder', 'cardholder', 'charm', 'keychain', 'key chain',
    'ring', 'necklace', 'belt', 'waist bag', 'book', 'coffee table book',
    'jacket', 'hoodie', 't-shirt', 'shirt', 'pants', 'trousers', 'gift box',
  ],
  'luxury-watches': [
    'book', 'coffee table book', 'jacket', 'bomber', 'bracelet', 'necklace',
    'ring', 'gift box', 'strap only', 'band only', 'case only',
  ],
  'luxury-jewelry': ['book', 'gift box', 'watch'],
  'luxury-accessories': ['gift box', 'book'],
};

/** Drops listings that share the query's brand/model tokens but are a
 * different item, an accessory, or an openly-not-authentic replica. Only
 * applied to `category`s registered above (the luxury set). Streetwear
 * items keep their existing behavior unchanged. */
function filterAuthentic(listings: Listing[], category: string | null): Listing[] {
  const categoryTerms = category ? (CATEGORY_EXCLUDE_TERMS[category] ?? []) : [];
  if (categoryTerms.length === 0) return listings;

  const excludeTerms = [...REPLICA_SIGNALS, ...NON_ITEM_SIGNALS, ...categoryTerms];
  return listings.filter((l) => {
    const title = l.title.toLowerCase();
    return !excludeTerms.some((term) => title.includes(term));
  });
}

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
    const rawListings = parseScrapedListings(scraped, platform, item.query);
    const listings = filterAuthentic(rawListings, item.category);
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

  // Optional `{ "slugs": [...] }` body restricts the run to specific items.
  // The weekly cron posts a curated 15-slug body (see SERVER_REFERENCE.md);
  // an empty/omitted body refreshes every enabled item instead — used for
  // backfilling newly-added slugs without re-scraping the whole set
  // (a full run is ~35s/slug and long outlives nginx's 300s proxy_read_timeout).
  const body = (await request.json().catch(() => null)) as { slugs?: unknown } | null;
  const slugFilter =
    Array.isArray(body?.slugs) && body.slugs.every((s): s is string => typeof s === 'string')
      ? body.slugs
      : null;

  let query = admin.from('compare_items').select('*').eq('enabled', true).order('slug');
  if (slugFilter && slugFilter.length > 0) query = query.in('slug', slugFilter);

  const { data: items, error } = await query;

  if (error || !items?.length) {
    return NextResponse.json({ error: error?.message ?? 'no items' }, { status: 500 });
  }

  const results: Awaited<ReturnType<typeof refreshSlug>>[] = [];

  await touchHeartbeat();

  // Refresh slugs one at a time (each fans out 3 parallel platform scrapes)
  for (const item of items as CompareItem[]) {
    const result = await refreshSlug(item, admin);
    results.push(result);
    await touchHeartbeat();
  }

  // Ping IndexNow with the just-refreshed compare pages so Bing recrawls the
  // updated prices promptly. Best-effort: submitToIndexNow never throws.
  await submitToIndexNow(results.map((r) => `${SITE_URL}/compare/${r.slug}`));

  const totalErrors = results.flatMap((r) => r.errors);
  return NextResponse.json({
    ok: true,
    refreshed: results.length,
    errors: totalErrors.length > 0 ? totalErrors : undefined,
    at: new Date().toISOString(),
  });
}
