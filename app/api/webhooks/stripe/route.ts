import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/admin';
import type Stripe from 'stripe';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const signature = req.headers.get('stripe-signature');
  if (!signature) return NextResponse.json({ error: 'no signature' }, { status: 400 });

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[stripe-webhook] STRIPE_WEBHOOK_SECRET not set');
    return NextResponse.json({ error: 'webhook not configured' }, { status: 500 });
  }

  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[stripe-webhook] signature verification failed:', msg);
    return NextResponse.json({ error: 'invalid signature' }, { status: 400 });
  }

  const admin = createAdminClient();

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id;
        const subscriptionId = session.subscription as string | null;
        if (!userId || !subscriptionId) break;

        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        await applySubscription(admin, userId, sub);
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.created': {
        const sub = event.data.object as Stripe.Subscription;
        const userId = (sub.metadata?.supabase_user_id as string) ?? await userIdFromCustomer(admin, sub.customer as string);
        if (!userId) break;
        await applySubscription(admin, userId, sub);
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const userId = (sub.metadata?.supabase_user_id as string) ?? await userIdFromCustomer(admin, sub.customer as string);
        if (!userId) break;
        await admin.from('profiles').update({
          subscription_status: 'free',
          subscription_price_id: null,
          subscription_period_end: null,
        }).eq('id', userId);
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        const userId = await userIdFromCustomer(admin, customerId);
        if (!userId) break;
        await admin.from('profiles').update({ subscription_status: 'past_due' }).eq('id', userId);
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error(`[stripe-webhook] handler failed for ${event.type}:`, err);
    return NextResponse.json({ error: 'handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function applySubscription(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  sub: Stripe.Subscription,
) {
  const priceId = sub.items.data[0]?.price.id ?? null;
  const periodEndUnix = (sub as unknown as { current_period_end?: number }).current_period_end;
  const periodEnd = periodEndUnix ? new Date(periodEndUnix * 1000).toISOString() : null;
  const status = sub.status === 'active' || sub.status === 'trialing' ? 'active' : sub.status;

  await admin.from('profiles').update({
    subscription_status: status,
    subscription_price_id: priceId,
    subscription_period_end: periodEnd,
  }).eq('id', userId);
}

async function userIdFromCustomer(
  admin: ReturnType<typeof createAdminClient>,
  customerId: string,
): Promise<string | null> {
  const { data } = await admin
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();
  return data?.id ?? null;
}
