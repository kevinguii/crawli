import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-04-22.dahlia',
  typescript: true,
});

// Pro price IDs — names kept (no `_PRO_`) to avoid touching Hetzner env.
export const STRIPE_PRICE_MONTHLY = process.env.STRIPE_PRICE_ID_MONTHLY!;
export const STRIPE_PRICE_YEARLY = process.env.STRIPE_PRICE_ID_YEARLY!;
export const STRIPE_PRICE_WEEKLY = process.env.STRIPE_PRICE_ID_WEEKLY!;

// Max price IDs.
export const STRIPE_PRICE_MAX_MONTHLY = process.env.STRIPE_PRICE_ID_MAX_MONTHLY!;
export const STRIPE_PRICE_MAX_YEARLY = process.env.STRIPE_PRICE_ID_MAX_YEARLY!;
export const STRIPE_PRICE_MAX_WEEKLY = process.env.STRIPE_PRICE_ID_MAX_WEEKLY!;

export type Tier = 'free' | 'pro' | 'max';
export type BillingCycle = 'weekly' | 'monthly' | 'yearly';

export interface TierCaps {
  maxSearchesPerPeriod: number;
  maxSavedSearches: number;
  maxTrackedListings: number;
  nativeResultsCap: number;
}

export const TIER_CAPS: Record<Tier, TierCaps> = {
  free: { maxSearchesPerPeriod: 10,  maxSavedSearches: 1,  maxTrackedListings: 50,   nativeResultsCap: 10 },
  pro:  { maxSearchesPerPeriod: 20,  maxSavedSearches: 3,  maxTrackedListings: 200,  nativeResultsCap: 40 },
  max:  { maxSearchesPerPeriod: 70,  maxSavedSearches: 10, maxTrackedListings: 1000, nativeResultsCap: 80 },
};

export function tierFromPriceId(priceId: string | null | undefined): Tier {
  if (!priceId) return 'free';
  if (priceId === STRIPE_PRICE_MAX_MONTHLY || priceId === STRIPE_PRICE_MAX_YEARLY || priceId === STRIPE_PRICE_MAX_WEEKLY) return 'max';
  if (priceId === STRIPE_PRICE_MONTHLY || priceId === STRIPE_PRICE_YEARLY || priceId === STRIPE_PRICE_WEEKLY) return 'pro';
  // Unknown price ID — almost always a missing env var. Log loudly so the
  // webhook doesn't silently downgrade a paying customer to free.
  console.warn(
    `[stripe] unknown price ID ${priceId} — falling back to free. ` +
    `Known: pro=${STRIPE_PRICE_MONTHLY || '(unset)'}/${STRIPE_PRICE_YEARLY || '(unset)'}/${STRIPE_PRICE_WEEKLY || '(unset)'} ` +
    `max=${STRIPE_PRICE_MAX_MONTHLY || '(unset)'}/${STRIPE_PRICE_MAX_YEARLY || '(unset)'}/${STRIPE_PRICE_MAX_WEEKLY || '(unset)'}`,
  );
  return 'free';
}

export function priceIdForTier(tier: Exclude<Tier, 'free'>, cycle: BillingCycle): string {
  if (tier === 'max') {
    if (cycle === 'weekly') return STRIPE_PRICE_MAX_WEEKLY;
    if (cycle === 'monthly') return STRIPE_PRICE_MAX_MONTHLY;
    return STRIPE_PRICE_MAX_YEARLY;
  }
  if (cycle === 'weekly') return STRIPE_PRICE_WEEKLY;
  if (cycle === 'monthly') return STRIPE_PRICE_MONTHLY;
  return STRIPE_PRICE_YEARLY;
}
