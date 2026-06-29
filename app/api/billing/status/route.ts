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
      'search_credits',
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
      search_credits: number | null;
    }>();

  if (error || !profile) {
    return NextResponse.json({ error: 'profile_unavailable' }, { status: 500 });
  }

  const status = profile.subscription_status ?? 'free';
  const isPro = status === 'active' || status === 'past_due';
  const tier: Tier = profile.subscription_tier ?? (isPro ? 'pro' : 'free');
  const defaults = TIER_CAPS[tier];

  const RESET_PERIOD_MS = 7 * 24 * 60 * 60 * 1000;

  // pg_cron resets expired periods at midnight UTC daily. This lazy reset
  // catches the gap between period expiry and the next cron tick, so the
  // UI never shows a stale count when the user loads the settings page.
  let searchesUsed = profile.searches_used_this_period ?? 0;
  let periodStart = profile.searches_period_start;
  if (periodStart) {
    const periodDayStart = new Date(periodStart);
    periodDayStart.setUTCHours(0, 0, 0, 0);
    if (Date.now() - periodDayStart.getTime() > RESET_PERIOD_MS) {
      const todayMidnight = new Date();
      todayMidnight.setUTCHours(0, 0, 0, 0);
      const midnightISO = todayMidnight.toISOString();
      await admin.from('profiles').update({
        searches_used_this_period: 0,
        searches_period_start: midnightISO,
      }).eq('id', user.id);
      searchesUsed = 0;
      periodStart = midnightISO;
    }
  }

  // Calculate when searches reset (7 days after period start)
  let searchResetDate: string | null = null;
  if (periodStart) {
    const resetMs = new Date(periodStart).getTime() + RESET_PERIOD_MS;
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
    // Native results cap is the single source of truth — always derive from
    // tier so a TIER_CAPS bump auto-applies (no DB backfill needed).
    nativeResults: defaults.nativeResultsCap,
  };

  return NextResponse.json({
    status,
    tier,
    plan: tier, // legacy alias for existing clients
    caps,
    usage: {
      searches: searchesUsed,
      alerts: alertsRes.count ?? 0,
      tracked: trackedRes.count ?? 0,
    },
    // Prepaid overage credits drawn down after the included cap is spent.
    credits: profile.search_credits ?? 0,
    // Legacy flat fields — keep until callers migrate.
    used: searchesUsed,
    cap: caps.searches,
    periodEnd: profile.subscription_period_end,
    searchResetDate,
  });
}
