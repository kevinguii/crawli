/**
 * Local end-to-end test for the prepaid credit-pack webhook grant.
 *
 * WHY THIS EXISTS: Stripe cannot deliver webhooks to localhost, so a test
 * purchase in `npm run dev` completes on Stripe but never grants credits unless
 * `stripe listen` is forwarding. This script sidesteps that entirely: it builds
 * a `checkout.session.completed` event with the SAME shape the real credits
 * checkout produces (mode=payment, client_reference_id, metadata.credit_pack),
 * signs it with the official Stripe test-signature helper using your local
 * STRIPE_WEBHOOK_SECRET, and POSTs it straight to the running dev server's
 * webhook. It then re-sends the identical event to prove the idempotency guard
 * skips the duplicate (no double-grant).
 *
 * Run (dev server must be up on :3000):
 *   node --env-file=.env scripts/test-credit-webhook.mjs <USER_ID> [pack]
 *   pack defaults to "small" (100 credits).
 */
import Stripe from 'stripe';

const USER_ID = process.argv[2];
const PACK = process.argv[3] || 'small';
const URL = process.env.WEBHOOK_URL || 'http://localhost:3000/api/webhooks/stripe';

if (!USER_ID) {
  console.error('usage: node --env-file=.env scripts/test-credit-webhook.mjs <USER_ID> [small|medium|large]');
  process.exit(1);
}

const secret = process.env.STRIPE_WEBHOOK_SECRET;
const apiKey = process.env.STRIPE_SECRET_KEY;
if (!secret || !apiKey) {
  console.error('Missing STRIPE_WEBHOOK_SECRET or STRIPE_SECRET_KEY in env. Did you pass --env-file=.env ?');
  process.exit(1);
}

const stripe = new Stripe(apiKey);

const eventId = 'evt_test_credit_' + Date.now();
const event = {
  id: eventId,
  object: 'event',
  api_version: '2024-06-20',
  type: 'checkout.session.completed',
  data: {
    object: {
      id: 'cs_test_' + Date.now(),
      object: 'checkout.session',
      mode: 'payment',
      client_reference_id: USER_ID,
      customer: 'cus_test_local',
      payment_status: 'paid',
      status: 'complete',
      metadata: { supabase_user_id: USER_ID, credit_pack: PACK },
    },
  },
};
const payload = JSON.stringify(event);

async function send(label) {
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret });
  const res = await fetch(URL, {
    method: 'POST',
    headers: { 'stripe-signature': header, 'content-type': 'application/json' },
    body: payload,
  });
  console.log(`[${label}] event=${eventId} -> HTTP ${res.status} ${await res.text()}`);
}

await send('first delivery  ');
await send('duplicate replay'); // identical event id -> idempotency guard should skip
console.log('\nNow verify profiles.search_credits for the user increased by exactly one pack.');
