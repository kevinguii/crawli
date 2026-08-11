# Onboarding Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a blocking, persona-tailored onboarding flow that every user (new and existing) completes once, ending with a live alert and a hand-off to a pre-filled search.

**Architecture:** A DB flag (`profiles.onboarding_completed_at`) is the single gate, checked server-side in `app/(protected)/layout.tsx`. `/onboarding` lives **outside** `(protected)/` so it cannot be caught by its own gate and renders without `AppShell` navigation. A small client state machine walks 5 screens, persisting each advance through a new `PATCH /api/onboarding`. The flow consumes **zero search credits**: it calls the existing `POST /api/sold-comps` (free) and `POST /api/saved-searches` (free), and hands off to `/search` rather than running a search.

**Tech Stack:** Next.js 16.2.6 App Router · React 19 · TypeScript · Tailwind v4 · Supabase (Postgres + Auth) · zod

**Spec:** `docs/superpowers/specs/2026-08-10-onboarding-flow-design.md`

## Global Constraints

- **Do NOT modify** `app/api/search/route.ts` (fragile streaming NDJSON — CLAUDE.md rule 4).
- **Do NOT modify** `app/login/page.tsx` or `app/auth/callback/route.ts`. The gate is flag-driven; no `next` param is involved.
- **Do NOT modify** `lib/stripe.ts` `TIER_CAPS` or any pricing. Out of scope.
- **`handle_new_user()` must NOT hardcode the new columns** into its INSERT. Let column DEFAULTs apply. This exact pattern caused cap bugs on 2026-07-17 and 2026-07-23.
- **No test runner exists in this project.** Verification is `npx tsc --noEmit`, `npx eslint`, and a standalone `npx tsx scripts/verify-*.mts` script following the `scripts/verify-sold-comps.mts` pattern. Do **not** add vitest/jest.
- **Theming is CSS variables**, not Tailwind `dark:`. Use `var(--surface)`, `var(--border)`, `var(--text)`, `var(--text-dim)`, `var(--text-muted)`. `[data-theme="dark"]` lives on `<html>`.
- **Copy guardrails (§6b claim ledger).** The flow may NOT: name **Mercari** in any sold-comps context; show a **pooled cross-platform median**; say "**what it actually sold for**" about Poshmark; claim any **sell-through** figure; lead with "**best price**"; or imply four independent criteria fields (it is `size` + `minPrice` + `maxPrice` only).
- **Every step must advance even when its upstream call fails.** The flow is blocking; a dead-end step is a locked account.
- **Search quota must never gate onboarding, including for existing users who are near or at their weekly cap.** Onboarding calls `/api/sold-comps` and `/api/saved-searches`, neither of which reads `searches_used_this_period` or `search_credits` — only `/api/search` does, and onboarding never calls it. A user at 5/5 for the week must still complete every step and land on a working alert exactly like a user at 0/5. The one place this could silently regress is `AlertStep`'s `quota_exceeded` branch: that error comes from the **alert cap** (`max_saved_searches`, e.g. 2/2 on free), not the search cap — do not conflate the two when reading it.
- **No commits by the agent.** The owner owns all commits and pushes. Where steps below say "Commit", stage nothing and instead report the change set to the owner.
- **No Playwright.** Browser verification is the owner's, done manually.

---

## File Structure

| File | Responsibility |
|---|---|
| `docs/migrations/onboarding-columns.sql` | **Create.** Adds the 4 `profiles` columns. Applied via Supabase MCP. |
| `lib/onboarding.ts` | **Create.** Pure, dependency-free logic: step machine, persona type, gate predicate, constants. The only unit-testable surface. |
| `app/api/onboarding/route.ts` | **Create.** `PATCH` persona / step / completion. Auth-gated. Charges nothing. |
| `app/(protected)/layout.tsx` | **Modify.** Adds the gate redirect. ~8 lines. |
| `app/onboarding/page.tsx` | **Create.** Server component: auth guard, loads state, renders the flow. Outside `(protected)/`. |
| `app/onboarding/OnboardingFlow.tsx` | **Create.** Client state machine + shared chrome (progress, no nav). |
| `app/onboarding/steps/BranchStep.tsx` | **Create.** Screen 1: buyer vs reseller. |
| `app/onboarding/steps/SeedStep.tsx` | **Create.** Screen 2: what are you after. Persona-tailored copy + examples. |
| `app/onboarding/steps/CriteriaStep.tsx` | **Create.** Screen 3: size + min/max price. |
| `app/onboarding/steps/AlertStep.tsx` | **Create.** Screen 4: creates the alert. |
| `app/onboarding/steps/TailStep.tsx` | **Create.** Screen 5: persona-branched sold comps + margin. |
| `app/(protected)/settings/page.tsx` | **Modify.** Adds a "Redo setup" `Row` (the local `Row` component is at `:42`). |
| `scripts/verify-onboarding.mts` | **Create.** Unit checks for `lib/onboarding.ts` + live API checks. |

Tasks 1-2 are the risk-bearing ones (schema, and a gate that can lock every user out of the app). Tasks 4-7 are screens and can be reviewed independently.

---

## Task 1: Schema + pure onboarding logic

**Files:**
- Create: `docs/migrations/onboarding-columns.sql`
- Create: `lib/onboarding.ts`
- Create: `scripts/verify-onboarding.mts`

**Interfaces:**
- Consumes: nothing.
- Produces: `OnboardingPersona`, `OnboardingStepId`, `ONBOARDING_STEPS`, `ONBOARDING_TOTAL_STEPS`, `needsOnboarding()`, `nextStep()`, `stepIndex()`, `isTerminal()`. Every later task imports from `@/lib/onboarding`.

- [ ] **Step 1: Write the failing verification script**

Create `scripts/verify-onboarding.mts`:

```ts
import {
  ONBOARDING_STEPS,
  ONBOARDING_TOTAL_STEPS,
  needsOnboarding,
  nextStep,
  stepIndex,
  isTerminal,
} from '@/lib/onboarding';

let failures = 0;
function check(name: string, cond: boolean, extra = '') {
  console.log(`${cond ? '  PASS' : '  FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
  if (!cond) failures++;
}

console.log('\n=== unit: gate predicate ===');
check('null completed_at needs onboarding', needsOnboarding({ onboarding_completed_at: null }) === true);
check('set completed_at does not', needsOnboarding({ onboarding_completed_at: '2026-08-10T00:00:00Z' }) === false);

console.log('\n=== unit: step machine ===');
check('steps are the documented 5 + done', ONBOARDING_STEPS.length === 6);
check('total visible steps is 5', ONBOARDING_TOTAL_STEPS === 5);
check('branch is first', ONBOARDING_STEPS[0] === 'branch');
check('done is last', ONBOARDING_STEPS[ONBOARDING_STEPS.length - 1] === 'done');

check('branch -> seed (buyer)', nextStep('branch', 'buyer') === 'seed');
check('branch -> seed (reseller)', nextStep('branch', 'reseller') === 'seed');
check('seed -> criteria', nextStep('seed', 'buyer') === 'criteria');
check('criteria -> alert', nextStep('criteria', 'reseller') === 'alert');
check('alert -> tail', nextStep('alert', 'buyer') === 'tail');
check('tail -> done', nextStep('tail', 'reseller') === 'done');
check('done is terminal', nextStep('done', 'buyer') === 'done');

check('isTerminal only for done', isTerminal('done') === true && isTerminal('tail') === false);

console.log('\n=== unit: step index (resume + progress bar) ===');
check('stepIndex branch = 0', stepIndex('branch') === 0);
check('stepIndex tail = 4', stepIndex('tail') === 4);
check('stepIndex clamps unknown to 0', stepIndex('nonsense' as never) === 0);

console.log(`\n${failures === 0 ? 'ALL PASSED' : failures + ' FAILURE(S)'}\n`);
process.exit(failures === 0 ? 0 : 1);
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx tsx scripts/verify-onboarding.mts`
Expected: FAIL — `Cannot find module '@/lib/onboarding'`.

- [ ] **Step 3: Write the minimal implementation**

Create `lib/onboarding.ts`:

```ts
// Pure onboarding logic. No imports, no I/O — this is the only unit-testable
// surface in the feature, and scripts/verify-onboarding.mts covers it.
//
// The flow is BLOCKING (no skip, no exit until complete), so the step machine
// must always produce a reachable next state. There is deliberately no branch
// in the machine itself: both personas walk the same 5 screens and the
// tailoring lives in the screens' copy. Keeping the machine linear is what
// makes "can a user get stuck?" answerable by reading 20 lines.

export type OnboardingPersona = 'buyer' | 'reseller';

export type OnboardingStepId = 'branch' | 'seed' | 'criteria' | 'alert' | 'tail' | 'done';

export const ONBOARDING_STEPS: OnboardingStepId[] = [
  'branch',
  'seed',
  'criteria',
  'alert',
  'tail',
  'done',
];

/** Screens the user actually sees. 'done' is a terminal state, not a screen. */
export const ONBOARDING_TOTAL_STEPS = ONBOARDING_STEPS.length - 1;

/** The gate. Null completion timestamp means the user is blocked into the flow. */
export function needsOnboarding(profile: { onboarding_completed_at: string | null }): boolean {
  return profile.onboarding_completed_at === null;
}

/** Position of a step, used for the progress indicator and for resume-after-close.
 *  Unknown values clamp to 0 rather than throwing — a corrupt persisted step must
 *  restart the flow, never crash a blocking page. */
export function stepIndex(step: OnboardingStepId): number {
  const i = ONBOARDING_STEPS.indexOf(step);
  return i === -1 ? 0 : i;
}

export function isTerminal(step: OnboardingStepId): boolean {
  return step === 'done';
}

/** Linear advance. `persona` is accepted so callers do not need to know the
 *  machine is currently persona-independent; if a future branch is added, only
 *  this function changes. */
export function nextStep(step: OnboardingStepId, _persona: OnboardingPersona | null): OnboardingStepId {
  if (isTerminal(step)) return 'done';
  const i = stepIndex(step);
  return ONBOARDING_STEPS[Math.min(i + 1, ONBOARDING_STEPS.length - 1)];
}

/** Resume target for a persisted step index. Out-of-range restarts the flow. */
export function stepFromIndex(i: number): OnboardingStepId {
  if (!Number.isInteger(i) || i < 0 || i >= ONBOARDING_STEPS.length) return 'branch';
  return ONBOARDING_STEPS[i];
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx tsx scripts/verify-onboarding.mts`
Expected: `ALL PASSED`, exit 0.

- [ ] **Step 5: Write the migration**

Create `docs/migrations/onboarding-columns.sql`:

```sql
-- Onboarding flow state. See docs/superpowers/specs/2026-08-10-onboarding-flow-design.md.
--
-- onboarding_completed_at is THE GATE: null means the user is blocked into the flow.
-- Every existing account defaults to null, so the 39 current users are onboarded on
-- their next visit with no backfill required.
--
-- IMPORTANT: do NOT add these columns to handle_new_user()'s explicit INSERT list.
-- Hardcoding values there is what caused the free-tier cap bugs on 2026-07-17 and
-- 2026-07-23. New rows must fall through to these DEFAULTs.

alter table public.profiles
  add column if not exists onboarding_persona text
    check (onboarding_persona is null or onboarding_persona in ('buyer', 'reseller')),
  add column if not exists onboarding_started_at timestamptz,
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists onboarding_step integer not null default 0;

-- Column additions inherit public.profiles' existing table-level grants, so no new
-- GRANT is required here (the CLAUDE.md "RLS alone 503s" rule applies to new TABLES).
-- Verified after apply by reading the columns back as an authenticated user.
```

- [ ] **Step 6: Apply the migration and verify it live**

Apply with `mcp__supabase__apply_migration` (project `peyqxfijdrziqfjkxjsn`).

Then verify with `mcp__supabase__execute_sql`:

```sql
select column_name, data_type, column_default, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'profiles'
  and column_name like 'onboarding%'
order by column_name;
```

Expected: exactly 4 rows — `onboarding_completed_at` (timestamptz, null default), `onboarding_persona` (text, null), `onboarding_started_at` (timestamptz, null), `onboarding_step` (integer, default 0).

- [ ] **Step 7: Verify `handle_new_user()` was not disturbed**

Run with `mcp__supabase__execute_sql`:

```sql
select prosrc from pg_proc where proname = 'handle_new_user';
```

Expected: the function body contains **no** reference to any `onboarding` column. If it does, remove those references — new rows must use the DEFAULTs.

- [ ] **Step 8: Verify every existing user is gated in**

```sql
select count(*) as total,
       count(*) filter (where onboarding_completed_at is null) as will_be_onboarded
from public.profiles;
```

Expected: both numbers equal (39 at time of writing).

- [ ] **Step 9: Type check and report**

Run: `npx tsc --noEmit` → clean. Run: `npx eslint lib/onboarding.ts scripts/verify-onboarding.mts` → clean.

Report to owner: `docs/migrations/onboarding-columns.sql`, `lib/onboarding.ts`, `scripts/verify-onboarding.mts` added; migration applied to prod.

---

## Task 2: The gate and the un-gated route shell

This is the highest-risk task in the plan. A bug here locks every user out of the entire app.

**Files:**
- Create: `app/api/onboarding/route.ts`
- Create: `app/onboarding/page.tsx`
- Modify: `app/(protected)/layout.tsx`

**Interfaces:**
- Consumes: `needsOnboarding`, `stepFromIndex`, `OnboardingPersona`, `OnboardingStepId` from `@/lib/onboarding`.
- Produces: `PATCH /api/onboarding` accepting `{ persona?: 'buyer'|'reseller'; step?: number; complete?: true }` and returning `{ ok: true; state: { persona, step, startedAt, completedAt } }`. `app/onboarding/page.tsx` renders `<OnboardingFlow initialStep initialPersona replay />` (component built in Task 3 — stub it here).

- [ ] **Step 1: Create the state endpoint**

Create `app/api/onboarding/route.ts`:

```ts
// Onboarding state writes. Deliberately separate from every other route: it
// charges nothing, touches only the four profiles.onboarding_* columns, and is
// the single place onboarding_completed_at can be set.
//
// Does NOT consume a search credit. Nothing in the onboarding flow does —
// see the spec's cost model.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const bodySchema = z.object({
  persona: z.enum(['buyer', 'reseller']).optional(),
  step: z.number().int().min(0).max(5).optional(),
  complete: z.literal(true).optional(),
});

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const admin = createAdminClient();

  const patch: Record<string, unknown> = {};
  if (parsed.persona) patch.onboarding_persona = parsed.persona;
  if (parsed.step !== undefined) patch.onboarding_step = parsed.step;
  if (parsed.complete) patch.onboarding_completed_at = new Date().toISOString();

  // First write of the run stamps the start time, once.
  const { data: existing } = await admin
    .from('profiles')
    .select('onboarding_started_at')
    .eq('id', user.id)
    .single();
  if (!existing?.onboarding_started_at) patch.onboarding_started_at = new Date().toISOString();

  const { data, error } = await admin
    .from('profiles')
    .update(patch)
    .eq('id', user.id)
    .select('onboarding_persona, onboarding_step, onboarding_started_at, onboarding_completed_at')
    .single();

  if (error) {
    console.error(`[onboarding] state write failed for user=${user.id}:`, error);
    return NextResponse.json({ error: 'write_failed' }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    state: {
      persona: data.onboarding_persona,
      step: data.onboarding_step,
      startedAt: data.onboarding_started_at,
      completedAt: data.onboarding_completed_at,
    },
  });
}
```

- [ ] **Step 2: Create the un-gated page with a temporary stub body**

Create `app/onboarding/page.tsx`:

```tsx
// Lives OUTSIDE app/(protected)/ on purpose. Two reasons, both load-bearing:
//   1. It cannot be caught by its own gate, so the blocking redirect in
//      (protected)/layout.tsx cannot loop. Structural, not a conditional.
//   2. It renders without AppShell, so the sidebar's Search/Alerts/Saves/History
//      links are not on screen offering navigation the gate would bounce.

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { stepFromIndex, needsOnboarding } from '@/lib/onboarding';
import type { OnboardingPersona } from '@/lib/onboarding';

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ replay?: string }>;
}) {
  const { replay } = await searchParams;
  const isReplay = replay === '1';

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?error=session_expired');

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('onboarding_persona, onboarding_step, onboarding_completed_at')
    .eq('id', user.id)
    .single();

  // Already done and not an explicit replay? There is nothing to do here.
  if (profile && !needsOnboarding(profile) && !isReplay) redirect('/search');

  const initialStep = isReplay ? 'branch' : stepFromIndex(profile?.onboarding_step ?? 0);

  return (
    <main className="min-h-dvh" style={{ background: 'var(--bg)' }}>
      <div className="mx-auto w-full max-w-xl px-5 py-10">
        {/* Replaced by <OnboardingFlow /> in Task 3. */}
        <p style={{ color: 'var(--text)' }}>
          Onboarding shell. step={initialStep} persona=
          {(profile?.onboarding_persona as OnboardingPersona | null) ?? 'none'} replay=
          {String(isReplay)}
        </p>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Add the gate to the protected layout**

Modify `app/(protected)/layout.tsx`. Immediately after the existing `if (error || !data.user) redirect(...)` block and **before** the `return`, insert:

```tsx
  // Onboarding gate. Blocking by design: while onboarding_completed_at is null,
  // every protected route bounces here. /onboarding lives outside this layout so
  // it cannot catch itself — see app/onboarding/page.tsx.
  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_completed_at')
    .eq('id', data.user.id)
    .single();

  if (needsOnboarding({ onboarding_completed_at: profile?.onboarding_completed_at ?? null })) {
    redirect('/onboarding');
  }
```

And add to the imports at the top of that file:

```tsx
import { needsOnboarding } from '@/lib/onboarding';
```

Note this uses the **RLS-scoped** `supabase` client already in scope, not the admin client — the user is reading their own row, and a layout should not run with service-role privileges.

- [ ] **Step 4: Verify the RLS read actually works**

The gate silently redirects everyone to `/onboarding` if the profile read returns null under RLS. Confirm the policy allows self-select:

```sql
select polname, polcmd, pg_get_expr(polqual, polrelid) as using_expr
from pg_policy where polrelid = 'public.profiles'::regclass;
```

Expected: at least one `SELECT` policy whose expression resolves to `auth.uid() = id` (or equivalent). If none exists, the gate must use `createAdminClient()` instead — note the change in the report.

- [ ] **Step 5: Verify no loop and no lockout, manually**

Run `npm run dev`. With your own account:

1. `mcp__supabase__execute_sql`: `update profiles set onboarding_completed_at = null, onboarding_step = 0 where email = '<your email>';`
2. Visit `/search` → must land on `/onboarding` showing the stub, **not** an infinite redirect. Check the Network tab for a redirect loop.
3. Visit `/alerts`, `/saves`, `/watchlist`, `/profile`, `/settings`, `/search-history` directly by URL → each must redirect to `/onboarding`.
4. `update profiles set onboarding_completed_at = now() where email = '<your email>';`
5. Visit `/search` → loads normally. Visit `/onboarding` → redirects to `/search`. Visit `/onboarding?replay=1` → shows the stub.
6. **Near-quota check.** `update profiles set onboarding_completed_at = null, onboarding_step = 0, searches_used_this_period = max_searches_per_period where email = '<your email>';` — this account is now at its weekly search cap, same as several of the 39 existing users. Visit `/search` → still lands on `/onboarding`, same as step 2. The gate must not distinguish by quota state; it only reads `onboarding_completed_at`. Reset `searches_used_this_period` back to 0 afterward.

- [ ] **Step 6: Type check and report**

Run: `npx tsc --noEmit` → clean. Run: `npx eslint app/api/onboarding app/onboarding "app/(protected)/layout.tsx"` → clean.

Report the redirect-loop test results explicitly. Do not report this task complete on a type check alone.

---

## Task 3: Client state machine and shared chrome

**Files:**
- Create: `app/onboarding/OnboardingFlow.tsx`
- Modify: `app/onboarding/page.tsx` (swap the stub for the real component)

**Interfaces:**
- Consumes: `nextStep`, `stepIndex`, `ONBOARDING_TOTAL_STEPS`, `OnboardingStepId`, `OnboardingPersona` from `@/lib/onboarding`; `PATCH /api/onboarding` from Task 2.
- Produces: `OnboardingFlow` plus the shared `OnboardingDraft` shape and `StepProps` contract every step component in Tasks 4-7 implements:
  ```ts
  export interface OnboardingDraft {
    persona: OnboardingPersona | null;
    query: string;
    size: string | null;
    minPrice: number | null;
    maxPrice: number | null;
    alertCreated: boolean;
    closetQuery: string;
  }
  export interface StepProps {
    draft: OnboardingDraft;
    patch: (p: Partial<OnboardingDraft>) => void;
    advance: () => void;
    busy: boolean;
  }
  ```

- [ ] **Step 1: Create the flow component**

Create `app/onboarding/OnboardingFlow.tsx`:

```tsx
'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  nextStep,
  stepIndex,
  ONBOARDING_TOTAL_STEPS,
  type OnboardingPersona,
  type OnboardingStepId,
} from '@/lib/onboarding';

export interface OnboardingDraft {
  persona: OnboardingPersona | null;
  query: string;
  size: string | null;
  minPrice: number | null;
  maxPrice: number | null;
  alertCreated: boolean;
  closetQuery: string;
}

export interface StepProps {
  draft: OnboardingDraft;
  patch: (p: Partial<OnboardingDraft>) => void;
  advance: () => void;
  busy: boolean;
}

export default function OnboardingFlow({
  initialStep,
  initialPersona,
  replay,
}: {
  initialStep: OnboardingStepId;
  initialPersona: OnboardingPersona | null;
  replay: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState<OnboardingStepId>(initialStep);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<OnboardingDraft>({
    persona: initialPersona,
    query: '',
    size: null,
    minPrice: null,
    maxPrice: null,
    alertCreated: false,
    closetQuery: '',
  });

  const patch = useCallback((p: Partial<OnboardingDraft>) => {
    setDraft((d) => ({ ...d, ...p }));
  }, []);

  const advance = useCallback(async () => {
    setBusy(true);
    const target = nextStep(step, draft.persona);
    const done = target === 'done';

    // Persist, but NEVER let a failed write trap the user. The flow is blocking:
    // a dead-end step is a locked account. Advance regardless, and on the final
    // step retry once before giving up, because that write is the one that
    // clears the gate.
    const body: Record<string, unknown> = { step: stepIndex(target) };
    if (draft.persona) body.persona = draft.persona;
    if (done) body.complete = true;

    let ok = false;
    for (let attempt = 0; attempt < (done ? 2 : 1) && !ok; attempt++) {
      try {
        const res = await fetch('/api/onboarding', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        ok = res.ok;
      } catch {
        ok = false;
      }
    }

    if (done) {
      if (!ok) {
        // The gate did not clear. Sending them to /search would bounce them
        // straight back here, which reads as a freeze. Keep them on a screen
        // that explains itself and offers a retry.
        setBusy(false);
        setStep('tail');
        window.alert('Could not save your setup. Please try Finish again.');
        return;
      }
      const q = draft.query.trim();
      router.push(q ? `/search?q=${encodeURIComponent(q)}` : '/search');
      return;
    }

    setStep(target);
    setBusy(false);
  }, [step, draft.persona, draft.query, router]);

  const idx = stepIndex(step);

  return (
    <div>
      <div className="mb-8 flex items-center gap-2">
        {Array.from({ length: ONBOARDING_TOTAL_STEPS }).map((_, i) => (
          <span
            key={i}
            className="h-1 flex-1 rounded-full transition-colors"
            style={{ background: i <= idx ? 'var(--accent)' : 'var(--border)' }}
          />
        ))}
      </div>

      {replay && (
        <p className="mb-4 text-xs" style={{ color: 'var(--text-dim)' }}>
          Redoing setup. Your existing alerts are untouched.
        </p>
      )}

      {/* Step components are wired in Tasks 4-7. */}
      <StepSwitch step={step} draft={draft} patch={patch} advance={advance} busy={busy} />
    </div>
  );
}

function StepSwitch({ step, ...rest }: StepProps & { step: OnboardingStepId }) {
  switch (step) {
    default:
      return (
        <button
          type="button"
          disabled={rest.busy}
          onClick={rest.advance}
          className="rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-50"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          {rest.busy ? 'Saving…' : `Continue (${step})`}
        </button>
      );
  }
}
```

- [ ] **Step 2: Swap the stub in the page**

In `app/onboarding/page.tsx`, replace the placeholder `<p>…</p>` block with:

```tsx
        <OnboardingFlow
          initialStep={initialStep}
          initialPersona={(profile?.onboarding_persona as OnboardingPersona | null) ?? null}
          replay={isReplay}
        />
```

and add the import:

```tsx
import OnboardingFlow from './OnboardingFlow';
```

- [ ] **Step 3: Verify advance, persistence and resume**

Run `npm run dev`, reset your own flag to null, then:

1. Visit `/onboarding`, click Continue 5 times → lands on `/search`.
2. Check the DB: `select onboarding_step, onboarding_started_at, onboarding_completed_at from profiles where email = '<your email>';` → step 5, both timestamps set.
3. Reset to `onboarding_completed_at = null, onboarding_step = 2`, reload `/onboarding` → resumes at `criteria`, not `branch`.
4. With DevTools set to offline, click Continue → the step still advances (no trap). Restore network.

- [ ] **Step 4: Type check and report**

Run: `npx tsc --noEmit` → clean. `npx eslint app/onboarding` → clean.

---

## Task 4: Branch and seed screens (the tailoring)

**Files:**
- Create: `app/onboarding/steps/BranchStep.tsx`
- Create: `app/onboarding/steps/SeedStep.tsx`
- Modify: `app/onboarding/OnboardingFlow.tsx` (wire both into `StepSwitch`)

**Interfaces:**
- Consumes: `StepProps`, `OnboardingDraft` from `./OnboardingFlow`.
- Produces: `BranchStep`, `SeedStep`, both `(props: StepProps) => JSX.Element`.

Spec constraint D8: tailoring must be **visible**, not just logged. The persona answer changes `SeedStep`'s heading, helper text and example chips.

- [ ] **Step 1: Create BranchStep**

Create `app/onboarding/steps/BranchStep.tsx`:

```tsx
'use client';

import type { StepProps } from '../OnboardingFlow';
import type { OnboardingPersona } from '@/lib/onboarding';

const OPTIONS: { id: OnboardingPersona; label: string; sub: string }[] = [
  { id: 'buyer', label: 'For myself', sub: 'Hunting specific pieces across marketplaces' },
  { id: 'reseller', label: 'To resell', sub: 'Sourcing inventory to flip for profit' },
];

export default function BranchStep({ draft, patch, advance, busy }: StepProps) {
  return (
    <div>
      <h1 className="text-2xl font-semibold" style={{ color: 'var(--text)' }}>
        Are you buying for yourself, or to resell?
      </h1>
      <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
        This changes what we set up for you next.
      </p>

      <div className="mt-6 grid gap-3">
        {OPTIONS.map((o) => {
          const active = draft.persona === o.id;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => patch({ persona: o.id })}
              className="rounded-2xl px-4 py-4 text-left transition-colors"
              style={{
                background: 'var(--surface)',
                border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
              }}
            >
              <span className="block text-sm font-medium" style={{ color: 'var(--text)' }}>
                {o.label}
              </span>
              <span className="mt-0.5 block text-xs" style={{ color: 'var(--text-dim)' }}>
                {o.sub}
              </span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        disabled={!draft.persona || busy}
        onClick={advance}
        className="mt-6 w-full rounded-xl px-4 py-3 text-sm font-medium disabled:opacity-50"
        style={{ background: 'var(--accent)', color: '#fff' }}
      >
        {busy ? 'Saving…' : 'Continue'}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Create SeedStep with persona-tailored copy**

Create `app/onboarding/steps/SeedStep.tsx`:

```tsx
'use client';

import type { StepProps } from '../OnboardingFlow';

// Copy guardrails (§6b): no "best price" framing (C6 falsified), no sold-comps
// promise here (that lands in the tail), no Mercari.
const COPY = {
  buyer: {
    heading: 'What are you hunting?',
    sub: 'We watch 9 marketplaces at once, including ones the shopping extensions do not cover.',
    examples: ['carhartt wip jacket', 'levis 501', 'north face nuptse', 'sambas'],
  },
  reseller: {
    heading: 'What are you looking to source?',
    sub: 'We watch 9 marketplaces at once, including Grailed, Vinted and Vestiaire.',
    examples: ['supreme box logo hoodie', 'nike air jordan 1', 'bape shark hoodie', 'stone island'],
  },
} as const;

export default function SeedStep({ draft, patch, advance, busy }: StepProps) {
  const copy = COPY[draft.persona ?? 'buyer'];
  const valid = draft.query.trim().length > 0;

  return (
    <div>
      <h1 className="text-2xl font-semibold" style={{ color: 'var(--text)' }}>
        {copy.heading}
      </h1>
      <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
        {copy.sub}
      </p>

      <input
        value={draft.query}
        onChange={(e) => patch({ query: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && valid && !busy) advance();
        }}
        placeholder="e.g. carhartt wip jacket"
        maxLength={200}
        className="mt-6 w-full rounded-xl px-4 py-3 text-sm outline-none"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
      />

      <div className="mt-3 flex flex-wrap gap-2">
        {copy.examples.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => patch({ query: ex })}
            className="rounded-full px-3 py-1.5 text-xs"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-dim)' }}
          >
            {ex}
          </button>
        ))}
      </div>

      <button
        type="button"
        disabled={!valid || busy}
        onClick={advance}
        className="mt-6 w-full rounded-xl px-4 py-3 text-sm font-medium disabled:opacity-50"
        style={{ background: 'var(--accent)', color: '#fff' }}
      >
        {busy ? 'Saving…' : 'Continue'}
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Wire both into StepSwitch**

In `app/onboarding/OnboardingFlow.tsx`, add imports:

```tsx
import BranchStep from './steps/BranchStep';
import SeedStep from './steps/SeedStep';
```

and replace the `switch` body in `StepSwitch` with:

```tsx
  switch (step) {
    case 'branch':
      return <BranchStep {...rest} />;
    case 'seed':
      return <SeedStep {...rest} />;
    default:
      return (
        <button
          type="button"
          disabled={rest.busy}
          onClick={rest.advance}
          className="rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-50"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          {rest.busy ? 'Saving…' : `Continue (${step})`}
        </button>
      );
  }
```

- [ ] **Step 4: Verify the tailoring is visible**

Run `npm run dev`, reset your flag. Pick **For myself** → heading reads "What are you hunting?" with buyer examples. Restart the flow, pick **To resell** → heading reads "What are you looking to source?" with reseller examples. Confirm the persona persisted: `select onboarding_persona from profiles where email = '<your email>';`

- [ ] **Step 5: Type check and report**

Run: `npx tsc --noEmit` → clean. `npx eslint app/onboarding` → clean.

---

## Task 5: Criteria and alert creation

**Files:**
- Create: `app/onboarding/steps/CriteriaStep.tsx`
- Create: `app/onboarding/steps/AlertStep.tsx`
- Modify: `app/onboarding/OnboardingFlow.tsx` (wire both)

**Interfaces:**
- Consumes: `StepProps`; existing `POST /api/saved-searches`.
- Produces: `CriteriaStep`, `AlertStep`.

The alert POST body must match `createSchema` in `app/api/saved-searches/route.ts` exactly:
`{ query: string; platforms: string[]; criteria?: { size?, minPrice?, maxPrice? }; cadence_hours: 24 | 168; notify_timezone?: string }`.

`VALID_ALERT_PLATFORMS` is derived server-side from `PLATFORM_DOMAINS`. Onboarding sends the full native set so no platform-picking screen is needed (D8: keep it quick).

- [ ] **Step 1: Create CriteriaStep**

Create `app/onboarding/steps/CriteriaStep.tsx`:

```tsx
'use client';

import type { StepProps } from '../OnboardingFlow';

// Copy guardrail C3: this is size + minPrice + maxPrice ONLY. Brand and keywords
// live in the query string. Never imply four independent criteria fields.
export default function CriteriaStep({ draft, patch, advance, busy }: StepProps) {
  const bad = draft.minPrice !== null && draft.maxPrice !== null && draft.minPrice > draft.maxPrice;

  const num = (v: string): number | null => {
    const t = v.trim();
    if (t === '') return null;
    const n = Number(t);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold" style={{ color: 'var(--text)' }}>
        Narrow it down
      </h1>
      <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
        Optional. We match <strong>{draft.query || 'your search'}</strong> and everything you set
        here, together.
      </p>

      <label className="mt-6 block text-xs" style={{ color: 'var(--text-dim)' }}>
        Size
      </label>
      <input
        value={draft.size ?? ''}
        onChange={(e) => patch({ size: e.target.value.trim() === '' ? null : e.target.value })}
        placeholder="e.g. M"
        maxLength={40}
        className="mt-1 w-full rounded-xl px-4 py-3 text-sm outline-none"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
      />

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs" style={{ color: 'var(--text-dim)' }}>
            Min price
          </label>
          <input
            inputMode="decimal"
            defaultValue={draft.minPrice ?? ''}
            onChange={(e) => patch({ minPrice: num(e.target.value) })}
            placeholder="0"
            className="mt-1 w-full rounded-xl px-4 py-3 text-sm outline-none"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
          />
        </div>
        <div>
          <label className="block text-xs" style={{ color: 'var(--text-dim)' }}>
            Max price
          </label>
          <input
            inputMode="decimal"
            defaultValue={draft.maxPrice ?? ''}
            onChange={(e) => patch({ maxPrice: num(e.target.value) })}
            placeholder="Any"
            className="mt-1 w-full rounded-xl px-4 py-3 text-sm outline-none"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
          />
        </div>
      </div>

      {bad && (
        <p className="mt-2 text-xs" style={{ color: 'var(--danger)' }}>
          Min price is higher than max price.
        </p>
      )}

      <button
        type="button"
        disabled={bad || busy}
        onClick={advance}
        className="mt-6 w-full rounded-xl px-4 py-3 text-sm font-medium disabled:opacity-50"
        style={{ background: 'var(--accent)', color: '#fff' }}
      >
        {busy ? 'Saving…' : 'Continue'}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Create AlertStep**

Create `app/onboarding/steps/AlertStep.tsx`:

```tsx
'use client';

import { useState } from 'react';
import type { StepProps } from '../OnboardingFlow';

const ALERT_PLATFORMS = [
  'grailed',
  'depop',
  'poshmark',
  'mercari',
  'vinted',
  'thredup',
  'vestiaire',
  'stockx',
];

export default function AlertStep({ draft, patch, advance, busy }: StepProps) {
  const [creating, setCreating] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  async function createAlert() {
    setCreating(true);
    setFailed(null);
    try {
      const res = await fetch('/api/saved-searches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: draft.query.trim(),
          platforms: ALERT_PLATFORMS,
          criteria: {
            size: draft.size,
            minPrice: draft.minPrice,
            maxPrice: draft.maxPrice,
          },
          cadence_hours: 24,
          notify_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      if (res.ok) {
        patch({ alertCreated: true });
      } else {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        // quota_exceeded is a legitimate outcome for a user who already has 2
        // alerts (free cap) — it is not a failure of the flow.
        setFailed(body?.error === 'quota_exceeded'
          ? "You are already at your alert limit, so we did not add another."
          : 'We could not set that up just now.');
      }
    } catch {
      setFailed('We could not set that up just now.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold" style={{ color: 'var(--text)' }}>
        {draft.alertCreated ? 'Your alert is live' : 'Get told when one shows up'}
      </h1>
      <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
        {draft.alertCreated
          ? 'We check every morning and email you when something new matches. Check your inbox now for what matches today.'
          : 'We check 8 marketplaces every morning and email you when something new matches.'}
      </p>

      <div
        className="mt-6 rounded-2xl px-4 py-4"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>
          {draft.query}
        </span>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {draft.size && <Chip>size {draft.size}</Chip>}
          {draft.minPrice !== null && <Chip>min ${draft.minPrice}</Chip>}
          {draft.maxPrice !== null && <Chip>max ${draft.maxPrice}</Chip>}
        </div>
      </div>

      {failed && (
        <p className="mt-3 text-xs" style={{ color: 'var(--text-dim)' }}>
          {failed} You can carry on.
        </p>
      )}

      {!draft.alertCreated ? (
        <button
          type="button"
          disabled={creating || busy}
          onClick={createAlert}
          className="mt-6 w-full rounded-xl px-4 py-3 text-sm font-medium disabled:opacity-50"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          {creating ? 'Setting it up…' : 'Create this alert'}
        </button>
      ) : null}

      {/* Always available, even if creation failed: the flow is blocking and must
          never dead-end on an upstream error. */}
      <button
        type="button"
        disabled={busy || creating}
        onClick={advance}
        className="mt-3 w-full rounded-xl px-4 py-3 text-sm font-medium disabled:opacity-50"
        style={{
          background: draft.alertCreated ? 'var(--accent)' : 'transparent',
          border: draft.alertCreated ? 'none' : '1px solid var(--border)',
          color: draft.alertCreated ? '#fff' : 'var(--text-dim)',
        }}
      >
        {busy ? 'Saving…' : draft.alertCreated ? 'Continue' : 'Skip for now'}
      </button>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[11px]"
      style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-dim)' }}
    >
      {children}
    </span>
  );
}
```

- [ ] **Step 3: Wire both into StepSwitch**

Add imports to `app/onboarding/OnboardingFlow.tsx`:

```tsx
import CriteriaStep from './steps/CriteriaStep';
import AlertStep from './steps/AlertStep';
```

and add cases before `default:`:

```tsx
    case 'criteria':
      return <CriteriaStep {...rest} />;
    case 'alert':
      return <AlertStep {...rest} />;
```

- [ ] **Step 4: Verify the alert is really created and the baseline email fires**

Reset your flag, run the flow with a real query (`carhartt wip jacket`), size `M`, max price `200`.

1. `select query, criteria, cadence_hours from saved_searches order by created_at desc limit 1;` → matches what you entered, `criteria` holds `size`/`maxPrice`.
2. Check your inbox for the baseline email (shipped 2026-08-10 as EXP-003).
3. Repeat with an account already at the 2-alert free cap → the step shows the limit message and **still advances**.
4. **Near-quota check.** Set `searches_used_this_period = max_searches_per_period` on a free-tier test account (an existing user with 4-5 of their 5 weekly searches spent — this is the population the owner flagged, several of the current 39 are close to their cap), reset `onboarding_completed_at = null`, run the full flow to `AlertStep`, click **Create this alert**. Expected: **success**, same as step 1 above, because alert creation never reads `searches_used_this_period`. This is the primary proof for the "smooth alert setup regardless of quota" requirement — do not skip it.

- [ ] **Step 5: Type check and report**

Run: `npx tsc --noEmit` → clean. `npx eslint app/onboarding` → clean.

---

## Task 6: The tail — sold comps and margin, branched by persona

**Files:**
- Create: `app/onboarding/steps/TailStep.tsx`
- Modify: `app/onboarding/OnboardingFlow.tsx` (wire it)

**Interfaces:**
- Consumes: `StepProps`; `useSoldComps` from `@/lib/hooks/useSoldComps`; `SoldCompsPanel` from `@/app/components/SoldCompsPanel`; `netFlipProfit` and `FEE_PLATFORMS` from `@/lib/marketplaceFees`; `PlatformSoldStats` from `@/lib/soldComps/types`.
- Produces: `TailStep`. Last screen; its `advance()` sets `complete: true` and hands off to `/search`.

Reseller tail runs sold comps on `draft.query`. Buyer tail asks for a closet item first (`draft.closetQuery`) and runs sold comps on that — the buyer-to-reseller on-ramp.

`useSoldComps` already resolves to `null` on failure rather than throwing, and `SoldCompsPanel` returns `null` for an empty platform list, so the no-data path is inherited, not rebuilt. Both are required for the no-dead-end rule.

- [ ] **Step 1: Create TailStep**

Create `app/onboarding/steps/TailStep.tsx`:

```tsx
'use client';

import { useState } from 'react';
import type { StepProps } from '../OnboardingFlow';
import { useSoldComps } from '@/lib/hooks/useSoldComps';
import SoldCompsPanel from '@/app/components/SoldCompsPanel';
import { netFlipProfit } from '@/lib/marketplaceFees';
import type { PlatformSoldStats } from '@/lib/soldComps/types';
import type { PlatformKey } from '@/lib/types';

const fmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

export default function TailStep({ draft, patch, advance, busy }: StepProps) {
  const isReseller = draft.persona === 'reseller';
  const [submittedCloset, setSubmittedCloset] = useState(false);

  // Reseller: comp the thing they are sourcing. Buyer: comp something they own.
  const compQuery = isReseller ? draft.query : submittedCloset ? draft.closetQuery : '';
  const { data, loading } = useSoldComps(compQuery || null);

  const [picked, setPicked] = useState<PlatformSoldStats | null>(null);
  const stats = picked ?? data?.platforms[0] ?? null;
  const [buyPrice, setBuyPrice] = useState('');

  const buy = Number(buyPrice);
  const flip =
    stats && Number.isFinite(buy) && buy > 0
      ? netFlipProfit({
          sourcingPrice: buy,
          resalePrice: stats.medianPrice,
          platform: stats.platform as PlatformKey,
        })
      : null;

  return (
    <div>
      <h1 className="text-2xl font-semibold" style={{ color: 'var(--text)' }}>
        {isReseller ? 'What these actually sell for' : 'Got anything sitting in your closet?'}
      </h1>
      <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
        {isReseller
          ? 'Completed sales, per marketplace. Asking prices tell you what sellers want; these tell you what buyers paid.'
          : 'Type something you own. We will show you what it has been selling for.'}
      </p>

      {!isReseller && !submittedCloset && (
        <div className="mt-6">
          <input
            value={draft.closetQuery}
            onChange={(e) => patch({ closetQuery: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && draft.closetQuery.trim()) setSubmittedCloset(true);
            }}
            placeholder="e.g. north face nuptse"
            maxLength={200}
            className="w-full rounded-xl px-4 py-3 text-sm outline-none"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
          />
          <button
            type="button"
            disabled={!draft.closetQuery.trim()}
            onClick={() => setSubmittedCloset(true)}
            className="mt-3 w-full rounded-xl px-4 py-3 text-sm font-medium disabled:opacity-50"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            Check it
          </button>
        </div>
      )}

      {loading && (
        <p className="mt-6 text-sm" style={{ color: 'var(--text-dim)' }}>
          Checking completed sales…
        </p>
      )}

      {!loading && compQuery && data?.available && (
        <div className="mt-6">
          <SoldCompsPanel
            platforms={data.platforms}
            selected={stats?.platform ?? null}
            onSelect={setPicked}
          />

          <div className="mt-4">
            <label className="block text-xs" style={{ color: 'var(--text-dim)' }}>
              {isReseller ? 'What would you pay for it?' : 'What did you pay for it?'}
            </label>
            <input
              inputMode="decimal"
              value={buyPrice}
              onChange={(e) => setBuyPrice(e.target.value)}
              placeholder="0"
              className="mt-1 w-full rounded-xl px-4 py-3 text-sm outline-none"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
            />
          </div>

          {flip && stats && (
            <p className="mt-3 text-sm" style={{ color: 'var(--text)' }}>
              Sell at the {stats.platform} median of {fmt.format(stats.medianPrice)} and you keep{' '}
              <strong>{fmt.format(flip.payout)}</strong> after fees, netting{' '}
              <strong>{fmt.format(flip.netProfit)}</strong>.
            </p>
          )}
        </div>
      )}

      {!loading && compQuery && data && !data.available && (
        <p className="mt-6 text-sm" style={{ color: 'var(--text-dim)' }}>
          Not enough completed sales for that one yet. This works best on items with a steady
          resale market.
        </p>
      )}

      <button
        type="button"
        disabled={busy}
        onClick={advance}
        className="mt-8 w-full rounded-xl px-4 py-3 text-sm font-medium disabled:opacity-50"
        style={{ background: 'var(--accent)', color: '#fff' }}
      >
        {busy ? 'Finishing…' : 'Finish'}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Wire it into StepSwitch**

Add the import and case in `app/onboarding/OnboardingFlow.tsx`:

```tsx
import TailStep from './steps/TailStep';
```

```tsx
    case 'tail':
      return <TailStep {...rest} />;
```

- [ ] **Step 3: Confirm the sold-comps dependency is healthy first**

Run: `npx tsx scripts/verify-sold-comps.mts`
Expected: `ALL PASSED`. If it fails, the tail will render nothing and that is an upstream break, not a bug in this task. Report it and stop.

- [ ] **Step 4: Verify both tails, including the empty state**

1. Reseller path with `supreme box logo hoodie` → per-platform rows appear, each showing n and window. Enter a buy price → the net-profit line appears.
2. Buyer path → the closet input appears; enter `carhartt wip jacket` → same panel.
3. **Empty state:** run the flow with `zzzq nonexistent garment xyzzy` → the "not enough completed sales" line shows and **Finish still works**. This is the lockout scenario; it must pass.
4. Copy audit against §6b: confirm no "Mercari", no single blended median across platforms, no "what it actually sold for", no sell-through claim.

- [ ] **Step 5: Type check and report**

Run: `npx tsc --noEmit` → clean. `npx eslint app/onboarding` → clean.

---

## Task 7: Settings replay entry

**Files:**
- Modify: `app/(protected)/settings/page.tsx`

**Interfaces:**
- Consumes: `/onboarding?replay=1` from Task 2; the local `Row` component already defined at `app/(protected)/settings/page.tsx:42` with signature `Row({ label, sublabel, children }: { label: string; sublabel?: string; children: React.ReactNode })`.
- Produces: nothing consumed downstream.

- [ ] **Step 1: Read the surrounding rows**

Read `app/(protected)/settings/page.tsx` and find where existing `<Row>` elements are rendered. Match their section placement and spacing exactly rather than inventing a new style. Note `Row` is `flex-col … sm:flex-row` (a 2026-06-30 mobile-overflow fix) — do not alter it.

- [ ] **Step 2: Add the replay entry**

Add this `Row` alongside the existing ones:

```tsx
<Row label="Setup walkthrough" sublabel="Walk through alerts, criteria and sold prices again">
  <Link
    href="/onboarding?replay=1"
    className="rounded-xl px-3 py-2 text-sm"
    style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
  >
    Redo setup
  </Link>
</Row>
```

Add `import Link from 'next/link';` if the file does not already import it.

- [ ] **Step 3: Verify replay grants nothing and does not block**

1. With onboarding already complete, click **Redo setup** → `/onboarding?replay=1` loads at the `branch` step.
2. Navigate away mid-replay to `/search` → it loads. Replay must **not** be blocking, because the flag is already set.
3. Confirm no second alert was created unless you explicitly clicked the button, and `onboarding_completed_at` is simply refreshed, not duplicated.

- [ ] **Step 4: Type check and report**

Run: `npx tsc --noEmit` → clean. `npx eslint "app/(protected)/settings"` → clean.

---

## Task 8: Verification script extension and documentation

**Files:**
- Modify: `scripts/verify-onboarding.mts`
- Modify: `HANDOFF.md`
- Modify: `docs/planning/COMPETITIVE_POSITIONING.md`
- Modify: `docs/core/PITFALLS.md`

- [ ] **Step 1: Add live API checks to the verification script**

Append to `scripts/verify-onboarding.mts`:

```ts
console.log('\n=== live: onboarding endpoint is auth-gated ===');
{
  const base = process.env.VERIFY_BASE_URL ?? 'http://localhost:3000';
  const res = await fetch(`${base}/api/onboarding`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ step: 1 }),
  });
  check('unauthenticated PATCH returns 401', res.status === 401, `got ${res.status}`);
}
```

- [ ] **Step 2: Run the full verification**

Run (with `npm run dev` up): `npx tsx scripts/verify-onboarding.mts`
Expected: `ALL PASSED`.

- [ ] **Step 3: Prove the flow consumes zero searches (spec T8)**

This is the owner's hard constraint and the reason the flow hands off instead of searching. Verify it end to end, not by inspection.

Before a full run, with `mcp__supabase__execute_sql`:

```sql
select searches_used_this_period, search_credits
from public.profiles where email = '<your email>';
```

Reset `onboarding_completed_at` to null, complete the **entire** flow including a reseller tail that renders sold comps and a created alert. Do **not** press search on the page you land on. Then run the same query again.

Expected: `searches_used_this_period` and `search_credits` are **both unchanged**. If either moved, something in the flow is calling `/api/search` — find it and remove it before proceeding.

- [ ] **Step 4: Record the pitfall**

Add to `docs/core/PITFALLS.md` under the Auth/Infrastructure section:

```markdown
**Onboarding gate is blocking and lives in `(protected)/layout.tsx`.** While
`profiles.onboarding_completed_at` is null, every protected route redirects to
`/onboarding`. `/onboarding` is deliberately **outside** `app/(protected)/` so it
cannot catch itself — moving it inside creates an infinite redirect that locks every
user out of the entire app. Any new step added to the flow must advance even when its
upstream call fails, for the same reason.
```

- [ ] **Step 5: Update HANDOFF.md**

Change the "Onboarding flow DESIGNED (spec written, nothing built yet)" entry heading to reflect shipped status, and add to "Current state" a line naming the gate, the four `profiles.onboarding_*` columns, and the fact that the flow charges nothing.

- [ ] **Step 6: Update the positioning doc**

In `docs/planning/COMPETITIVE_POSITIONING.md`:
- §5 Step 2(a): change "DESIGNED 2026-08-10, not yet built" to shipped, with the date.
- §6c EXP-001: change from Queued to a full Running block using the template in that section, carrying over the primary metric (share completing onboarding who create ≥1 alert), the secondaries (first-session depth, 2nd-day return vs 27%), and the kill criterion verbatim from the spec.

- [ ] **Step 7: Free the ports**

Per `docs/reference/CLEANUP.md`, free ports 3000 and 8000 before finishing.

- [ ] **Step 8: Final verification**

Run: `npx tsc --noEmit` → clean. Run: `npm run build` → clean. Run: `npx tsx scripts/verify-onboarding.mts` → `ALL PASSED`. Run: `npx tsx scripts/verify-sold-comps.mts` → `ALL PASSED`.

Report to the owner the full change set and the outstanding manual checks: **T5 (email signup), T6 (Google OAuth signup), T11 (baseline email received), T12 (light + dark, 375px, no horizontal overflow)**.

---

## Owner-verified checks (not agent-completable)

These are in the spec's §9 and require a real browser and real inboxes:

| # | Check |
|---|---|
| T5 | New signup via email confirmation lands in onboarding with no `next` param involved |
| T6 | New signup via Google OAuth does the same — the path whose behaviour was previously assumed |
| T11 | Alert created in onboarding produces a real baseline email |
| T12 | Light + dark correct, 375px mobile, no horizontal overflow on any onboarding screen |
