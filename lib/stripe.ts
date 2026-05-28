import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-04-22.dahlia',
  typescript: true,
});

// Pro price IDs — names kept (no `_PRO_`) to avoid touching Hetzner env.
export const STRIPE_PRICE_MONTHLY = process.env.STRIPE_PRICE_ID_MONTHLY!;
export const STRIPE_PRICE_YEARLY = process.env.STRIPE_PRICE_ID_YEARLY!;

// Max price IDs — net-new.
export const STRIPE_PRICE_MAX_MONTHLY = process.env.STRIPE_PRICE_ID_MAX_MONTHLY!;
export const STRIPE_PRICE_MAX_YEARLY = process.env.STRIPE_PRICE_ID_MAX_YEARLY!;

export type Tier = 'free' | 'pro' | 'max';
export type BillingCycle = 'monthly' | 'yearly';

export interface TierCaps {
  maxSearchesPerPeriod: number;
  maxSavedSearches: number;
  maxTrackedListings: number;
  nativeResultsCap: number;
}

export const TIER_CAPS: Record<Tier, TierCaps> = {
  free: { maxSearchesPerPeriod: 10,  maxSavedSearches: 1,  maxTrackedListings: 50,   nativeResultsCap: 10 },
  pro:  { maxSearchesPerPeriod: 75,  maxSavedSearches: 3,  maxTrackedListings: 200,  nativeResultsCap: 40 },
  max:  { maxSearchesPerPeriod: 300, maxSavedSearches: 10, maxTrackedListings: 1000, nativeResultsCap: 80 },
};

export function tierFromPriceId(priceId: string | null | undefined): Tier {
  if (!priceId) return 'free';
  if (priceId === STRIPE_PRICE_MAX_MONTHLY || priceId === STRIPE_PRICE_MAX_YEARLY) return 'max';
  if (priceId === STRIPE_PRICE_MONTHLY || priceId === STRIPE_PRICE_YEARLY) return 'pro';
  // Unknown price ID — almost always a missing env var. Log loudly so the
  // webhook doesn't silently downgrade a paying customer to free.
  console.warn(
    `[stripe] unknown price ID ${priceId} — falling back to free. ` +
    `Known: pro=${STRIPE_PRICE_MONTHLY || '(unset)'}/${STRIPE_PRICE_YEARLY || '(unset)'} ` +
    `max=${STRIPE_PRICE_MAX_MONTHLY || '(unset)'}/${STRIPE_PRICE_MAX_YEARLY || '(unset)'}`,
  );
  return 'free';
}

export function priceIdForTier(tier: Exclude<Tier, 'free'>, cycle: BillingCycle): string {
  if (tier === 'max') return cycle === 'monthly' ? STRIPE_PRICE_MAX_MONTHLY : STRIPE_PRICE_MAX_YEARLY;
  return cycle === 'monthly' ? STRIPE_PRICE_MONTHLY : STRIPE_PRICE_YEARLY;
}
