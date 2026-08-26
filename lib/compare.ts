import { createAdminClient } from './supabase/admin';
import { Listing } from './types';

export interface CompareItem {
  slug: string;
  name: string;
  query: string;
  description: string | null;
  category: string | null;
  enabled: boolean;
  created_at: string;
}

export interface CompareSnapshot {
  slug: string;
  platform: string;
  listings: Listing[];
  listing_count: number | null;
  min_price_usd: number | null;
  max_price_usd: number | null;
  avg_price_usd: number | null;
  scraped_at: string;
}

export interface ComparePageData {
  item: CompareItem;
  snapshots: CompareSnapshot[];
}

export async function getAllCompareItems(): Promise<CompareItem[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('compare_items')
    .select('*')
    .eq('enabled', true)
    .order('slug');
  return (data ?? []) as CompareItem[];
}

export async function getComparePageData(slug: string): Promise<ComparePageData | null> {
  const admin = createAdminClient();

  const { data: item, error } = await admin
    .from('compare_items')
    .select('*')
    .eq('slug', slug)
    .eq('enabled', true)
    .single();

  if (error || !item) return null;

  const { data: snapshots } = await admin
    .from('compare_snapshots')
    .select('*')
    .eq('slug', slug);

  return {
    item: item as CompareItem,
    snapshots: ((snapshots ?? []) as CompareSnapshot[]).filter(
      (s) => s.listing_count !== null,
    ),
  };
}

/**
 * Cheapest listed price (USD) per slug across all platforms, for landing-page
 * "from $X" teasers on the compare grid. One query, best-effort: returns an
 * empty map on any error so it can never break the landing page render.
 */
export async function getCompareTeasers(): Promise<Map<string, number>> {
  const teasers = new Map<string, number>();
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from('compare_snapshots')
      .select('slug, min_price_usd')
      .not('min_price_usd', 'is', null);

    for (const row of (data ?? []) as { slug: string; min_price_usd: number | null }[]) {
      if (row.min_price_usd === null) continue;
      const current = teasers.get(row.slug);
      if (current === undefined || row.min_price_usd < current) {
        teasers.set(row.slug, row.min_price_usd);
      }
    }
  } catch {
    // best-effort only
  }
  return teasers;
}

/**
 * Most-recent `scraped_at` (ISO string) per compare slug: the real last-updated
 * time for each /compare/[slug] page, driven by the daily refresh cron. Used by
 * the sitemap for accurate <lastmod>. Best-effort: returns an empty map on any
 * error so the sitemap can never break. Mirrors getCompareTeasers()'s pattern.
 */
export async function getCompareLastUpdated(): Promise<Map<string, string>> {
  const lastUpdated = new Map<string, string>();
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from('compare_snapshots')
      .select('slug, scraped_at')
      .not('scraped_at', 'is', null);

    for (const row of (data ?? []) as { slug: string; scraped_at: string | null }[]) {
      if (!row.scraped_at) continue;
      const current = lastUpdated.get(row.slug);
      if (current === undefined || row.scraped_at > current) {
        lastUpdated.set(row.slug, row.scraped_at);
      }
    }
  } catch {
    // best-effort only
  }
  return lastUpdated;
}

export function hoursAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return 'less than an hour ago';
  if (hours === 1) return '1 hour ago';
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? '1 day ago' : `${days} days ago`;
}

export function cheapestSnapshot(snapshots: CompareSnapshot[]): CompareSnapshot | null {
  const withPrice = snapshots.filter((s) => s.min_price_usd !== null);
  if (withPrice.length === 0) return null;
  return withPrice.reduce((a, b) =>
    (a.min_price_usd ?? Infinity) < (b.min_price_usd ?? Infinity) ? a : b,
  );
}

export interface CompareHeroPlatformPrice {
  platform: string;
  avgPriceUsd: number;
}

export interface CompareHeroItem {
  slug: string;
  name: string;
  category: string | null;
  platforms: CompareHeroPlatformPrice[];
}

/**
 * Groups snapshot rows by slug and sorts each item's platforms cheapest-first.
 * Pure (no I/O), so it can be exercised with sample data without Supabase.
 * Items with fewer than 2 priced platforms are dropped: a single-platform
 * result doesn't demonstrate a cross-platform comparison.
 */
export function buildCompareHeroItems(
  items: CompareItem[],
  snapshots: CompareSnapshot[],
  slugs: string[],
): CompareHeroItem[] {
  const itemBySlug = new Map(items.map((i) => [i.slug, i]));
  const platformsBySlug = new Map<string, CompareHeroPlatformPrice[]>();

  for (const snap of snapshots) {
    if (snap.avg_price_usd === null) continue;
    const list = platformsBySlug.get(snap.slug) ?? [];
    list.push({ platform: snap.platform, avgPriceUsd: snap.avg_price_usd });
    platformsBySlug.set(snap.slug, list);
  }

  const result: CompareHeroItem[] = [];
  for (const slug of slugs) {
    const item = itemBySlug.get(slug);
    const platforms = platformsBySlug.get(slug);
    if (!item || !platforms || platforms.length < 2) continue;
    result.push({
      slug: item.slug,
      name: item.name,
      category: item.category,
      platforms: [...platforms].sort((a, b) => a.avgPriceUsd - b.avgPriceUsd),
    });
  }
  return result;
}

/**
 * Real per-platform prices for a curated set of compare items, for the
 * landing-page hero widget. Reads only the existing daily-cron-refreshed
 * compare_snapshots cache, never triggers a live scrape. Best-effort:
 * returns [] on any error so the hero can never break the landing page.
 */
export async function getCompareHeroData(slugs: string[]): Promise<CompareHeroItem[]> {
  try {
    const admin = createAdminClient();
    const [{ data: items }, { data: snapshots }] = await Promise.all([
      admin.from('compare_items').select('*').in('slug', slugs).eq('enabled', true),
      admin
        .from('compare_snapshots')
        .select('*')
        .in('slug', slugs)
        .not('avg_price_usd', 'is', null),
    ]);
    return buildCompareHeroItems(
      (items ?? []) as CompareItem[],
      (snapshots ?? []) as CompareSnapshot[],
      slugs,
    );
  } catch {
    return [];
  }
}
