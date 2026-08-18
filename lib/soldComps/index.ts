// Public entry point for sold comps.
//
// Runs Grailed and Poshmark in parallel and never lets one platform's failure blank
// the panel: a platform that throws lands in `errors`, a platform with too little
// data is simply absent, and the result is `available: false` only when nothing
// survived. That distinction matters — a silent scrape failure must not be
// indistinguishable from "this item never sells".

import { fetchGrailedSold } from './grailed';
import { fetchPoshmarkSold } from './poshmark';
import { filterRelevant, statsForPool, WINDOWS_DAYS } from './aggregate';
import type { PlatformSoldStats, SoldComp, SoldCompsResult } from './types';

const DAY_SECONDS = 86_400;

interface PlatformOutcome {
  stats: PlatformSoldStats | null;
  /** The windowed comps behind `stats`, for the pooled median. */
  comps: SoldComp[];
  error: string | null;
}

/**
 * Grailed widens by re-querying: Algolia ranks by relevance, not recency, so a
 * single wide fetch narrowed in memory would undercount recent sales. Most queries
 * clear the floor at 90 days and cost exactly one request.
 */
async function grailedOutcome(query: string, now: number): Promise<PlatformOutcome> {
  try {
    for (const windowDays of WINDOWS_DAYS) {
      const since = Math.floor(now / 1000) - windowDays * DAY_SECONDS;
      const relevant = filterRelevant(await fetchGrailedSold(query, since), query);
      const selected = statsForPool('grailed', relevant, windowDays, now);
      if (selected) return { stats: selected.stats, comps: selected.comps, error: null };
    }
    return { stats: null, comps: [], error: null };
  } catch (err) {
    return { stats: null, comps: [], error: `grailed: ${(err as Error).message}` };
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
      if (selected) return { stats: selected.stats, comps: selected.comps, error: null };
    }
    return { stats: null, comps: [], error: null };
  } catch (err) {
    return { stats: null, comps: [], error: `poshmark: ${(err as Error).message}` };
  }
}

export async function getSoldComps(query: string): Promise<SoldCompsResult> {
  const trimmed = query.trim();
  if (!trimmed) return { available: false, platforms: [], errors: [] };

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
  const errors = outcomes.map((o) => o.error).filter((e): e is string => e !== null);

  return { available: platforms.length > 0, platforms, errors };
}

export type {
  SoldCompsResult,
  PlatformSoldStats,
  LockedSoldCompsResult,
  LockedPlatformSoldStats,
} from './types';
export { toLockedResult } from './types';
