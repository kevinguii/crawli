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
 * Cheapest listed price (USD) per slug across all platforms — for landing-page
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
