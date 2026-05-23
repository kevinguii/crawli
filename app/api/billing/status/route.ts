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
    .select('subscription_status, searches_used_this_period, subscription_period_end')
    .eq('id', user.id)
    .single();

  if (error || !profile) {
    return NextResponse.json({ error: 'profile_unavailable' }, { status: 500 });
  }

  const status = profile.subscription_status ?? 'free';
  const isPro = status === 'active' || status === 'past_due';

  return NextResponse.json({
    status,
    plan: isPro ? 'pro' : 'free',
    used: profile.searches_used_this_period ?? 0,
    cap: isPro ? PRO_CAP : FREE_CAP,
    periodEnd: profile.subscription_period_end,
  });
}
