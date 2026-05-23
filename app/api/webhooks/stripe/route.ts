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
    console.log(`[stripe-webhook] received ${event.type}`);
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id;
        const subscriptionId = session.subscription as string | null;
        console.log(`[stripe-webhook] checkout.session.completed userId=${userId} sub=${subscriptionId}`);
        if (!userId || !subscriptionId) {
          console.warn('[stripe-webhook] missing userId or subscriptionId — skipping');
          break;
        }

        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        await applySubscription(admin, userId, sub);
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.created': {
        const sub = event.data.object as Stripe.Subscription;
        const userId = (sub.metadata?.supabase_user_id as string) ?? await userIdFromCustomer(admin, sub.customer as string);
        console.log(`[stripe-webhook] ${event.type} userId=${userId} customer=${sub.customer}`);
        if (!userId) {
          console.warn('[stripe-webhook] could not resolve userId — skipping');
          break;
        }
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
      case 'invoice.payment_succeeded': {
        // Fires on every successful charge — initial subscription, renewals,
        // and recovery after past_due. We use it to reset the Pro user's
        // search quota for the new billing period. Free users reset via
        // calendar-based logic in /api/search (they never hit this code path).
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        const userId = await userIdFromCustomer(admin, customerId);
        console.log(`[stripe-webhook] invoice.payment_succeeded customer=${customerId} userId=${userId}`);
        if (!userId) break;
        const { error } = await admin.from('profiles').update({
          searches_used_this_period: 0,
          searches_period_start: new Date().toISOString(),
        }).eq('id', userId);
        if (error) {
          console.error(`[stripe-webhook] quota reset failed for user=${userId}:`, error);
        } else {
          console.log(`[stripe-webhook] quota reset for user=${userId}`);
        }
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
  const item = sub.items.data[0];
  const priceId = item?.price.id ?? null;
  const periodEndUnix =
    (item as unknown as { current_period_end?: number })?.current_period_end ??
    (sub as unknown as { current_period_end?: number }).current_period_end;
  const periodEnd = periodEndUnix ? new Date(periodEndUnix * 1000).toISOString() : null;
  const status = sub.status === 'active' || sub.status === 'trialing' ? 'active' : sub.status;
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;

  const { error, data } = await admin.from('profiles').update({
    subscription_status: status,
    subscription_price_id: priceId,
    subscription_period_end: periodEnd,
    stripe_customer_id: customerId,
  }).eq('id', userId).select();
  if (error) {
    console.error(`[stripe-webhook] supabase update failed for user=${userId}:`, error);
  } else {
    console.log(`[stripe-webhook] updated user=${userId} status=${status} rows=${data?.length ?? 0}`);
  }
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
