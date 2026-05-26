import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const FREE_CAP = 10;
const PRO_CAP = 100;

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile, error } = await admin
    .from('profiles')
    .select('subscription_status, searches_used_this_period, subscription_period_end, searches_period_start')
    .eq('id', user.id)
    .single();

  if (error || !profile) {
    return NextResponse.json({ error: 'profile_unavailable' }, { status: 500 });
  }

  const status = profile.subscription_status ?? 'free';
  const isPro = status === 'active' || status === 'past_due';

  // For free users, calculate when searches reset (30 days after period start)
  let searchResetDate: string | null = null;
  if (!isPro && profile.searches_period_start) {
    const periodStartMs = new Date(profile.searches_period_start).getTime();
    const resetMs = periodStartMs + (30 * 24 * 60 * 60 * 1000);
    searchResetDate = new Date(resetMs).toISOString();
  }

  return NextResponse.json({
    status,
    plan: isPro ? 'pro' : 'free',
    used: profile.searches_used_this_period ?? 0,
    cap: isPro ? PRO_CAP : FREE_CAP,
    periodEnd: profile.subscription_period_end,
    searchResetDate,
  });
}
