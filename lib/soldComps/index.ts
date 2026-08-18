// Public entry point for sold comps.
//
// Runs Grailed and Poshmark in parallel and never lets one platform's failure blank
// the panel: a platform that throws lands in `errors`, a platform with too little
// data is simply absent, and the result is `available: false` only when nothing
// survived. That distinction matters — a silent scrape failure must not be
// indistinguishable from "this item never sells".

import { fetchGrailedSold } from './grailed';
import { fetchPoshmarkSold } from './poshmark';
import { filterRelevant, salesFor, statsForPool, WINDOWS_DAYS } from './aggregate';
import type { PlatformSales, PlatformSoldStats, SoldComp, SoldCompsResult } from './types';

const DAY_SECONDS = 86_400;

/** Widest window we will ever show a sale from. A three-year-old sale is not a
 *  comp, and the per-row date makes staleness visible but does not excuse it. */
const WIDEST_WINDOW = WINDOWS_DAYS[WINDOWS_DAYS.length - 1];

interface PlatformOutcome {
  stats: PlatformSoldStats | null;
  /** The windowed comps behind `stats`, for the pooled median. */
  comps: SoldComp[];
  /**
   * Individual sales for this platform, present whenever at least one relevant
   * sale exists — including when `stats` is null because the sample was under
   * MIN_SAMPLE. When `stats` exists these are exactly the comps behind it, so the
   * rows always add up to the median shown above them.
   */
  sales: PlatformSales | null;
  error: string | null;
}

/**
 * Grailed widens by re-querying: Algolia ranks by relevance, not recency, so a
 * single wide fetch narrowed in memory would undercount recent sales. Most queries
 * clear the floor at 90 days and cost exactly one request.
 */
async function grailedOutcome(query: string, now: number): Promise<PlatformOutcome> {
  try {
    // Holds the last (therefore widest) fetch, so a query that clears no window
    // still has rows to show without costing an extra request.
    let widest: SoldComp[] = [];
    for (const windowDays of WINDOWS_DAYS) {
      const since = Math.floor(now / 1000) - windowDays * DAY_SECONDS;
      const relevant = filterRelevant(await fetchGrailedSold(query, since), query);
      widest = relevant;
      const selected = statsForPool('grailed', relevant, windowDays, now);
      if (selected) {
        return {
          stats: selected.stats,
          comps: selected.comps,
          sales: salesFor('grailed', selected.comps, windowDays, now),
          error: null,
        };
      }
    }
    return { stats: null, comps: [], sales: salesFor('grailed', widest, WIDEST_WINDOW, now), error: null };
  } catch (err) {
    return { stats: null, comps: [], sales: null, error: `grailed: ${(err as Error).message}` };
  }
}

/**
 * Poshmark needs one fetch total: `sort_by=recently_sold` returns newest-first, so
 * every window is an exact in-memory subset of the same pool.
 */
async function poshmarkOutcome(query: string, now: number): Promise<PlatformOutcome> {
  try {
    const relevant = filterRelevant(await fetchPoshmarkSold(query), query);
    for (const windowDays of WINDOWS_DAYS) {
      const selected = statsForPool('poshmark', relevant, windowDays, now);
      if (selected) {
        return {
          stats: selected.stats,
          comps: selected.comps,
          sales: salesFor('poshmark', selected.comps, windowDays, now),
          error: null,
        };
      }
    }
    return { stats: null, comps: [], sales: salesFor('poshmark', relevant, WIDEST_WINDOW, now), error: null };
  } catch (err) {
    return { stats: null, comps: [], sales: null, error: `poshmark: ${(err as Error).message}` };
  }
}

export async function getSoldComps(query: string): Promise<SoldCompsResult> {
  const trimmed = query.trim();
  if (!trimmed) return { available: false, platforms: [], sales: [], errors: [] };

  const now = Date.now();
  // Order matters: Grailed first, so platforms[0] is what the UI seeds the margin
  // calculator from. Grailed's sold_price is the true final sale rather than an
  // asking price, and it is the market this product is positioned against.
  const outcomes = await Promise.all([
    grailedOutcome(trimmed, now),
    poshmarkOutcome(trimmed, now),
  ]);

  const platforms = outcomes
    .map((o) => o.stats)
    .filter((s): s is PlatformSoldStats => s !== null);
  const sales = outcomes
    .map((o) => o.sales)
    .filter((s): s is PlatformSales => s !== null);
  const errors = outcomes.map((o) => o.error).filter((e): e is string => e !== null);

  // Available on rows alone: two real sales with dates and prices are worth
  // showing even though no median can be published off them.
  return { available: platforms.length > 0 || sales.length > 0, platforms, sales, errors };
}

export type {
  SoldCompsResult,
  PlatformSoldStats,
  PlatformSales,
  SoldSale,
  LockedSoldCompsResult,
  LockedPlatformSoldStats,
} from './types';
export { toLockedResult } from './types';
