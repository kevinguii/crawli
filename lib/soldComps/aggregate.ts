// Turning raw sales into numbers we're willing to put in front of a buy decision.
//
// Three guards, all earned from probe data rather than caution in the abstract:
//
//   Relevance — Poshmark sold, sorted by price, returns a $1,375 median for
//   "nike air jordan 1". Those are bundles and wrong items. Same class of problem
//   filterAuthentic() exists for on the compare pages.
//
//   Window    — a median is meaningless without knowing how far back it reaches.
//   Every figure carries the window that produced it.
//
//   Floor     — a median of three sales is an anecdote. Below MIN_SAMPLE we show
//   nothing rather than something misleading.

import { relevanceTokens, titleMatchesQuery } from '@/lib/parse';
import type { PlatformSoldStats, SoldComp, SoldCompPlatform } from './types';

/** Below this many sales, a platform is omitted entirely. */
export const MIN_SAMPLE = 10;

/** Tried in order. A platform stops at the first window that clears MIN_SAMPLE. */
export const WINDOWS_DAYS = [90, 180, 365] as const;

const DAY_MS = 86_400_000;

function quantile(sortedAsc: number[], q: number): number {
  if (sortedAsc.length === 0) return 0;
  if (sortedAsc.length === 1) return sortedAsc[0];
  const pos = (sortedAsc.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sortedAsc[lo];
  return sortedAsc[lo] + (sortedAsc[hi] - sortedAsc[lo]) * (pos - lo);
}

export function median(values: number[]): number {
  return quantile([...values].sort((a, b) => a - b), 0.5);
}

/** Drop prices outside the Tukey fence. Guards against a bundle listing or a
 *  mispriced outlier dragging the median. */
export function trimPriceOutliers(comps: SoldComp[]): SoldComp[] {
  if (comps.length < 4) return comps;
  const sorted = comps.map((c) => c.price).sort((a, b) => a - b);
  const q1 = quantile(sorted, 0.25);
  const q3 = quantile(sorted, 0.75);
  const iqr = q3 - q1;
  // When the middle 50% share one price the IQR is 0 and a pure Tukey fence lets a
  // 50x bundle listing through untouched. Floor the spread at 10% of the median so
  // there is always a fence, while still keeping prices that cluster near it.
  const med = quantile(sorted, 0.5);
  const spread = Math.max(iqr, med * 0.1);
  if (spread <= 0) return comps;
  const lo = q1 - 1.5 * spread;
  const hi = q3 + 1.5 * spread;
  return comps.filter((c) => c.price >= lo && c.price <= hi);
}

/** Keep only sales whose title actually matches the query, using the same anchoring
 *  rules live search uses. */
export function filterRelevant(comps: SoldComp[], query: string): SoldComp[] {
  const tokens = relevanceTokens(query);
  if (tokens.size === 0) return comps;
  return comps.filter((c) => titleMatchesQuery(c.title, tokens));
}

function withinWindow(comps: SoldComp[], windowDays: number, now: number): SoldComp[] {
  const cutoff = now - windowDays * DAY_MS;
  return comps.filter((c) => c.soldAt.getTime() >= cutoff);
}

function daysToSellOf(comps: SoldComp[]): number | null {
  const spans = comps
    .filter((c) => c.listedAt !== null)
    .map((c) => (c.soldAt.getTime() - (c.listedAt as Date).getTime()) / DAY_MS)
    // A negative or absurd span means the platform's own timestamps disagree; drop it
    // rather than let it skew the median.
    .filter((d) => d >= 0 && d <= 3650);
  // Require a real subset, not one or two rows that happened to carry a list date.
  if (spans.length < Math.min(MIN_SAMPLE, 5)) return null;
  return Math.round(median(spans) * 10) / 10;
}

/**
 * Narrowest window that clears MIN_SAMPLE, or null if none do.
 *
 * `pool` must already be relevance-filtered. For Poshmark the pool is every sale we
 * fetched (newest-first, so windowing in memory is exact). For Grailed the caller
 * re-queries per window, because Algolia ranks by relevance rather than recency —
 * narrowing a wide fetch in memory would undercount recent sales.
 */
export function statsForPool(
  platform: SoldCompPlatform,
  pool: SoldComp[],
  windowDays: number,
  now: number = Date.now(),
): { stats: PlatformSoldStats; comps: SoldComp[] } | null {
  const windowed = trimPriceOutliers(withinWindow(pool, windowDays, now));
  if (windowed.length < MIN_SAMPLE) return null;

  const prices = windowed.map((c) => c.price).sort((a, b) => a - b);
  // Returns the surviving comps alongside the stats so the pooled median is built
  // from exactly the sales the per-platform figures describe.
  return {
    comps: windowed,
    stats: {
      platform,
      medianPrice: Math.round(quantile(prices, 0.5)),
      p25: Math.round(quantile(prices, 0.25)),
      p75: Math.round(quantile(prices, 0.75)),
      n: windowed.length,
      windowDays,
      daysToSell: daysToSellOf(windowed),
    },
  };
}

// There is intentionally no pooled cross-platform median here. See the note on
// SoldCompsResult.platforms in ./types.ts — the two platforms sell materially
// different inventory for the same query, so a combined figure is not meaningful.
