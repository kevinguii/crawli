/**
 * Prepaid search credit packs: the debt-proof overage mechanism.
 *
 * Once a tier's included searches (TIER_CAPS.maxSearchesPerPeriod) are spent,
 * further searches draw down prepaid credits instead of being free-unlimited.
 * Credits are bought up front via a one-time Stripe Checkout (mode=payment), so
 * cash is collected BEFORE consumption, we never deliver searches we haven't
 * been paid for.
 *
 * TUNABLE DIAL: `searches` and `priceUsd` below are the shipped numbers.
 * Per the Avenue A cost model (docs/reference/FIRECRAWL_PRICING.md / scripts/cogs-per-search.mjs),
 * marginal cost is ~$0.006 (Standard) to ~$0.019 (Hobby) per search, so every
 * pack price here sits comfortably above worst-case marginal cost. `priceUsd`
 * is DISPLAY ONLY: the actual charge is whatever the Stripe one-time price ID
 * (env var) is set to, so the owner MUST provision matching Stripe prices
 * ($10 / $25 / $60) or the displayed and charged amounts will diverge.
 *
 * The Stripe price IDs live in env vars (not created by code) so prod and dev
 * can point at different one-time prices without code changes.
 */

export interface CreditPack {
  id: 'small' | 'medium' | 'large';
  label: string;
  searches: number; // credits granted on purchase
  priceUsd: number; // display price (PROPOSED, above marginal COGS)
  priceIdEnv: string; // env var name holding the Stripe one-time price ID
}

// Priced ABOVE the worst-case marginal cost (~$0.019/search at Hobby, see
// scripts/cogs-per-search.mjs). Volume discount per tier while staying debt-proof.
// Owner must provision the matching Stripe one-time prices ($10/$25/$60).
export const CREDIT_PACKS: CreditPack[] = [
  { id: 'small', label: '100 extra searches', searches: 100, priceUsd: 10, priceIdEnv: 'STRIPE_PRICE_PACK_SMALL' },
  { id: 'medium', label: '300 extra searches', searches: 300, priceUsd: 25, priceIdEnv: 'STRIPE_PRICE_PACK_MEDIUM' },
  { id: 'large', label: '1,000 extra searches', searches: 1000, priceUsd: 60, priceIdEnv: 'STRIPE_PRICE_PACK_LARGE' },
];

export function packById(id: string): CreditPack | undefined {
  return CREDIT_PACKS.find((p) => p.id === id);
}

/** Resolve the configured Stripe one-time price ID for a pack (or undefined if unset). */
export function priceIdForPack(pack: CreditPack): string | undefined {
  return process.env[pack.priceIdEnv] || undefined;
}

/** Reverse lookup: given a Stripe price ID from a completed checkout, find the pack. */
export function packByPriceId(priceId: string | null | undefined): CreditPack | undefined {
  if (!priceId) return undefined;
  return CREDIT_PACKS.find((p) => process.env[p.priceIdEnv] === priceId);
}

/** Credits to grant for a completed one-time checkout on a given price ID. */
export function searchesForPriceId(priceId: string | null | undefined): number {
  return packByPriceId(priceId)?.searches ?? 0;
}
