// Plan tiers and their caps: the single source of truth for what each plan gets.
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
// Revised 2026-08-17 (paywall repackaging, see
// docs/superpowers/specs/2026-08-17-paywall-repackaging-design.md). The previous
// numbers were commercially inert: at ~2.18 searches/user/month exactly 1 of 46
// users had ever reached a cap, and the free tier differed from paid only by
// integers nobody approached. The gates that matter now are the ones felt on every
// use: `nativeResultsCap` (shallower results), `minAlertCadenceHours` (weekly
// alerts), and the price-intelligence lock in /api/sold-comps, not the quotas.
//
// `max` is retired from the pricing page and no account resolves to it. It stays
// here so `tierFromPriceId` keeps handling a legacy price ID without downgrading
// anyone. Do not offer it; do not delete it.
//
// Revised 2026-08-18 (Pro repositioned as "unlimited"): searches 40 → 50/week,
// nativeResultsCap 60 → 100. Both are now marketed as "Unlimited" while staying
// finite here, the same deliberate copy/cap divergence already documented for
// saves and tracked listings in app/pricing/PricingCards.tsx, the numbers are
// abuse backstops, not felt limits. Grounding for that, measured 2026-08-18:
//   • busiest user-week ever recorded = 13 searches; p90 user-week = 5.9
//   • 0 of 52 user-weeks have ever exceeded even the OLD cap of 40
//   • Pro repriced $10 → $5/mo on 2026-08-21 (see COMPETITIVE_POSITIONING.md
//     §6c). Break-even on $5/mo is ~248 searches/mo (worst case: all 9
//     platforms every search on Firecrawl Hobby), the 50/wk cap (~217/mo)
//     stays under that, but only ~10% margin after Stripe fees in the
//     worst case (was ~56% at $10). Still net-positive even if maxed, but
//     the cushion is thin: if a real user ever lands on this cap, raise it
//     or drop the word immediately, don't wait for the usual review cycle.
// `nativeResultsCap` costs nothing at any value: the sidecar is called with a
// hardcoded limit=100 for every tier (lib/searchWorker.ts) and this cap is a
// post-fetch .slice(), so 100 is the true ceiling of what is fetched. Raising it
// further requires raising that sidecar limit, which DOES cost render time.
// If either cap ever tightens enough to be reachable, the pricing copy must
// change with it.
//
// Revised 2026-08-18 (alerts joined the "unlimited" set): maxSavedSearches
// 8 → 25 on Pro, marketed as "Unlimited". Different cost shape from the two
// caps above though: nativeResultsCap is free at any value (a post-fetch
// slice) and a search is a one-off, but a saved alert is a PERMANENT recurring
// job: every one added re-runs its query daily forever via the crontab in
// /api/cron/run-alerts, so raising this cap is cheap-per-unit and linear, not
// literally free the way the other two are. Grounding for "cheap":
//   • alert runs never touch Firecrawl: ALERT_EXCLUDED_PLATFORMS excludes eBay,
//     the only platform that's ever metered, so an alert run costs self-hosted
//     crawl4ai compute only, and shares the same cross-user search cache live
//     search uses
//   • the cron is a systemd crontab on our own box (not billed per invocation),
//     ticking every 15 min and handling ≤20 due alerts per tick, 1920/day of
//     headroom against an actual total of 13 alerts across all 48 users
//   • busiest real user ever = 3 alerts (the owner's own Pro account); nobody
//     has ever approached the old cap of 8
// 25 is a backstop for the linear cost, not a felt limit. If a real user ever
// lands on it, raise it or drop the word, same rule as the other two caps.
export const TIER_CAPS: Record<Tier, TierCaps> = {
  // Free keeps DAILY alerts (owner decision 2026-08-17, reversing the weekly-only
  // floor in the original spec). Alert runs are cheap: the cross-user cache in
  // lib/searchCache means 50 users watching the same query cost one scrape, and
  // the alert email is the strongest mechanism bringing a user back for a second
  // session, which is the metric this product is worst at (3 of 22 return). Free
  // alerts are limited by COUNT (1), not frequency.
  free: { maxSearchesPerPeriod: 5,   maxSavedSearches: 1,  maxTrackedListings: 10,        nativeResultsCap: 8,   maxSaves: 10,        minAlertCadenceHours: 24 },
  pro:  { maxSearchesPerPeriod: 50,  maxSavedSearches: 25, maxTrackedListings: 500,       nativeResultsCap: 100, maxSaves: 500,       minAlertCadenceHours: 24 },
  max:  { maxSearchesPerPeriod: 120, maxSavedSearches: 30, maxTrackedListings: UNLIMITED, nativeResultsCap: 100, maxSaves: UNLIMITED, minAlertCadenceHours: 24 },
};

/**
 * Resolve a user's effective tier from their `profiles` row.
 *
 * `subscription_tier` is authoritative; the status fallback covers rows written
 * before that column existed. This logic was duplicated verbatim in five call
 * sites: any gate that disagrees with the others is a paywall hole, so new
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
