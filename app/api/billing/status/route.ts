import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { TIER_CAPS, type Tier } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile, error } = await admin
    .from('profiles')
    .select([
      'subscription_status',
      'subscription_tier',
      'searches_used_this_period',
      'subscription_period_end',
      'searches_period_start',
      'max_searches_per_period',
      'max_saved_searches',
      'max_tracked_listings',
      'native_results_cap',
    ].join(','))
    .eq('id', user.id)
    .single<{
      subscription_status: string | null;
      subscription_tier: Tier | null;
      searches_used_this_period: number | null;
      subscription_period_end: string | null;
      searches_period_start: string | null;
      max_searches_per_period: number | null;
      max_saved_searches: number | null;
      max_tracked_listings: number | null;
      native_results_cap: number | null;
    }>();

  if (error || !profile) {
    return NextResponse.json({ error: 'profile_unavailable' }, { status: 500 });
  }

  const status = profile.subscription_status ?? 'free';
  const isPro = status === 'active' || status === 'past_due';
  const tier: Tier = profile.subscription_tier ?? (isPro ? 'pro' : 'free');
  const defaults = TIER_CAPS[tier];

  // For free users, calculate when searches reset (30 days after period start)
  let searchResetDate: string | null = null;
  if (!isPro && profile.searches_period_start) {
    const periodStartMs = new Date(profile.searches_period_start).getTime();
    const resetMs = periodStartMs + (30 * 24 * 60 * 60 * 1000);
    searchResetDate = new Date(resetMs).toISOString();
  }

  // Count current usage of the non-period caps (alerts + tracked) so the UI
  // can render real progress against them.
  const [alertsRes, trackedRes] = await Promise.all([
    admin.from('saved_searches').select('id', { count: 'exact', head: true })
      .eq('user_id', user.id).eq('paused', false),
    admin.from('watchlist').select('id', { count: 'exact', head: true })
      .eq('user_id', user.id),
  ]);

  const caps = {
    searches: profile.max_searches_per_period ?? defaults.maxSearchesPerPeriod,
    alerts: profile.max_saved_searches ?? defaults.maxSavedSearches,
    tracked: profile.max_tracked_listings ?? defaults.maxTrackedListings,
    nativeResults: profile.native_results_cap ?? defaults.nativeResultsCap,
  };

  return NextResponse.json({
    status,
    tier,
    plan: tier, // legacy alias for existing clients
    caps,
    usage: {
      searches: profile.searches_used_this_period ?? 0,
      alerts: alertsRes.count ?? 0,
      tracked: trackedRes.count ?? 0,
    },
    // Legacy flat fields — keep until callers migrate.
    used: profile.searches_used_this_period ?? 0,
    cap: caps.searches,
    periodEnd: profile.subscription_period_end,
    searchResetDate,
  });
}
