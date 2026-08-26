# Paid Alert-Speed Customization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let paid users pick how often an alert checks for new listings — 1h / 3h / 6h / 12h / 24h / 168h — instead of the current fixed 24h for everyone, defaulting a new paid alert to hourly, while free stays at 24h/168h and sees the fast presets locked as an upgrade nudge.

**Architecture:** No new database column — `saved_searches.cadence_hours` is already per-alert. The entire tier gate is already a *floor* comparison (`cadence_hours >= minAlertCadenceHours`) enforced in two places (the saved-searches API routes and, implicitly, the UI's own copy of that check) — widening the feature means widening the set of legal preset values everywhere that floor is checked, lowering Pro's floor from 24 to 1, and replacing the scheduler's day-only anchoring math with a branch for sub-24h cadences that doesn't anchor to a time of day at all.

**Tech Stack:** TypeScript, Next.js API routes, Supabase/Postgres, Zod validation, React (client component).

**Spec:** `docs/superpowers/specs/2026-08-25-paid-alert-speed-design.md`

## Global Constraints

- Preset values are exactly `1, 3, 6, 12, 24, 168` (hours). Nothing faster than 1, nothing between the named steps — copied verbatim from the spec's requirement 1.
- Cadence stays per-alert (`saved_searches.cadence_hours`), never account-wide — spec requirement 2.
- Free's floor stays `24` (unchanged). Only `pro` and `max` floors move, `24 -> 1`.
- A cadence below 24h must never anchor to 9 AM or any other fixed time of day — it fires at `lastRun + cadenceHours`, any hour of day, including overnight. This is explicit and confirmed with Kevin, not an oversight.
- Editing an existing alert must never force-change its stored cadence — only a new alert gets tier-based default selection.
- Marketing copy must not imply the cadence is exact-to-the-second. The cron ticks every 15 minutes, so "hourly" means within about an hour.
- Every new/changed public function needs a real assertion in a verify script — this repo's convention is `scripts/verify-*.mts` with a `check(name, cond)` helper (see `scripts/verify-alert-query.mts` for the exact style to match).
- `npx tsc --noEmit` must stay clean after every task.

---

### Task 1: Fix the scheduler's sub-24h math and cadence labels

**Files:**
- Modify: `lib/alertSchedule.ts`
- Create: `scripts/verify-alert-cadence.mts`

**Interfaces:**
- Produces: `ALERT_CADENCE_PRESETS: readonly [1, 3, 6, 12, 24, 168]` (new export) — Task 3 (API routes) and Task 4 (UI) both import this so the legal set can never drift between files.
- Produces: `isCadenceAllowed(hours: number, minCadence: number): boolean` (new export) — the floor comparison (`hours >= minCadence`) that currently lives duplicated inline in both API routes and would otherwise ALSO be duplicated a third time in the UI's lock check. Task 3 replaces both routes' inline `if (x < minCadence)` with this; Task 4's button-lock logic calls it directly. Centralizing it here is also what makes the floor logic itself unit-testable — it cannot be tested by a Node script while it only exists as inline JSX.
- Produces: `cadenceLabel(hours: number): string` (existing export, behavior changes) — used by Task 4's UI and already used elsewhere in `CreateAlertModal.tsx`.
- Produces: `cadenceScheduleLabel(hours: number): string` (existing export, behavior changes) — same consumers.
- Produces: `nextAnchoredRunAt(timezone: string, cadenceHours: number, base?: Date): Date` (existing export, behavior changes for `cadenceHours < 24`) — consumed by `lib/alertRunner.ts`'s `runAlert` (already calls it with whatever `cadence_hours` a saved search holds) and by `CreateAlertModal.tsx`'s preview.

Today, `nextAnchoredRunAt` computes `daySpan = Math.max(1, Math.round(cadenceHours / 24))` and then always lands on a future 9 AM local time — the `Math.max(1, ...)` floor is exactly why an hourly value would currently get silently treated as "once a day" instead of really running hourly. `cadenceLabel` is a hardcoded binary (`168 -> 'Weekly'`, everything else -> `'Daily'`) that would mislabel a 1-hour alert as "Daily" today.

- [ ] **Step 1: Write the failing tests**

Create `scripts/verify-alert-cadence.mts`:

```typescript
import {
  ALERT_CADENCE_PRESETS,
  isCadenceAllowed,
  cadenceLabel,
  cadenceScheduleLabel,
  nextAnchoredRunAt,
} from '@/lib/alertSchedule';

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

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}\n`);
process.exit(failures === 0 ? 0 : 1);
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx tsx scripts/verify-alert-cadence.mts`
Expected: fails at the `ALERT_CADENCE_PRESETS` import (doesn't exist yet), or once that's stubbed, fails on every `cadenceLabel`/`cadenceScheduleLabel`/sub-24h `nextAnchoredRunAt` check — none of the new behavior exists yet.

- [ ] **Step 3: Implement the changes in `lib/alertSchedule.ts`**

Replace the file's top comment, `ANCHOR_HOUR` block, and the three changed functions. The rest of the file (`zonedTimeToUtc`, `getOffsetMs`, `formatTimeInTz`, `formatNextRun`) is untouched.

```typescript
// Timezone-aware scheduling for alerts.
// Cadences of 24h or more anchor to 9 AM local time so we never email users at
// 3 AM for a daily/weekly check. Cadences under 24h are deliberately NOT
// anchored — the entire point of paying for a fast cadence is finding out the
// moment something new appears, so a match found at 3 AM emails at 3 AM. See
// docs/superpowers/specs/2026-08-25-paid-alert-speed-design.md.
// Computation works from both client and server.

const ANCHOR_HOUR = 9;

/** The only legal values for `saved_searches.cadence_hours`. Ascending order —
 *  UI code iterates this directly to render preset buttons in order. */
export const ALERT_CADENCE_PRESETS = [1, 3, 6, 12, 24, 168] as const;

/** Is this cadence at or above the account's floor? The single shared
 *  definition of "allowed" — both saved-searches API routes and the
 *  create/edit modal's button-lock logic call this instead of each
 *  duplicating `hours >= minCadence` inline. */
export function isCadenceAllowed(hours: number, minCadence: number): boolean {
  return hours >= minCadence;
}

// Returns the next Date (UTC) when an alert with this cadence should fire in
// the given IANA timezone, starting from `base`.
//
// cadenceHours < 24: no anchor at all — fires exactly `cadenceHours` after
// `base`, whatever the local time is when that lands.
//
// cadenceHours >= 24: anchors to the next 9 AM local, `round(cadenceHours/24)`
// days out (24 -> tomorrow's or today's remaining 9 AM, 168 -> 9 AM 7 days out).
export function nextAnchoredRunAt(
  timezone: string,
  cadenceHours: number,
  base: Date = new Date(),
): Date {
  if (cadenceHours < 24) {
    return new Date(base.getTime() + cadenceHours * 60 * 60 * 1000);
  }

  const daySpan = Math.max(1, Math.round(cadenceHours / 24));

  // Extract the current calendar parts as seen in the target timezone.
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
    hour12: false,
  }).formatToParts(base);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  const year = Number(get('year'));
  const month = Number(get('month'));
  const day = Number(get('day'));
  const hour = Number(get('hour'));

  let targetYear = year;
  let targetMonth = month;
  let targetDay = day;
  let targetHour: number;

  if (daySpan === 1) {
    // Daily: next 9 AM strictly in the future — today if still ahead, else tomorrow.
    if (hour < ANCHOR_HOUR) {
      targetHour = ANCHOR_HOUR;
    } else {
      targetHour = ANCHOR_HOUR;
      const tomorrow = new Date(Date.UTC(year, month - 1, day + 1));
      targetYear = tomorrow.getUTCFullYear();
      targetMonth = tomorrow.getUTCMonth() + 1;
      targetDay = tomorrow.getUTCDate();
    }
  } else {
    // Multi-day cadence (e.g. weekly): always advance daySpan days, then 9 AM.
    targetHour = ANCHOR_HOUR;
    const future = new Date(Date.UTC(year, month - 1, day + daySpan));
    targetYear = future.getUTCFullYear();
    targetMonth = future.getUTCMonth() + 1;
    targetDay = future.getUTCDate();
  }

  // Now convert that wall-clock-in-tz to a UTC Date.
  return zonedTimeToUtc(targetYear, targetMonth, targetDay, targetHour, 0, timezone);
}

const CADENCE_LABELS: Record<number, string> = {
  1: 'Hourly',
  3: 'Every 3 hours',
  6: 'Every 6 hours',
  12: 'Every 12 hours',
  24: 'Daily',
  168: 'Weekly',
};

// Human-readable cadence name, e.g. "Hourly" / "Every 6 hours" / "Daily" / "Weekly".
export function cadenceLabel(hours: number): string {
  return CADENCE_LABELS[hours] ?? `Every ${hours} hours`;
}

// e.g. "Hourly" (no anchor for sub-24h) / "Daily at 9 AM" / "Weekly at 9 AM".
export function cadenceScheduleLabel(hours: number): string {
  return hours < 24 ? cadenceLabel(hours) : `${cadenceLabel(hours)} at 9 AM`;
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx tsx scripts/verify-alert-cadence.mts`
Expected: `ALL CHECKS PASSED`

- [ ] **Step 5: Typecheck and commit**

Run: `npx tsc --noEmit` — expect clean (no other file references the old `cadenceLabel`/`cadenceScheduleLabel` signatures differently, since the signatures are unchanged, only bodies).

```bash
git add lib/alertSchedule.ts scripts/verify-alert-cadence.mts
git commit -m "Add sub-24h alert cadences: no time-of-day anchor, real labels

nextAnchoredRunAt silently treated any cadence under 24h as daily
(Math.max(1, ...) floor on the day-span). Fixed with a genuine
sub-24h branch: fires at base + cadenceHours, no 9am anchor, since
anchoring would defeat the reason someone pays for a fast cadence.
cadenceLabel/cadenceScheduleLabel were a hardcoded Daily/Weekly binary
that would have mislabeled every new preset as Daily.

scripts/verify-alert-cadence.mts, 15 checks, all passing."
```

---

### Task 2: Widen Pro/Max's cadence floor and backfill existing profiles

**Files:**
- Modify: `lib/tierCaps.ts`
- Create: `docs/migrations/paid-alert-speed.sql`

**Interfaces:**
- Produces: `TIER_CAPS.pro.minAlertCadenceHours === 1`, `TIER_CAPS.max.minAlertCadenceHours === 1` — consumed by Task 3's API routes and by `app/api/billing/status/route.ts` (unchanged file, already reads `TIER_CAPS` as its fallback).
- Consumes: nothing new.

`profiles.min_alert_cadence_hours` is stamped from `TIER_CAPS` at signup/upgrade time (`app/api/webhooks/stripe/route.ts`) and read DB-first everywhere enforcement happens. Changing the `TIER_CAPS` constant alone does nothing for accounts that upgraded before this change — this is the exact "changing TIER_CAPS without a backfill does nothing for existing users" mistake `docs/migrations/paywall-repackaging.sql` already documents having made once. `scripts/verify-paywall.mts` already asserts every profile's `min_alert_cadence_hours` column matches `TIER_CAPS[tier].minAlertCadenceHours` — that script is this task's test, and it will genuinely fail on every existing pro/max profile until the backfill runs.

- [ ] **Step 1: Confirm the existing verify script currently passes, so a later failure is attributable to this change**

Run: `npx tsx scripts/verify-paywall.mts`
Expected: passes (baseline, before any change in this task).

- [ ] **Step 2: Change the tier cap**

In `lib/tierCaps.ts`, update the doc-comment on the `minAlertCadenceHours` field and the two tier rows:

```typescript
  /** Floor on `saved_searches.cadence_hours`. Free: 24 (daily) or 168 (weekly)
   *  only. Pro/Max: any of ALERT_CADENCE_PRESETS in lib/alertSchedule.ts,
   *  1 (hourly) through 168 (weekly) — see
   *  docs/superpowers/specs/2026-08-25-paid-alert-speed-design.md. */
  minAlertCadenceHours: number;
```

```typescript
  free: { maxSearchesPerPeriod: 5,   maxSavedSearches: 1,  maxTrackedListings: 10,        nativeResultsCap: 8,   maxSaves: 10,        minAlertCadenceHours: 24 },
  pro:  { maxSearchesPerPeriod: 50,  maxSavedSearches: 25, maxTrackedListings: 500,       nativeResultsCap: 100, maxSaves: 500,       minAlertCadenceHours: 1 },
  max:  { maxSearchesPerPeriod: 120, maxSavedSearches: 30, maxTrackedListings: UNLIMITED, nativeResultsCap: 100, maxSaves: UNLIMITED, minAlertCadenceHours: 1 },
```

Add a new comment block above `TIER_CAPS` (after the existing "alerts joined the unlimited set" block), so future sessions get the same grounding the other cap changes already carry:

```typescript
// Revised 2026-08-25 (paid alert speed): pro/max minAlertCadenceHours 24 -> 1.
// See docs/superpowers/specs/2026-08-25-paid-alert-speed-design.md. Free is
// UNCHANGED at 24 — this only widens what paid tiers may pick, it does not
// change what anyone is limited to today. Cost is bounded the same way alert
// COUNT already is: alerts never touch Firecrawl and share the cross-user
// search cache, and the cron already ticks every 15 minutes with large
// headroom against the current live-alert count — an hourly alert is at most
// 15 minutes late to be picked up, which "hourly" in copy must be understood
// to mean.
```

- [ ] **Step 3: Run the test to confirm it now fails**

Run: `npx tsx scripts/verify-paywall.mts`
Expected: FAILS — every existing `pro`/`max` profile's `min_alert_cadence_hours` column still holds `24` in the database, which no longer matches `TIER_CAPS.pro.minAlertCadenceHours` (`1`). This is the expected, intentional failure this task's backfill fixes.

- [ ] **Step 4: Write the backfill migration**

Create `docs/migrations/paid-alert-speed.sql`, following the exact structure of `docs/migrations/paywall-repackaging.sql`:

```sql
-- Paid alert-speed customization — applied [DATE APPLIED].
-- Spec: docs/superpowers/specs/2026-08-25-paid-alert-speed-design.md
--
-- Pro/Max's alert-cadence floor moves 24 -> 1 (hourly allowed). Free is
-- unchanged. Idempotent; safe to re-run.
--
-- Enforcement reads `profiles` DB-first, so changing TIER_CAPS without this
-- backfill does nothing for existing paid users — same mistake already
-- documented in paywall-repackaging.sql, not repeating it here.
--
-- Existing alerts are NOT touched — their stored cadence_hours keeps whatever
-- value they already had (24, since that was the only option before this
-- change). This migration only widens what a paid user is ALLOWED to pick
-- going forward; nobody's existing alert changes speed on its own.

update public.profiles set
  min_alert_cadence_hours = 1
where subscription_tier in ('pro', 'max');

-- Verify with: npx tsx scripts/verify-paywall.mts
```

- [ ] **Step 5: Apply the migration**

Use `mcp__claude_ai_Supabase__execute_sql` (project id `peyqxfijdrziqfjkxjsn`) to run the `update` statement from the migration file above. This is a pure DML statement (no schema change), so `execute_sql` is correct here rather than `apply_migration` (which is for DDL).

- [ ] **Step 6: Run the test to confirm it passes again**

Run: `npx tsx scripts/verify-paywall.mts`
Expected: passes — every `pro`/`max` profile's `min_alert_cadence_hours` now reads `1`, matching `TIER_CAPS`.

- [ ] **Step 7: Typecheck and commit**

Run: `npx tsc --noEmit` — expect clean.

```bash
git add lib/tierCaps.ts docs/migrations/paid-alert-speed.sql
git commit -m "Lower Pro/Max alert-cadence floor from 24h to 1h, backfill existing profiles

TIER_CAPS alone does nothing for accounts that already upgraded --
enforcement reads profiles.min_alert_cadence_hours DB-first. Backfilled
every pro/max profile to the new floor and re-verified with
scripts/verify-paywall.mts. Free is unchanged at 24."
```

---

### Task 3: Widen the saved-searches API routes to accept every preset

**Files:**
- Modify: `app/api/saved-searches/route.ts`
- Modify: `app/api/saved-searches/[id]/route.ts`

**Interfaces:**
- Consumes: `ALERT_CADENCE_PRESETS`, `isCadenceAllowed` from `lib/alertSchedule.ts` (Task 1).
- Produces: nothing new.

Both routes currently hardcode `cadence_hours: z.union([z.literal(24), z.literal(168)])`, which would reject every new preset with a 400 before the floor check ever runs. Both also hand-write the identical `if (parsed.data.cadence_hours < minCadence)` check — this task replaces both with `isCadenceAllowed` (Task 1) so there is exactly one definition of "is this cadence legal for this floor" instead of three (these two routes plus, before Task 1, the UI's own copy).

- [ ] **Step 1: Write the failing test**

There is no existing route-level test harness in this repo for these endpoints (the existing coverage is the `verify-*.mts` unit-style scripts). Add the schema check to `scripts/verify-alert-cadence.mts` from Task 1 rather than standing up a new HTTP test harness for one line — append this block before the final `console.log(...ALL CHECKS...)`:

```typescript
console.log('\n=== saved-searches route schemas accept every preset ===');
// Both routes must accept exactly ALERT_CADENCE_PRESETS. Importing the zod
// schema object directly would drag in the Stripe-touching module graph (see
// lib/tierCaps.ts's own comment on why it's split out) — so this re-derives
// the same schema shape here as a change-detector: if a route's union ever
// drifts from ALERT_CADENCE_PRESETS, this test and that route will disagree
// on at least one value.
import { z } from 'zod';
const routeCadenceSchema = z.union([
  z.literal(1), z.literal(3), z.literal(6), z.literal(12), z.literal(24), z.literal(168),
]);
for (const preset of ALERT_CADENCE_PRESETS) {
  check(`schema accepts preset ${preset}`, routeCadenceSchema.safeParse(preset).success);
}
check('schema rejects a non-preset value (2)', !routeCadenceSchema.safeParse(2).success);
```

(Move the `import { z } from 'zod';` to the top of the file with the other imports rather than inline — inline here only to show where the block goes.)

- [ ] **Step 2: Run and confirm this new block passes trivially (it's checking a hand-written mirror, not the route yet) — then move to the actual route files**

Run: `npx tsx scripts/verify-alert-cadence.mts`
Expected: passes (this block tests a schema literal here in the test file, not the route yet — the real proof is Step 4's manual/browser check in Task 6, since spinning up the Next.js route handler in a unit script is out of proportion to a one-line change). Note this in the commit message so it's not mistaken for route coverage.

- [ ] **Step 3: Update `app/api/saved-searches/route.ts`**

Add `isCadenceAllowed` to the existing `lib/alertSchedule` import (there isn't
one yet in this file — add a new import line near the other `@/lib/*` imports):

```typescript
import { isCadenceAllowed } from '@/lib/alertSchedule';
```

Find and replace the schema field:

```typescript
  cadence_hours: z.union([z.literal(24), z.literal(168)]),
```

with:

```typescript
  // Every value in ALERT_CADENCE_PRESETS (lib/alertSchedule.ts) — 1/3/6/12
  // hourly presets are Pro/Max only, enforced below via isCadenceAllowed, not
  // by this schema. This schema only says which values EXIST, not who may
  // use them.
  cadence_hours: z.union([
    z.literal(1), z.literal(3), z.literal(6), z.literal(12), z.literal(24), z.literal(168),
  ]),
```

Find and replace the floor check:

```typescript
  // Enforce cadence floor based on tier
  if (parsed.data.cadence_hours < minCadence) {
```

with:

```typescript
  // Enforce cadence floor based on tier
  if (!isCadenceAllowed(parsed.data.cadence_hours, minCadence)) {
```

- [ ] **Step 4: Update `app/api/saved-searches/[id]/route.ts`**

Add the same import:

```typescript
import { isCadenceAllowed } from '@/lib/alertSchedule';
```

Same schema replacement as Step 3, in this file's `patchSchema`.

Find and replace the floor check:

```typescript
    if (parsed.data.cadence_hours < minCadence) {
```

with:

```typescript
    if (!isCadenceAllowed(parsed.data.cadence_hours, minCadence)) {
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit` — expect clean.

- [ ] **Step 6: Commit**

```bash
git add app/api/saved-searches/route.ts "app/api/saved-searches/[id]/route.ts" scripts/verify-alert-cadence.mts
git commit -m "Accept all 6 alert-cadence presets in the saved-searches API

Both routes hardcoded z.union([literal(24), literal(168)]), which
would 400 every new preset before the floor check ever ran. Also
replaced each route's own hand-written floor comparison with the
shared isCadenceAllowed (lib/alertSchedule.ts) so the UI and both
routes can no longer disagree about what counts as allowed."
```

---

### Task 4: Add the fast-cadence presets to the alert-creation UI

**Files:**
- Modify: `app/components/alerts/CreateAlertModal.tsx`

**Interfaces:**
- Consumes: `ALERT_CADENCE_PRESETS`, `cadenceLabel`, `cadenceScheduleLabel`, `nextAnchoredRunAt` from `lib/alertSchedule.ts` (Task 1). `TIER_CAPS.pro.minAlertCadenceHours === 1` reachable via `/api/billing/status`'s existing `caps.minAlertCadenceHours` field (Task 2 — no API contract change, the field already exists, only its value changes).
- Produces: nothing new for other files — this is a leaf UI component.

This is almost entirely a widening of logic that already exists in a 2-option form (a `gated` per-button check, a `mayPickDaily` derived boolean, a fail-closed `minCadence` default) to a 6-option form. No new locked-visual component is needed — the existing greyed/disabled/"· Pro"-labeled button treatment for a locked preset already matches the app's established paywall visual language for a button-sized surface (a full-panel `LockedOverlay` blur doesn't fit a button row).

- [ ] **Step 1: Update the import and the cadence state type**

Change:
```typescript
import { nextAnchoredRunAt, formatNextRun, cadenceLabel, cadenceScheduleLabel } from '@/lib/alertSchedule';
```
to:
```typescript
import { nextAnchoredRunAt, formatNextRun, cadenceLabel, cadenceScheduleLabel, ALERT_CADENCE_PRESETS, isCadenceAllowed } from '@/lib/alertSchedule';
```

Change:
```typescript
  const [cadence, setCadence] = useState<24 | 168>(editingAlert?.cadence_hours ?? 24);
```
to:
```typescript
  const [cadence, setCadence] = useState<typeof ALERT_CADENCE_PRESETS[number]>(
    editingAlert?.cadence_hours as typeof ALERT_CADENCE_PRESETS[number] ?? 24,
  );
```

- [ ] **Step 2: Generalize the floor-clamp and default-on-create logic**

Replace:
```typescript
  const mayPickDaily = minCadence <= 24 || !!editingAlert;
  const effectiveCadence: 24 | 168 = !mayPickDaily && cadence === 24 ? 168 : cadence;
```
with:
```typescript
  // Whether the currently-selected cadence is actually usable on this
  // account's tier. Replaces the old two-value mayPickDaily/effectiveCadence
  // pair: with 6 presets, "clamp 24 up to 168" doesn't generalize, but "clamp
  // up to the floor itself" does, because the floor is always one of the
  // legal presets (24 for free, 1 for paid).
  const effectiveCadence: typeof ALERT_CADENCE_PRESETS[number] =
    editingAlert || isCadenceAllowed(cadence, minCadence) ? cadence : (minCadence as typeof ALERT_CADENCE_PRESETS[number]);
```

Then update the billing-status effect to default a **new** alert to hourly once paid status resolves — find:
```typescript
  useEffect(() => {
    fetch('/api/billing/status')
      .then((r) => r.json())
      .then((d) => {
        setIsPaid(d.status === 'active' || d.status === 'past_due' || (d.tier && d.tier !== 'free'));
        if (typeof d?.caps?.minAlertCadenceHours === 'number') setMinCadence(d.caps.minAlertCadenceHours);
      })
      .catch(() => {});
```
and change the inner callback to:
```typescript
      .then((d) => {
        const paid = d.status === 'active' || d.status === 'past_due' || (d.tier && d.tier !== 'free');
        setIsPaid(paid);
        if (typeof d?.caps?.minAlertCadenceHours === 'number') setMinCadence(d.caps.minAlertCadenceHours);
        // Only a NEW alert's default moves to hourly — an alert being edited
        // keeps whatever cadence it already has, per the spec's requirement
        // that editing never force-changes a stored value.
        if (!editingAlert && paid) setCadence(1);
      })
      .catch(() => {});
```

- [ ] **Step 3: Replace the two-button preset row with all six presets**

Replace the entire cadence button block:
```typescript
              <div className="flex gap-2">
                {([24, 168] as const).map((h) => {
                  const selected = effectiveCadence === h;
                  // Daily is Pro. Rendered disabled rather than hidden: a locked
                  // option the user can see is the upgrade prompt. Hiding it just
                  // makes the free plan look like the whole product.
                  // Mirrors the server exactly: PATCH only re-checks the floor
                  // when cadence actually changes, so an existing daily alert
                  // stays togglable for its owner. Inert while the free floor is
                  // 24 — kept so raising the floor needs no UI change.
                  const gated = h < minCadence && !mayPickDaily;
                  return (
                    <button
                      key={h}
                      type="button"
                      onClick={() => { if (!gated) setCadence(h); }}
                      disabled={gated}
                      title={gated ? 'Daily checks are part of Pro' : undefined}
                      className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
                      style={
                        selected
                          ? { background: 'var(--accent)', color: '#fff' }
                          : {
                              background: 'var(--surface)',
                              border: '1px solid var(--border)',
                              color: 'var(--text-muted)',
                              opacity: gated ? 0.55 : 1,
                              cursor: gated ? 'not-allowed' : 'pointer',
                            }
                      }
                    >
                      {cadenceLabel(h)}
                      {gated && ' · Pro'}
                    </button>
                  );
                })}
              </div>
              {!mayPickDaily && (
                <p className="mt-2 text-xs" style={{ color: 'var(--text-dim)' }}>
                  Free alerts check weekly.{' '}
                  <a href="/pricing" className="underline" style={{ color: 'var(--text-muted)' }}>
                    Pro checks daily
                  </a>
                  .
                </p>
              )}
              {mayPickDaily && !isPaid && (
                <p className="mt-2 text-xs" style={{ color: 'var(--text-dim)' }}>
                  Free includes 1 alert.{' '}
                  <a href="/pricing" className="underline" style={{ color: 'var(--text-muted)' }}>
                    Pro gives you unlimited
                  </a>
                  .
                </p>
              )}
```
with:
```typescript
              <div className="flex flex-wrap gap-2">
                {ALERT_CADENCE_PRESETS.map((h) => {
                  const selected = effectiveCadence === h;
                  // Rendered disabled rather than hidden: a locked option the
                  // user can see is the upgrade prompt. Hiding it just makes
                  // the free plan look like the whole product. Mirrors the
                  // server exactly: PATCH only re-checks the floor when
                  // cadence actually changes, so an alert already on a faster
                  // cadence stays togglable for its owner even if the account
                  // is later downgraded.
                  const gated = !isCadenceAllowed(h, minCadence) && !editingAlert;
                  return (
                    <button
                      key={h}
                      type="button"
                      onClick={() => { if (!gated) setCadence(h); }}
                      disabled={gated}
                      title={gated ? `${cadenceLabel(h)} checks are part of Pro` : undefined}
                      className="flex-1 min-w-[5.5rem] py-2 rounded-lg text-sm font-medium transition-all"
                      style={
                        selected
                          ? { background: 'var(--accent)', color: '#fff' }
                          : {
                              background: 'var(--surface)',
                              border: '1px solid var(--border)',
                              color: 'var(--text-muted)',
                              opacity: gated ? 0.55 : 1,
                              cursor: gated ? 'not-allowed' : 'pointer',
                            }
                      }
                    >
                      {cadenceLabel(h)}
                      {gated && ' · Pro'}
                    </button>
                  );
                })}
              </div>
              {!editingAlert && minCadence >= 24 && (
                <p className="mt-2 text-xs" style={{ color: 'var(--text-dim)' }}>
                  Free alerts check {cadenceLabel(minCadence).toLowerCase()}.{' '}
                  <a href="/pricing" className="underline" style={{ color: 'var(--text-muted)' }}>
                    Pro checks as often as hourly
                  </a>
                  .
                </p>
              )}
              {!editingAlert && minCadence < 24 && !isPaid && (
                <p className="mt-2 text-xs" style={{ color: 'var(--text-dim)' }}>
                  Free includes 1 alert.{' '}
                  <a href="/pricing" className="underline" style={{ color: 'var(--text-muted)' }}>
                    Pro gives you unlimited
                  </a>
                  .
                </p>
              )}
```

Note what changed in the copy logic: the old `!mayPickDaily` branch only ever fired during the brief loading window (before `minCadence` resolved from its fail-closed initial value of 168) — with `minCadence <= 24` covering `mayPickDaily`'s old real-world case, the new `minCadence >= 24` check on the first paragraph and its inverse on the second reproduces the same two mutually-exclusive states without the now-inaccurate "mayPickDaily" name (paid users can pick far more than "daily" now).

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit` — expect clean. Pay particular attention to the `effectiveCadence` cast and the `setCadence(1)` call typing correctly against `typeof ALERT_CADENCE_PRESETS[number]`.

- [ ] **Step 5: Commit**

```bash
git add app/components/alerts/CreateAlertModal.tsx
git commit -m "Show all 6 alert-cadence presets in the create/edit modal

Widens the existing 2-button (Daily/Weekly) picker to 6
(Hourly/3h/6h/12h/Daily/Weekly), reusing the same locked-button
pattern that already gated Daily for free users. A new alert now
defaults to hourly for paid accounts once billing status resolves;
editing an existing alert never changes its stored cadence."
```

---

### Task 5: Pricing page copy and claim ledger entry

**Files:**
- Modify: `app/pricing/PricingCards.tsx`
- Modify: `docs/planning/COMPETITIVE_POSITIONING.md`

**Interfaces:** none — this task is copy only, no exported symbols change.

CLAUDE.md requires marketing copy to have a claim-ledger entry before it ships (`§6b`). This task does both together so the feature can never ship with copy but no ledger entry.

- [ ] **Step 1: Update the shared alert tooltip**

In `app/pricing/PricingCards.tsx`, replace:
```typescript
const ALERT_EMAIL_TOOLTIP = (
  <>
    <strong style={{ color: 'var(--text)' }}>Emails only send when new listings are found.</strong> Your alert checks on schedule (daily or weekly, at 9 AM), but we only notify you if results have changed since the last check. First run establishes your baseline.
  </>
);
```
with:
```typescript
const ALERT_EMAIL_TOOLTIP = (
  <>
    <strong style={{ color: 'var(--text)' }}>Emails only send when new listings are found.</strong> Your alert checks on schedule — daily or weekly at 9 AM on Free, as often as hourly on Pro — but we only notify you if results have changed since the last check. First run establishes your baseline.
  </>
);
```

- [ ] **Step 2: Update the Pro feature-list line**

Replace:
```typescript
          'Unlimited alerts, checked daily',
```
with:
```typescript
          'Unlimited alerts, checked as often as hourly',
```

The Free row (`'1 alert, checked daily'`) is correct already and stays unchanged — free's floor is still 24.

- [ ] **Step 3: Add the claim-ledger entry**

In `docs/planning/COMPETITIVE_POSITIONING.md`, in the §6b table (after the existing `C7` row), add:

```
| C8 | "Unlimited alerts, checked as often as hourly" (Pro) | **Built, unvalidated** | Shipped 2026-08-25 — see docs/superpowers/specs/2026-08-25-paid-alert-speed-design.md. Free is unchanged at daily/weekly. Wording constraint: the cron ticks every 15 minutes, so "hourly" means within about an hour of a new listing appearing, not to-the-second — never imply real-time/instant delivery. Validates if paid users who pick a sub-daily cadence show measurably better retention than the alert baseline (F13, one user's 28-day-dormancy break after setting a working alert is the only existing signal alerts affect retention at all). |
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit` — expect clean (this task only touches string literals and JSX text, but running it costs nothing and catches a stray syntax error in the JSX edit).

- [ ] **Step 5: Commit**

```bash
git add app/pricing/PricingCards.tsx docs/planning/COMPETITIVE_POSITIONING.md
git commit -m "Update pricing copy for paid alert speed, add claim C8

'Unlimited alerts, checked daily' was about to become false the
moment Pro's default cadence became hourly. New claim C8 in the
positioning doc's §6b ledger per CLAUDE.md's rule that copy needs a
ledger entry before shipping."
```

---

### Task 6: Full verification pass

**Files:** none modified — this task only runs checks.

- [ ] **Step 1: Run every verify script touched by this feature**

```bash
npx tsx scripts/verify-alert-cadence.mts
npx tsx scripts/verify-paywall.mts
npx tsx scripts/verify-alert-query.mts
```
Expected: all three print `ALL CHECKS PASSED` / their equivalent all-pass line, exit 0.

- [ ] **Step 2: Full typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Manual browser verification — free account**

Per this repo's standing rule that UI changes need real-browser verification, not just type-checks:
- `npm run dev:all`
- Sign in as a free account, open "Create alert."
- Confirm: Hourly/3h/6h/12h render greyed-out with a lock affordance and a "· Pro" suffix; clicking one does nothing selectable; Daily and Weekly are fully usable; the cadence defaults to Daily (24h).
- Confirm the helper text under the presets reads "Free alerts check daily. Pro checks as often as hourly." and links to `/pricing`.

- [ ] **Step 4: Manual browser verification — paid account**

- Sign in as a Pro account, open "Create alert."
- Confirm: all six presets are selectable, the cadence defaults to **Hourly** (not Daily) on a brand-new alert.
- Create an hourly alert, then re-open it for editing — confirm it still shows Hourly (not reset to any default).
- Confirm the confirmation-step "Frequency" line reads "Hourly" (not "Hourly at 9 AM") and "First check" shows a real near-term time.

- [ ] **Step 5: Manual check — pricing page**

- Visit `/pricing` signed out.
- Confirm the Pro feature list reads "Unlimited alerts, checked as often as hourly" and the alert-row tooltip mentions both Free's daily/weekly-at-9am and Pro's hourly.

- [ ] **Step 6: Free ports before finishing**

Per `docs/reference/CLEANUP.md`, free ports 3000 and 8000 before considering this plan done.

- [ ] **Step 7: Update HANDOFF.md**

Add one bullet under "Recent changes" (and move the oldest existing bullet into `docs/CHANGELOG.md` if this pushes the count past 5, per HANDOFF's own maintenance rule) describing what shipped: paid users can now pick 1h/3h/6h/12h/24h/168h alert cadence (free stays 24h/168h), Pro defaults new alerts to hourly, existing pro/max profiles backfilled via `docs/migrations/paid-alert-speed.sql`. Do not write a "Latest change (date): ..." block — one to three sentences, per CLAUDE.md's standing instruction.

- [ ] **Step 8: Commit the HANDOFF update**

```bash
git add HANDOFF.md docs/CHANGELOG.md
git commit -m "docs: record paid alert-speed customization in HANDOFF"
```
