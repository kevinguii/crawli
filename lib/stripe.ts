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

// Weekly is retired from checkout (see priceIdForTier) but the price ID
// constants above stay recognized in tierFromPriceId — a webhook event for an
// existing weekly subscriber must resolve to 'pro'/'max', not silently
// downgrade to free. Same pattern as the 'max' tier's retirement from the
// pricing page: stays resolvable, is no longer offered.
export type BillingCycle = 'monthly' | 'yearly';

// Tiers and caps live in lib/tierCaps.ts, which imports nothing — this module
// constructs a Stripe client at import time, so client components and the search
// worker must not pull it in. Re-exported here so existing import sites keep
// working; prefer importing from '@/lib/tierCaps' in new code.
export {
  TIER_CAPS,
  UNLIMITED,
  resolveTier,
  canSeePriceIntelligence,
} from './tierCaps';
export type { Tier, TierCaps } from './tierCaps';

import type { Tier } from './tierCaps';

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
    return cycle === 'monthly' ? STRIPE_PRICE_MAX_MONTHLY : STRIPE_PRICE_MAX_YEARLY;
  }
  return cycle === 'monthly' ? STRIPE_PRICE_MONTHLY : STRIPE_PRICE_YEARLY;
}
