// Sold comps: completed-sale data, as opposed to the live asking prices the rest
// of the app deals in. Rationale: docs/planning/COMPETITIVE_POSITIONING.md §5 Step 1.

/** Platforms that expose usable sold data. Deliberately not PlatformKey: Mercari,
 *  ThredUp, eBay and StockX are out of scope and must not be passed here. */
export type SoldCompPlatform = 'grailed' | 'poshmark';

export const SOLD_COMP_PLATFORMS: SoldCompPlatform[] = ['grailed', 'poshmark'];

/** One completed sale, normalized across platforms. */
export interface SoldComp {
  url: string;
  title: string | null;
  /** Final sale price in USD. Grailed: true sold_price. Poshmark: the asking
   *  price at time of sale, accepted offers are hidden, so this skews high. */
  price: number;
  /** When the item sold. */
  soldAt: Date;
  /** When the item was first listed. Null when the platform omits it, which makes
   *  this row unusable for days-to-sell but still fine for the price median. */
  listedAt: Date | null;
  size: string | null;
  condition: string | null;
}

/**
 * One completed sale as it crosses the wire.
 *
 * Distinct from SoldComp: this shape is what /api/sold-comps returns and what
 * sold_comps_cache stores, so `soldAt` is an ISO string rather than a Date. It
 * makes two JSON round trips (HTTP response, jsonb payload) and a Date survives
 * neither.
 */
export interface SoldSale {
  url: string;
  title: string | null;
  price: number;
  /** ISO-8601 timestamp of the sale. Never null: unlike listedAt, both platforms
   *  always carry a sale date, and windowing already depends on it. */
  soldAt: string;
  size: string | null;
  condition: string | null;
}

/**
 * The individual sales behind one platform, with NO sample floor.
 *
 * This is deliberately not gated on MIN_SAMPLE the way `PlatformSoldStats` is.
 * The floor exists to stop us asserting "this sells for $X" off three data points;
 * it has no bearing on showing the three sales themselves, which are evidence the
 * reader can judge rather than a claim we are making. A query with 2 relevant
 * sales gets rows and no median.
 */
export interface PlatformSales {
  platform: SoldCompPlatform;
  /** The window these rows were taken from: 90, 180 or 365. */
  windowDays: number;
  /** Relevant sales in that window. Can exceed `sales.length`, which is capped. */
  total: number;
  /** Newest first, capped at SALES_ROW_CAP. */
  sales: SoldSale[];
}

/** Aggregated stats for one platform. Only produced when n >= MIN_SAMPLE. */
export interface PlatformSoldStats {
  platform: SoldCompPlatform;
  medianPrice: number;
  p25: number;
  p75: number;
  /** Number of sales behind these figures, after relevance filtering and outlier trim. */
  n: number;
  /** The window these sales came from: 90, 180 or 365. Always surfaced in the UI:
   *  a median means nothing without knowing how far back it reaches. */
  windowDays: number;
  /** Median days from listing to sale, or null when too few rows carry a list date. */
  daysToSell: number | null;
}

export interface SoldCompsResult {
  /** False only when there is nothing at all to show: no aggregate AND no rows. */
  available: boolean;
  /**
   * Ordered by SOLD_COMP_PLATFORMS, so `platforms[0]` is Grailed whenever it
   * qualified. The UI seeds the margin calculator from it.
   *
   * There is deliberately NO pooled cross-platform median. Verified 2026-08-10:
   * for "nike air jordan 1", Poshmark's sold inventory is mostly youth sizes
   * ($8-30) while Grailed's is adult pairs ($30-125). A pooled figure ($55)
   * describes neither market and would anchor a buy decision on a fiction.
   * Report per platform or not at all.
   */
  platforms: PlatformSoldStats[];
  /**
   * The individual sales, per platform, with no sample floor applied, so a query
   * too thin for a median still has something honest to show. Ordered like
   * `platforms`. A platform can appear here and not in `platforms` (fewer than
   * MIN_SAMPLE sales), and one that appears in both lists is showing the very
   * rows its median was computed from.
   *
   * Absent on payloads written to sold_comps_cache before this field existed:
   * normalized to `[]` on the cache-hit path in /api/sold-comps.
   */
  sales: PlatformSales[];
  /** Platforms that errored rather than simply having too little data. Surfaced so
   *  a silent scrape failure can't masquerade as "no sales". */
  errors: string[];
  /** Absent or false on the full payload. See LockedSoldCompsResult. */
  locked?: false;
}

/**
 * What a free user gets: proof the data exists, without the data.
 *
 * Sample size and window are deliberately retained: "Grailed, 34 sales, last 90
 * days" makes the lock read as a withheld answer rather than a broken feature,
 * and neither figure is the thing being sold. Every computed price (median, p25,
 * p75) and daysToSell is omitted server-side, so no amount of devtools recovers
 * them.
 *
 * The individual sale rows (`SoldCompsResult.sales`) are omitted outright rather
 * than stripped field by field: every column on them (price, date, title, size)
 * is the product. There is no locked equivalent of a sale row.
 */
export interface LockedPlatformSoldStats {
  platform: SoldCompPlatform;
  n: number;
  windowDays: number;
}

export interface LockedSoldCompsResult {
  locked: true;
  available: boolean;
  platforms: LockedPlatformSoldStats[];
  errors: string[];
}

/**
 * Strip a full result down to the free-tier view.
 *
 * The lock is shown for every platform that has ANY sale, not just the ones that
 * cleared MIN_SAMPLE: a query with 3 sales is a withheld answer and should read as
 * one. What a free user gets from a thin platform is the same pair of non-secret
 * facts as from a fat one (how many sales, over what window) with every price,
 * date, title and link gone.
 *
 * What it deliberately does NOT do is manufacture a lock for a query with zero
 * sales. `available` stays false there, so the caller falls through to "not enough
 * completed sales". A paywall over nothing is a promise we cannot keep on upgrade.
 */
export function toLockedResult(result: SoldCompsResult): LockedSoldCompsResult {
  const byPlatform = new Map<SoldCompPlatform, LockedPlatformSoldStats>();

  // Aggregates first so their post-trim `n` wins over the raw row count for any
  // platform that appears in both lists.
  for (const p of result.platforms) {
    byPlatform.set(p.platform, { platform: p.platform, n: p.n, windowDays: p.windowDays });
  }
  for (const g of result.sales) {
    if (byPlatform.has(g.platform)) continue;
    byPlatform.set(g.platform, { platform: g.platform, n: g.total, windowDays: g.windowDays });
  }

  const platforms = SOLD_COMP_PLATFORMS.map((p) => byPlatform.get(p)).filter(
    (p): p is LockedPlatformSoldStats => p !== undefined,
  );

  return {
    locked: true,
    available: platforms.length > 0,
    platforms,
    errors: result.errors,
  };
}
