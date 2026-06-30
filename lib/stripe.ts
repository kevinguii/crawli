import Stripe from 'stripe';
import type { SupabaseClient } from '@supabase/supabase-js';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-04-22.dahlia',
  typescript: true,
});

/**
 * Resolve a usable Stripe customer ID for a user, tolerating a cached ID that
 * belongs to a different Stripe mode than the current secret key (e.g. a
 * live-mode ID hit with a test-mode key after a local/prod key swap). Verifies
 * the cached ID before reuse; on a resource_missing error, creates a fresh
 * customer for the current mode and overwrites the stored ID.
 */
export async function resolveStripeCustomerId(
  admin: SupabaseClient,
  userId: string,
  email: string | null | undefined,
  cachedCustomerId: string | null | undefined,
): Promise<string> {
  if (cachedCustomerId) {
    try {
      const existing = await stripe.customers.retrieve(cachedCustomerId);
      if (!existing.deleted) return cachedCustomerId;
    } catch (err) {
      if (!(err instanceof Stripe.errors.StripeInvalidRequestError && err.code === 'resource_missing')) {
        throw err;
      }
      // Cached ID belongs to a different Stripe mode — fall through and mint a new one.
    }
  }
  const customer = await stripe.customers.create({
    email: email ?? undefined,
    metadata: { supabase_user_id: userId },
  });
  await admin.from('profiles').update({ stripe_customer_id: customer.id }).eq('id', userId);
  return customer.id;
}

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

// UNLIMITED is a large finite sentinel (not Infinity) so it serializes to JSON
// and stores cleanly in the integer `max_tracked_listings` column. No real
// watchlist approaches it. Render as "Unlimited" in the UI.
export const UNLIMITED = 1_000_000;

// Caps are weekly for searches. Revised 2026-06-29 to pass through the Avenue A
// cost savings (per-search ~$0.006 Std / ~$0.019 Hobby — see
// scripts/cogs-per-search.mjs): more searches/alerts/tracked + deeper native
// results, metered hardest on the one axis with real unit cost (searches).
export const TIER_CAPS: Record<Tier, TierCaps> = {
  free: { maxSearchesPerPeriod: 5,   maxSavedSearches: 2,  maxTrackedListings: 50,        nativeResultsCap: 15 },
  pro:  { maxSearchesPerPeriod: 40,  maxSavedSearches: 8,  maxTrackedListings: 500,       nativeResultsCap: 60 },
  max:  { maxSearchesPerPeriod: 120, maxSavedSearches: 20, maxTrackedListings: UNLIMITED, nativeResultsCap: 100 },
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
