import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { stripe, priceIdForTier, resolveStripeCustomerId, type BillingCycle, type Tier } from '@/lib/stripe';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  // Accept new {tier, cycle} shape. Fall back to legacy {plan} = Pro for any
  // stale clients in flight; remove the fallback once the frontend redeploy
  // settles.
  let tier: Exclude<Tier, 'free'> | undefined;
  let cycle: BillingCycle | undefined;
  if (body?.tier && body?.cycle) {
    if (body.tier !== 'pro' && body.tier !== 'max') {
      return NextResponse.json({ error: 'tier must be "pro" or "max"' }, { status: 400 });
    }
    if (body.cycle !== 'weekly' && body.cycle !== 'monthly' && body.cycle !== 'yearly') {
      return NextResponse.json({ error: 'cycle must be "weekly", "monthly" or "yearly"' }, { status: 400 });
    }
    tier = body.tier;
    cycle = body.cycle;
  } else if (body?.plan === 'monthly' || body?.plan === 'yearly') {
    tier = 'pro';
    cycle = body.plan;
  } else {
    return NextResponse.json({ error: 'tier+cycle required' }, { status: 400 });
  }
  const priceId = priceIdForTier(tier!, cycle!);

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('stripe_customer_id, email')
    .eq('id', user.id)
    .single();

  const customerId = await resolveStripeCustomerId(
    admin,
    user.id,
    user.email ?? profile?.email,
    profile?.stripe_customer_id,
  );

  const origin = req.headers.get('origin') ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    client_reference_id: user.id,
    success_url: `${origin}/settings?billing=success`,
    cancel_url: `${origin}/pricing?billing=canceled`,
    allow_promotion_codes: true,
    subscription_data: { metadata: { supabase_user_id: user.id } },
  });

  return NextResponse.json({ url: session.url });
}
