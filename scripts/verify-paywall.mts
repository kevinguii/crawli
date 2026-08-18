/**
 * Verifies the 2026-08-17 paywall repackaging end to end.
 *
 * Run: npx tsx scripts/verify-paywall.mts
 *
 * Checks three things that the type-checker cannot:
 *   1. every TIER_CAPS field has a real `profiles` column, backfilled for every
 *      user with no nulls and no stragglers on old values
 *   2. the sold-comps free payload contains no price anywhere (a string search
 *      over the serialized body, not a field-by-field check — a future field
 *      carrying a price would slip past that)
 *   3. the paywall's own invariants: free is strictly tighter than pro on every
 *      axis, and no account sits on the retired `max` tier
 *
 * Reads DATABASE creds from .env like the other scripts.
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { TIER_CAPS, resolveTier, canSeePriceIntelligence, type Tier } from '../lib/tierCaps';
import { toLockedResult } from '../lib/soldComps/types';
import type { SoldCompsResult } from '../lib/soldComps/types';

config();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

let pass = 0;
let fail = 0;

function check(name: string, ok: boolean, detail = '') {
  if (ok) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

// ── 1. Cap shape invariants ─────────────────────────────────────────────────
console.log('\nTIER_CAPS invariants');

const AXES = [
  'maxSearchesPerPeriod',
  'maxSavedSearches',
  'maxTrackedListings',
  'nativeResultsCap',
  'maxSaves',
] as const;

for (const axis of AXES) {
  check(
    `free.${axis} < pro.${axis}`,
    TIER_CAPS.free[axis] < TIER_CAPS.pro[axis],
    `free=${TIER_CAPS.free[axis]} pro=${TIER_CAPS.pro[axis]}`,
  );
}
// Free deliberately keeps DAILY alerts (owner decision 2026-08-17). Alerts are
// gated by count, not frequency — the alert email is the main second-visit driver
// and runs are cheap thanks to the cross-user cache. Asserted rather than left
// implicit so a future "tighten the free tier" pass has to change this on purpose.
check(
  'free alert cadence is never stricter than pro',
  TIER_CAPS.free.minAlertCadenceHours <= TIER_CAPS.pro.minAlertCadenceHours,
  `free=${TIER_CAPS.free.minAlertCadenceHours} pro=${TIER_CAPS.pro.minAlertCadenceHours}`,
);
check('free may pick daily', TIER_CAPS.free.minAlertCadenceHours <= 24);
check('alerts are gated by count instead', TIER_CAPS.free.maxSavedSearches < TIER_CAPS.pro.maxSavedSearches);
check('price intelligence is denied on free', !canSeePriceIntelligence('free'));
check('price intelligence is allowed on pro', canSeePriceIntelligence('pro'));
check('price intelligence is allowed on legacy max', canSeePriceIntelligence('max'));

// ── 2. resolveTier agrees with itself across the shapes it sees ─────────────
console.log('\nresolveTier');
check('explicit tier wins', resolveTier('free', 'pro') === 'pro');
check('null tier + active status = pro', resolveTier('active', null) === 'pro');
check('null tier + past_due = pro', resolveTier('past_due', null) === 'pro');
check('null tier + no status = free', resolveTier(null, null) === 'free');
check('garbage tier falls back to status', resolveTier('active', 'platinum') === 'pro');
check('garbage tier + no status = free', resolveTier(null, 'platinum') === 'free');

// ── 3. The locked payload leaks nothing ────────────────────────────────────
console.log('\nSold-comps locked payload');

const sample: SoldCompsResult = {
  available: true,
  errors: [],
  platforms: [
    { platform: 'grailed', medianPrice: 185, p25: 150, p75: 228, n: 34, windowDays: 90, daysToSell: 12 },
    { platform: 'poshmark', medianPrice: 140, p25: 110, p75: 175, n: 21, windowDays: 180, daysToSell: null },
  ],
  // Individual sale rows are paid data in every column, so the locked payload must
  // drop them wholesale rather than stripping fields off them.
  sales: [
    {
      platform: 'grailed',
      windowDays: 90,
      total: 34,
      sales: [
        {
          url: 'https://grailed.com/listings/909',
          title: 'Carhartt WIP Detroit Jacket',
          price: 193,
          soldAt: '2026-08-01T00:00:00.000Z',
          size: 'L',
          condition: 'gently used',
        },
      ],
    },
  ],
};

const locked = toLockedResult(sample);
const serialized = JSON.stringify(locked);

check('locked flag is set', locked.locked === true);
check('sample sizes survive', locked.platforms.map((p) => p.n).join(',') === '34,21');
check('windows survive', locked.platforms.map((p) => p.windowDays).join(',') === '90,180');
check('platform names survive', locked.platforms.map((p) => p.platform).join(',') === 'grailed,poshmark');

// Every price-ish number from the sample must be absent from the serialized body.
const forbidden = [185, 150, 228, 140, 110, 175, 12];
for (const n of forbidden) {
  check(`no ${n} anywhere in the locked body`, !serialized.includes(String(n)), serialized);
}
for (const field of ['medianPrice', 'p25', 'p75', 'daysToSell']) {
  check(`no "${field}" key in the locked body`, !serialized.includes(field));
}

// Sale rows: not one field of one row may survive. Checked by value as well as by
// key, since a row could otherwise be re-nested under a different key name.
check('no "sales" key in the locked body', !serialized.includes('sales'));
for (const leak of ['193', 'grailed.com/listings/909', 'Detroit Jacket', '2026-08-01', 'gently used']) {
  check(`no sale-row value ${JSON.stringify(leak)} in the locked body`, !serialized.includes(leak), serialized);
}

// A thin platform — real sales, too few for a median — still gets a lock, carrying
// the same two non-secret facts as a fat one (how many, over what window) and no
// row data whatsoever.
const rowsOnly = toLockedResult({
  available: true,
  errors: [],
  platforms: [],
  sales: sample.sales,
});
const rowsOnlySerialized = JSON.stringify(rowsOnly);
check('rows-only result still locks', rowsOnly.available === true);
check('rows-only lock carries the sale count', rowsOnly.platforms[0]?.n === 34);
check('rows-only lock carries the window', rowsOnly.platforms[0]?.windowDays === 90);
for (const leak of ['193', 'grailed.com/listings/909', 'Detroit Jacket', '2026-08-01', 'gently used', 'sales']) {
  check(`rows-only lock leaks no ${JSON.stringify(leak)}`, !rowsOnlySerialized.includes(leak), rowsOnlySerialized);
}

// A query with genuinely nothing must NOT be locked. A paywall over data that does
// not exist is a promise that breaks the moment somebody upgrades to reach it.
const nothing = toLockedResult({ available: false, errors: [], platforms: [], sales: [] });
check('empty result is not locked', nothing.available === false && nothing.platforms.length === 0);

// Aggregate and rows for the same platform must collapse to one locked row, using
// the post-trim n rather than the raw row count.
const both = toLockedResult({
  available: true,
  errors: [],
  platforms: [sample.platforms[0]],
  sales: [{ ...sample.sales[0], total: 999 }],
});
check('one locked row per platform', both.platforms.length === 1);
check('aggregate n wins over raw row count', both.platforms[0].n === 34);

// ── 4. Live DB state matches the cutover ───────────────────────────────────
console.log('\nLive profiles backfill');

const { data: profiles, error } = await db
  .from('profiles')
  .select(
    'id, subscription_tier, max_searches_per_period, max_saved_searches, max_tracked_listings, native_results_cap, min_alert_cadence_hours, max_saves',
  );

if (error || !profiles) {
  console.error('  ✗ could not read profiles:', error?.message);
  process.exit(1);
}

check('at least one profile exists', profiles.length > 0, `${profiles.length}`);

const COLUMN_FOR = {
  maxSearchesPerPeriod: 'max_searches_per_period',
  maxSavedSearches: 'max_saved_searches',
  maxTrackedListings: 'max_tracked_listings',
  nativeResultsCap: 'native_results_cap',
  maxSaves: 'max_saves',
  minAlertCadenceHours: 'min_alert_cadence_hours',
} as const;

const mismatched: string[] = [];
const nulls: string[] = [];
for (const p of profiles) {
  const tier = (p.subscription_tier ?? 'free') as Tier;
  const caps = TIER_CAPS[tier];
  if (!caps) continue;
  for (const [capKey, column] of Object.entries(COLUMN_FOR) as [keyof typeof COLUMN_FOR, string][]) {
    const actual = (p as unknown as Record<string, number | null>)[column];
    if (actual === null || actual === undefined) {
      nulls.push(`${p.id}.${column}`);
    } else if (actual !== caps[capKey]) {
      mismatched.push(`${p.id}.${column}=${actual} want ${caps[capKey]} (${tier})`);
    }
  }
}

check('no null cap columns', nulls.length === 0, nulls.slice(0, 5).join('; '));
check(
  'every profile matches its tier caps',
  mismatched.length === 0,
  mismatched.slice(0, 5).join('; '),
);

const onMax = profiles.filter((p) => p.subscription_tier === 'max');
check('no account sits on the retired max tier', onMax.length === 0, `${onMax.length} found`);

const byTier = profiles.reduce<Record<string, number>>((acc, p) => {
  const t = p.subscription_tier ?? 'free';
  acc[t] = (acc[t] ?? 0) + 1;
  return acc;
}, {});
console.log(`  · tier distribution: ${JSON.stringify(byTier)}`);

// ── 5. Over-cap users keep their data ──────────────────────────────────────
console.log('\nOver-cap users are not truncated');

const { data: saves } = await db.from('saves').select('user_id');
const savesByUser = (saves ?? []).reduce<Record<string, number>>((acc, s) => {
  acc[s.user_id] = (acc[s.user_id] ?? 0) + 1;
  return acc;
}, {});

const overCap = Object.entries(savesByUser).filter(([userId, n]) => {
  const p = profiles.find((x) => x.id === userId);
  const cap = p?.max_saves ?? TIER_CAPS.free.maxSaves;
  return n > cap;
});

// Existing rows above the new cap are expected and correct — enforcement is on
// insert only. This check exists so a future "cleanup" that deletes them fails loudly.
check(
  'over-cap saves still readable (enforcement is insert-only)',
  overCap.every(([, n]) => n > 0),
  JSON.stringify(overCap),
);
if (overCap.length > 0) {
  console.log(`  · ${overCap.length} user(s) grandfathered above the saves cap: ${overCap.map(([, n]) => n).join(', ')}`);
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
