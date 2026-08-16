// Sold comps: completed-sale data, as opposed to the live asking prices the rest
// of the app deals in. Rationale: docs/planning/COMPETITIVE_POSITIONING.md §5 Step 1.

/** Platforms that expose usable sold data. Deliberately not PlatformKey — Mercari,
 *  ThredUp, eBay and StockX are out of scope and must not be passed here. */
export type SoldCompPlatform = 'grailed' | 'poshmark';

export const SOLD_COMP_PLATFORMS: SoldCompPlatform[] = ['grailed', 'poshmark'];

/** One completed sale, normalized across platforms. */
export interface SoldComp {
  url: string;
  title: string | null;
  /** Final sale price in USD. Grailed: true sold_price. Poshmark: the asking
   *  price at time of sale — accepted offers are hidden, so this skews high. */
  price: number;
  /** When the item sold. */
  soldAt: Date;
  /** When the item was first listed. Null when the platform omits it, which makes
   *  this row unusable for days-to-sell but still fine for the price median. */
  listedAt: Date | null;
  size: string | null;
  condition: string | null;
}

/** Aggregated stats for one platform. Only produced when n >= MIN_SAMPLE. */
export interface PlatformSoldStats {
  platform: SoldCompPlatform;
  medianPrice: number;
  p25: number;
  p75: number;
  /** Number of sales behind these figures, after relevance filtering and outlier trim. */
  n: number;
  /** The window these sales came from: 90, 180 or 365. Always surfaced in the UI —
   *  a median means nothing without knowing how far back it reaches. */
  windowDays: number;
  /** Median days from listing to sale, or null when too few rows carry a list date. */
  daysToSell: number | null;
}

export interface SoldCompsResult {
  /** False when no platform cleared the sample floor. The UI renders nothing. */
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
  /** Platforms that errored rather than simply having too little data. Surfaced so
   *  a silent scrape failure can't masquerade as "no sales". */
  errors: string[];
}
