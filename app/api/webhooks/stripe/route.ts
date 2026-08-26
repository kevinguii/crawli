import { NextRequest, NextResponse } from 'next/server';
import { stripe, tierFromPriceId, TIER_CAPS } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/admin';
import { packById, searchesForPriceId } from '@/lib/creditPacks';
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

  // Idempotency: claim this event before processing. Stripe delivers at-least-once
  // (retries on non-2xx + occasional duplicates), and the credit-pack grant is a
  // non-idempotent read-modify-write, so a re-delivery must not double-grant. A
  // duplicate insert hits the PK conflict (23505) and we skip. If processing fails
  // below, we delete the claim so Stripe's retry can re-process.
  const { error: claimErr } = await admin
    .from('stripe_webhook_events')
    .insert({ event_id: event.id, type: event.type });
  if (claimErr) {
    if (claimErr.code === '23505') {
      console.log(`[stripe-webhook] duplicate ${event.type} ${event.id}: already processed, skipping`);
      return NextResponse.json({ received: true, duplicate: true });
    }
    // Couldn't record the claim for some other reason: log and process anyway
    // rather than wedging a legitimate event on a bookkeeping-table hiccup.
    console.error('[stripe-webhook] event claim insert failed (processing anyway):', claimErr);
  }

  try {
    console.log(`[stripe-webhook] received ${event.type}`);
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id
          ?? (session.metadata?.supabase_user_id as string | undefined)
          ?? null;

        // One-time payment = prepaid credit pack. Grant credits now that Stripe
        // has confirmed payment (cash collected before the searches are used).
        if (session.mode === 'payment') {
          await grantCreditPack(admin, userId, session);
          break;
        }

        const subscriptionId = session.subscription as string | null;
        console.log(`[stripe-webhook] checkout.session.completed userId=${userId} sub=${subscriptionId}`);
        if (!userId || !subscriptionId) {
          console.warn('[stripe-webhook] missing userId or subscriptionId: skipping');
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
          console.warn('[stripe-webhook] could not resolve userId: skipping');
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
          subscription_tier: 'free',
          max_searches_per_period: TIER_CAPS.free.maxSearchesPerPeriod,
          max_saved_searches: TIER_CAPS.free.maxSavedSearches,
          max_tracked_listings: TIER_CAPS.free.maxTrackedListings,
          native_results_cap: TIER_CAPS.free.nativeResultsCap,
          max_saves: TIER_CAPS.free.maxSaves,
          min_alert_cadence_hours: TIER_CAPS.free.minAlertCadenceHours,
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
        // Fires on every successful charge: initial subscription, renewals,
        // and recovery after past_due. Quota resets are now handled by a 7-day
        // rolling window in the search API, not by the billing cycle, so we
        // don't need to reset on invoice.payment_succeeded anymore.
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        const userId = await userIdFromCustomer(admin, customerId);
        console.log(`[stripe-webhook] invoice.payment_succeeded customer=${customerId} userId=${userId}`);
        if (!userId) break;
        // No quota reset needed: weekly resets are handled in the search API
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error(`[stripe-webhook] handler failed for ${event.type}:`, err);
    // Release the claim so Stripe's retry re-processes this event from scratch.
    await admin.from('stripe_webhook_events').delete().eq('event_id', event.id);
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

  // Active/trialing subs map to a real tier via price ID. Anything else
  // (past_due, canceled, unpaid, incomplete) drops to free caps so quotas
  // tighten immediately on failure: Stripe will re-emit an event with
  // a healthy status if the user recovers.
  const tier = status === 'active' ? tierFromPriceId(priceId) : 'free';
  const caps = TIER_CAPS[tier];
  console.log(`[stripe-webhook] applySubscription user=${userId} priceId=${priceId} status=${status} resolvedTier=${tier}`);
  const { error, data } = await admin.from('profiles').update({
    subscription_status: status,
    subscription_price_id: priceId,
    subscription_period_end: periodEnd,
    stripe_customer_id: customerId,
    subscription_tier: tier,
    max_searches_per_period: caps.maxSearchesPerPeriod,
    max_saved_searches: caps.maxSavedSearches,
    max_tracked_listings: caps.maxTrackedListings,
    native_results_cap: caps.nativeResultsCap,
    max_saves: caps.maxSaves,
    // Per-tier via TIER_CAPS rather than hardcoded, so a future cadence-floor
    // change here needs no code edit. Free currently matches pro at 24 (daily):
    // see the owner-decision note on TIER_CAPS in lib/tierCaps.ts.
    min_alert_cadence_hours: caps.minAlertCadenceHours,
  }).eq('id', userId).select();
  if (error) {
    console.error(`[stripe-webhook] supabase update failed for user=${userId}:`, error);
  } else {
    console.log(`[stripe-webhook] updated user=${userId} status=${status} tier=${tier} rows=${data?.length ?? 0}`);
  }
}

/**
 * Grant prepaid search credits for a completed one-time credit-pack checkout.
 * Resolves the pack from session metadata first (set by the credits route),
 * falling back to the line-item price ID. Increments profiles.search_credits.
 */
async function grantCreditPack(
  admin: ReturnType<typeof createAdminClient>,
  userId: string | null,
  session: Stripe.Checkout.Session,
) {
  const resolvedUserId = userId
    ?? await userIdFromCustomer(admin, session.customer as string);
  if (!resolvedUserId) {
    console.warn('[stripe-webhook] credit pack: could not resolve userId, skipping');
    return;
  }

  // Prefer the pack id stamped in metadata; fall back to the price ID.
  let searches = packById(session.metadata?.credit_pack ?? '')?.searches ?? 0;
  if (!searches) {
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 });
    const priceId = lineItems.data[0]?.price?.id ?? null;
    searches = searchesForPriceId(priceId);
  }

  if (!searches) {
    console.warn(`[stripe-webhook] credit pack: no searches resolved for session=${session.id}, skipping`);
    return;
  }

  // Read-modify-write the balance. Volume is low (manual purchases) so the race
  // window is negligible; revisit with an atomic RPC if packs get popular.
  const { data: profile } = await admin
    .from('profiles')
    .select('search_credits')
    .eq('id', resolvedUserId)
    .single();
  const current = profile?.search_credits ?? 0;

  const { error } = await admin
    .from('profiles')
    .update({ search_credits: current + searches })
    .eq('id', resolvedUserId);
  if (error) {
    console.error(`[stripe-webhook] credit grant failed for user=${resolvedUserId}:`, error);
  } else {
    console.log(`[stripe-webhook] granted ${searches} credits to user=${resolvedUserId} (now ${current + searches})`);
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
