// Plan tiers and their caps — the single source of truth for what each plan gets.
//
// Deliberately its own module rather than living in lib/stripe.ts: that file
// constructs a Stripe client at module scope, so importing it from a client
// component or from the search worker would drag the Stripe SDK (and a demand for
// STRIPE_SECRET_KEY) somewhere it has no business being. This file imports nothing.
// lib/stripe.ts re-exports everything here, so existing import sites are unchanged.

export type Tier = 'free' | 'pro' | 'max';

export interface TierCaps {
  maxSearchesPerPeriod: number;
  maxSavedSearches: number;
  maxTrackedListings: number;
  nativeResultsCap: number;
  /** Bookmarked listings. Ungated before 2026-08-17. */
  maxSaves: number;
  /** Floor on `saved_searches.cadence_hours`. 24 = daily allowed, 168 = weekly only. */
  minAlertCadenceHours: number;
}

// UNLIMITED is a large finite sentinel (not Infinity) so it serializes to JSON
// and stores cleanly in the integer `max_tracked_listings` column. No real
// watchlist approaches it. Render as "Unlimited" in the UI.
export const UNLIMITED = 1_000_000;

// Caps are weekly for searches.
//
// Revised 2026-08-17 (paywall repackaging — see
// docs/superpowers/specs/2026-08-17-paywall-repackaging-design.md). The previous
// numbers were commercially inert: at ~2.18 searches/user/month exactly 1 of 46
// users had ever reached a cap, and the free tier differed from paid only by
// integers nobody approached. The gates that matter now are the ones felt on every
// use — `nativeResultsCap` (shallower results), `minAlertCadenceHours` (weekly
// alerts), and the price-intelligence lock in /api/sold-comps — not the quotas.
//
// `max` is retired from the pricing page and no account resolves to it. It stays
// here so `tierFromPriceId` keeps handling a legacy price ID without downgrading
// anyone. Do not offer it; do not delete it.
export const TIER_CAPS: Record<Tier, TierCaps> = {
  // Free keeps DAILY alerts (owner decision 2026-08-17, reversing the weekly-only
  // floor in the original spec). Alert runs are cheap — the cross-user cache in
  // lib/searchCache means 50 users watching the same query cost one scrape — and
  // the alert email is the strongest mechanism bringing a user back for a second
  // session, which is the metric this product is worst at (3 of 22 return). Free
  // alerts are limited by COUNT (1), not frequency.
  free: { maxSearchesPerPeriod: 5,   maxSavedSearches: 1,  maxTrackedListings: 10,        nativeResultsCap: 8,   maxSaves: 10,        minAlertCadenceHours: 24 },
  pro:  { maxSearchesPerPeriod: 40,  maxSavedSearches: 8,  maxTrackedListings: 500,       nativeResultsCap: 60,  maxSaves: 500,       minAlertCadenceHours: 24 },
  max:  { maxSearchesPerPeriod: 120, maxSavedSearches: 20, maxTrackedListings: UNLIMITED, nativeResultsCap: 100, maxSaves: UNLIMITED, minAlertCadenceHours: 24 },
};

/**
 * Resolve a user's effective tier from their `profiles` row.
 *
 * `subscription_tier` is authoritative; the status fallback covers rows written
 * before that column existed. This logic was duplicated verbatim in five call
 * sites — any gate that disagrees with the others is a paywall hole, so new
 * gates must use this.
 */
export function resolveTier(
  subscriptionStatus: string | null | undefined,
  subscriptionTier: string | null | undefined,
): Tier {
  if (subscriptionTier === 'free' || subscriptionTier === 'pro' || subscriptionTier === 'max') {
    return subscriptionTier;
  }
  const status = subscriptionStatus ?? 'free';
  return status === 'active' || status === 'past_due' ? 'pro' : 'free';
}

/**
 * Tiers that may see computed price intelligence: the price summary, sold comps,
 * and flip margin seeded from real sold data. The governing line of the paywall is
 * "free shows you listings, Pro tells you what they mean".
 */
export function canSeePriceIntelligence(tier: Tier): boolean {
  return tier !== 'free';
}
