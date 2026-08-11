/**
 * Marketplace fee config — the ONE source of truth for seller-payout and
 * buyer-side fees across every destination platform Crawli can flip into.
 *
 * Rules of the road:
 *  - NEVER hardcode a fee rate inside a component. Import from here.
 *  - Seller-payout fees (what the reseller loses when they SELL) are kept
 *    separate from buyer-side fees (what the buyer pays on top). A reseller's
 *    net profit depends only on the seller side; buyer-side fees are surfaced
 *    for context (they shape how high you can list before buyers balk).
 *  - Every platform carries a `lastVerified` date. When a rate changes, update
 *    the value AND the date in the same edit, and note the source in docs/reference/B2B_FEATURE_TRUTH.md.
 *
 * Rates below are US-market, default (non-store / Level-1 / non-boosted) seller
 * status, verified via vendor help pages + fee trackers on 2026-08-11. Scope and
 * caveats live in each entry's `notes`. See docs/reference/B2B_FEATURE_TRUTH.md for sources.
 */

import type { PlatformKey } from '@/lib/types';

export interface PlatformFee {
  label: string;

  // ----- Seller-side: these reduce the seller's payout -----
  /** Marketplace commission as a fraction of sale price (0.10 = 10%). */
  sellerCommissionPct: number;
  /** Payment-processing as a fraction of sale price, when charged separately. */
  sellerProcessingPct: number;
  /** Flat per-order $ charged to the seller. */
  sellerProcessingFlat: number;
  /**
   * Optional override for non-linear seller fee schedules (tiered commission,
   * flat-fee-under-threshold). When present this returns the TOTAL seller fee
   * in dollars and the pct/flat fields above are ignored by `sellerFee()`.
   * The pct/flat fields are still kept populated for documentation/at-a-glance.
   */
  computeSellerFee?: (salePrice: number) => number;

  // ----- Buyer-side: paid by the buyer ON TOP, do NOT reduce seller payout -----
  /** Buyer protection / service fee as a fraction of price. */
  buyerFeePct: number;
  /** Flat buyer fee $. */
  buyerFeeFlat: number;

  lastVerified: string; // 'YYYY-MM-DD'
  notes?: string;
}

export const FEES_LAST_VERIFIED = '2026-08-11';

export const MARKETPLACE_FEES: Record<PlatformKey, PlatformFee> = {
  ebay: {
    label: 'eBay',
    // Fashion final value fee, US seller without a Store subscription. FVF is
    // inclusive of payment processing on eBay Managed Payments, so there is no
    // separate processing %. Per-order fee is $0.40 for orders over $10
    // ($0.30 at/under $10) — we use $0.40 as the common case. Rate raised from
    // 13.25% to 13.6% for most categories effective 2025-02-14.
    sellerCommissionPct: 0.136,
    sellerProcessingPct: 0,
    sellerProcessingFlat: 0.4,
    buyerFeePct: 0,
    buyerFeeFlat: 0,
    lastVerified: '2026-08-11',
    notes:
      'Clothing/fashion, no Store sub. FVF 13.6% + $0.40/order (>$10). Store subs and some categories (jewelry/watches 15%, books/media 15.3%) differ. Buyer pays no platform fee.',
  },

  poshmark: {
    label: 'Poshmark',
    // Flat $2.95 on sales under $15, else 20% commission. No separate processing.
    sellerCommissionPct: 0.2,
    sellerProcessingPct: 0,
    sellerProcessingFlat: 0,
    computeSellerFee: (salePrice) => (salePrice < 15 ? 2.95 : salePrice * 0.2),
    buyerFeePct: 0,
    buyerFeeFlat: 0,
    lastVerified: '2026-08-11',
    notes:
      'Flat $2.95 under $15, else 20%. Prepaid USPS Priority label (≤5lb) included. No buyer-side platform fee.',
  },

  mercari: {
    label: 'Mercari',
    // Buyer-fee model (post Jan 2025): seller pays 10% on item + buyer-paid
    // shipping, no seller processing fee. Buyer pays a 3.6% protection fee.
    sellerCommissionPct: 0.1,
    sellerProcessingPct: 0,
    sellerProcessingFlat: 0,
    buyerFeePct: 0.036,
    buyerFeeFlat: 0,
    lastVerified: '2026-08-11',
    notes:
      '10% seller fee on item + buyer-paid shipping; no seller processing fee. Buyer pays 3.6% protection fee.',
  },

  grailed: {
    label: 'Grailed',
    // Tiered commission (eff. 2026-05-20): 9% on sales ≥ $120, else 6%
    // (min $1.99). Plus Stripe processing 3.49% + $0.49 for onboarded US
    // domestic sellers. Buyers pay nothing.
    sellerCommissionPct: 0.09,
    sellerProcessingPct: 0.0349,
    sellerProcessingFlat: 0.49,
    computeSellerFee: (salePrice) => {
      const commission =
        salePrice >= 120 ? salePrice * 0.09 : Math.max(salePrice * 0.06, 1.99);
      const processing = salePrice * 0.0349 + 0.49;
      return commission + processing;
    },
    buyerFeePct: 0,
    buyerFeeFlat: 0,
    lastVerified: '2026-08-11',
    notes:
      'Commission 9% (≥$120) / 6% min $1.99 (<$120) + Stripe 3.49% + $0.49 (US domestic, onboarded). International/non-onboarded rates higher. Free for buyers.',
  },

  depop: {
    label: 'Depop',
    // US/UK: $0 selling commission since Jul 2024. Seller pays only payment
    // processing 3.3% + $0.45 (charged on item + shipping + tax). Buyers see a
    // separate marketplace fee up to 5% + up to $1.
    sellerCommissionPct: 0,
    sellerProcessingPct: 0.033,
    sellerProcessingFlat: 0.45,
    buyerFeePct: 0.05,
    buyerFeeFlat: 1.0,
    lastVerified: '2026-08-11',
    notes:
      'US/UK $0 commission; seller pays processing 3.3% + $0.45. Buyer marketplace fee up to 5% + up to $1. Non-US/UK sellers still pay 10% commission. Optional Boosted Listings 12%.',
  },

  vinted: {
    label: 'Vinted',
    // Zero seller fees (no commission, no processing). Buyer pays a Buyer
    // Protection fee ~5% + $0.70.
    sellerCommissionPct: 0,
    sellerProcessingPct: 0,
    sellerProcessingFlat: 0,
    buyerFeePct: 0.05,
    buyerFeeFlat: 0.7,
    lastVerified: '2026-08-11',
    notes:
      'No seller fees at all — listing price is the payout. Buyer pays ~5% + $0.70 Buyer Protection.',
  },

  stockx: {
    label: 'StockX',
    // Verified Marketplace seller: transaction fee by level (9% at Level 1,
    // down to 7% at Level 5) + flat 3% payment processing. We use the Level-1
    // default 9%. Shipping-to-authentication is a separate flat cost the
    // reseller can add manually; not modeled as a % here.
    sellerCommissionPct: 0.09,
    sellerProcessingPct: 0.03,
    sellerProcessingFlat: 0,
    buyerFeePct: 0,
    buyerFeeFlat: 0,
    lastVerified: '2026-08-11',
    notes:
      'Level-1 default: 9% transaction + 3% processing = 12%. Drops in 0.5pt steps to 7% transaction at Level 5 (top tier). Excludes flat $5 US shipping fee. Buyer pays no transaction %.',
  },
};

/** Total seller-side fee in dollars for a given sale price on a platform. */
export function sellerFee(salePrice: number, platform: PlatformKey): number {
  const f = MARKETPLACE_FEES[platform];
  if (!f || salePrice <= 0) return 0;
  if (f.computeSellerFee) return f.computeSellerFee(salePrice);
  return salePrice * (f.sellerCommissionPct + f.sellerProcessingPct) + f.sellerProcessingFlat;
}

/** What the seller actually keeps after fees when selling at `salePrice`. */
export function sellerPayout(salePrice: number, platform: PlatformKey): number {
  if (salePrice <= 0) return 0;
  return salePrice - sellerFee(salePrice, platform);
}

/** What the buyer pays on top of the list price (context only — not in profit). */
export function buyerCost(salePrice: number, platform: PlatformKey): number {
  const f = MARKETPLACE_FEES[platform];
  if (!f || salePrice <= 0) return salePrice;
  return salePrice + salePrice * f.buyerFeePct + f.buyerFeeFlat;
}

export interface FlipResult {
  /** Seller payout after fees. */
  payout: number;
  /** Total seller-side fees in dollars. */
  fees: number;
  /** payout − sourcingPrice. */
  netProfit: number;
  /** netProfit as % of resale price (gross margin). */
  marginPct: number;
  /** netProfit as % of sourcing price (return on cost). */
  roiPct: number;
}

/**
 * Suggested flip economics: buy at `sourcingPrice`, resell at `resalePrice` on
 * `platform`. Net profit is driven by seller-side fees only.
 */
export function netFlipProfit(opts: {
  sourcingPrice: number;
  resalePrice: number;
  platform: PlatformKey;
}): FlipResult {
  const { sourcingPrice, resalePrice, platform } = opts;
  const payout = sellerPayout(resalePrice, platform);
  const fees = Math.max(0, resalePrice - payout);
  const netProfit = payout - sourcingPrice;
  const marginPct = resalePrice > 0 ? (netProfit / resalePrice) * 100 : 0;
  const roiPct = sourcingPrice > 0 ? (netProfit / sourcingPrice) * 100 : 0;
  return { payout, fees, netProfit, marginPct, roiPct };
}

/** Platform keys that have a fee profile, for building selectors. */
export const FEE_PLATFORMS = Object.keys(MARKETPLACE_FEES) as PlatformKey[];
