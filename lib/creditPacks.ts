/**
 * Prepaid search credit packs — the debt-proof overage mechanism.
 *
 * Once a tier's included searches (TIER_CAPS.maxSearchesPerPeriod) are spent,
 * further searches draw down prepaid credits instead of being free-unlimited.
 * Credits are bought up front via a one-time Stripe Checkout (mode=payment), so
 * cash is collected BEFORE consumption — we never deliver searches we haven't
 * been paid for.
 *
 * TUNABLE DIAL: `searches` and `priceUsd` below are PROPOSED starting numbers.
 * Per the cost model (HANDOFF §9 / scripts/cogs-per-search.mjs), marginal cost
 * is ~$0.05 (Standard) to ~$0.22 (Hobby) per search, so every pack price here
 * sits above marginal cost. The owner sets the final numbers and provisions the
 * matching one-time prices in Stripe — DO NOT treat these as shipped prices.
 *
 * The Stripe price IDs live in env vars (not created by code) so prod and dev
 * can point at different one-time prices without code changes.
 */

export interface CreditPack {
  id: 'small' | 'medium' | 'large';
  label: string;
  searches: number; // credits granted on purchase
  priceUsd: number; // display price (PROPOSED — above marginal COGS)
  priceIdEnv: string; // env var name holding the Stripe one-time price ID
}

// Proposed defaults are priced ABOVE the worst-case marginal cost (~$0.28/search
// at Hobby, max tier — see scripts/cogs-per-search.mjs). Modest volume discount
// per tier while staying debt-proof. Owner adjusts + provisions before launch.
export const CREDIT_PACKS: CreditPack[] = [
  { id: 'small', label: '50 extra searches', searches: 50, priceUsd: 20, priceIdEnv: 'STRIPE_PRICE_PACK_SMALL' },
  { id: 'medium', label: '150 extra searches', searches: 150, priceUsd: 50, priceIdEnv: 'STRIPE_PRICE_PACK_MEDIUM' },
  { id: 'large', label: '500 extra searches', searches: 500, priceUsd: 150, priceIdEnv: 'STRIPE_PRICE_PACK_LARGE' },
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
