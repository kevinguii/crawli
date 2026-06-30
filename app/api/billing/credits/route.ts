import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { stripe, resolveStripeCustomerId } from '@/lib/stripe';
import { packById, priceIdForPack } from '@/lib/creditPacks';

/**
 * One-time Stripe Checkout for a prepaid search credit pack (the debt-proof
 * overage path). mode='payment' — cash collected up front. The matching
 * `search_credits` are granted on the `checkout.session.completed` webhook, not
 * here, so credits are only ever added after Stripe confirms payment.
 *
 * Pack price IDs come from env vars (see lib/creditPacks.ts). If the env var is
 * unset (pack not provisioned in Stripe yet), this returns 503 rather than
 * creating a broken session.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const pack = packById(body?.pack);
  if (!pack) {
    return NextResponse.json({ error: 'pack must be one of: small, medium, large' }, { status: 400 });
  }

  const priceId = priceIdForPack(pack);
  if (!priceId) {
    return NextResponse.json(
      { error: 'pack_unavailable', message: 'This credit pack is not configured yet.' },
      { status: 503 },
    );
  }

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
    mode: 'payment',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    client_reference_id: user.id,
    success_url: `${origin}/settings?credits=success`,
    cancel_url: `${origin}/settings?credits=canceled`,
    // Echo identity + pack on the session so the webhook can grant credits even
    // if Stripe's customer→user mapping is ever ambiguous.
    metadata: { supabase_user_id: user.id, credit_pack: pack.id },
    payment_intent_data: { metadata: { supabase_user_id: user.id, credit_pack: pack.id } },
  });

  return NextResponse.json({ url: session.url });
}
