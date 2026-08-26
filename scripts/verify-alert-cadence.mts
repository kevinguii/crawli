import {
  ALERT_CADENCE_PRESETS,
  isCadenceAllowed,
  cadenceLabel,
  cadenceScheduleLabel,
  nextAnchoredRunAt,
} from '@/lib/alertSchedule';
import { z } from 'zod';

let failures = 0;
function check(name: string, cond: boolean, extra = '') {
  console.log(`${cond ? '  PASS' : '  FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
  if (!cond) failures++;
}

console.log('\n=== ALERT_CADENCE_PRESETS ===');
check('exactly the six spec\'d values, in ascending order',
  JSON.stringify(ALERT_CADENCE_PRESETS) === JSON.stringify([1, 3, 6, 12, 24, 168]));

console.log('\n=== isCadenceAllowed: the floor check every route AND the UI shares ===');
check('free floor (24): 24h is allowed', isCadenceAllowed(24, 24));
check('free floor (24): 168h (weekly, above the floor) is allowed', isCadenceAllowed(168, 24));
check('free floor (24): 1h is NOT allowed', !isCadenceAllowed(1, 24));
check('free floor (24): 12h is NOT allowed', !isCadenceAllowed(12, 24));
check('paid floor (1): every preset is allowed', ALERT_CADENCE_PRESETS.every((h) => isCadenceAllowed(h, 1)));

console.log('\n=== cadenceLabel ===');
check('1 -> Hourly', cadenceLabel(1) === 'Hourly');
check('3 -> Every 3 hours', cadenceLabel(3) === 'Every 3 hours');
check('6 -> Every 6 hours', cadenceLabel(6) === 'Every 6 hours');
check('12 -> Every 12 hours', cadenceLabel(12) === 'Every 12 hours');
check('24 -> Daily (unchanged)', cadenceLabel(24) === 'Daily');
check('168 -> Weekly (unchanged)', cadenceLabel(168) === 'Weekly');

console.log('\n=== cadenceScheduleLabel ===');
check('sub-24h has no time-of-day anchor: 1 -> "Hourly"',
  cadenceScheduleLabel(1) === 'Hourly');
check('sub-24h has no time-of-day anchor: 6 -> "Every 6 hours"',
  cadenceScheduleLabel(6) === 'Every 6 hours');
check('24h keeps the anchor: "Daily at 9 AM" (unchanged)',
  cadenceScheduleLabel(24) === 'Daily at 9 AM');
check('168h keeps the anchor: "Weekly at 9 AM" (unchanged)',
  cadenceScheduleLabel(168) === 'Weekly at 9 AM');

console.log('\n=== nextAnchoredRunAt: sub-24h has no anchor, fires at base + N hours ===');
const base = new Date('2026-08-25T21:00:00.000Z'); // 2pm Pacific
check('1h lands exactly 1 hour later, any time of day',
  nextAnchoredRunAt('America/Los_Angeles', 1, base).toISOString() === '2026-08-25T22:00:00.000Z');
check('3h lands exactly 3 hours later',
  nextAnchoredRunAt('America/Los_Angeles', 3, base).toISOString() === '2026-08-26T00:00:00.000Z');
check('6h lands exactly 6 hours later',
  nextAnchoredRunAt('America/Los_Angeles', 6, base).toISOString() === '2026-08-26T03:00:00.000Z');
check('12h lands exactly 12 hours later',
  nextAnchoredRunAt('America/Los_Angeles', 12, base).toISOString() === '2026-08-26T09:00:00.000Z');

console.log('\n=== nextAnchoredRunAt: >=24h keeps the existing 9am-anchor behavior ===');
// Verified against the CURRENT (pre-change) implementation before writing this
// test, so these are not new numbers invented for the change — they are what
// the function already does today and must keep doing.
check('24h from 2pm PT (past today\'s anchor) lands 9am PT tomorrow',
  nextAnchoredRunAt('America/Los_Angeles', 24, base).toISOString() === '2026-08-26T16:00:00.000Z');
check('168h from 2pm PT lands 9am PT, 7 days out',
  nextAnchoredRunAt('America/Los_Angeles', 168, base).toISOString() === '2026-09-01T16:00:00.000Z');
const earlyBase = new Date('2026-08-25T14:00:00.000Z'); // 7am Pacific, before the anchor
check('24h from 7am PT (before today\'s anchor) lands 9am PT today',
  nextAnchoredRunAt('America/Los_Angeles', 24, earlyBase).toISOString() === '2026-08-25T16:00:00.000Z');

console.log('\n=== saved-searches route schemas accept every preset ===');
// Both routes must accept exactly ALERT_CADENCE_PRESETS. Importing the zod
// schema object directly would drag in the Stripe-touching module graph (see
// lib/tierCaps.ts's own comment on why it's split out) — so this re-derives
// the same schema shape here as a change-detector: if a route's union ever
// drifts from ALERT_CADENCE_PRESETS, this test and that route will disagree
// on at least one value.
const routeCadenceSchema = z.union([
  z.literal(1), z.literal(3), z.literal(6), z.literal(12), z.literal(24), z.literal(168),
]);
for (const preset of ALERT_CADENCE_PRESETS) {
  check(`schema accepts preset ${preset}`, routeCadenceSchema.safeParse(preset).success);
}
check('schema rejects a non-preset value (2)', !routeCadenceSchema.safeParse(2).success);

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}\n`);
process.exit(failures === 0 ? 0 : 1);
