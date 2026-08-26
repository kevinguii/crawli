import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { PLATFORM_DOMAINS } from '@/lib/types';
import { runAlert, SavedSearch } from '@/lib/alertRunner';
import { ALERT_EXCLUDED_PLATFORMS, findAlertQueryProblem } from '@/lib/alertConstants';
import { TIER_CAPS, resolveTier } from '@/lib/tierCaps';

const VALID_ALERT_PLATFORMS = Object.keys(PLATFORM_DOMAINS).filter(
  (p) => !ALERT_EXCLUDED_PLATFORMS.has(p),
) as [string, ...string[]];

const createSchema = z.object({
  query: z.string().min(1).max(200).refine(
    (q) => findAlertQueryProblem(q) === null,
    // An alert watches one thing. A list separator survives tokenizing as a
    // separate required anchor, so the alert could never match. Mirrors the
    // client-side guard in CreateAlertModal via the same shared function.
    { message: 'No symbols like , ; | / & + in an alert. Use plain words only.' },
  ),
  platforms: z.array(z.enum(VALID_ALERT_PLATFORMS)).min(1),
  filters: z
    .object({
      color: z.string().nullable().optional(),
      category: z.string().nullable().optional(),
      condition: z.string().nullable().optional(),
      size: z.string().nullable().optional(),
      minPrice: z.number().nullable().optional(),
      maxPrice: z.number().nullable().optional(),
    })
    .partial()
    .nullable()
    .optional(),
  // AND-only boolean sourcing criteria (size AND price<X), applied as
  // a post-filter in alertRunner. All fields optional; null/absent = no-op.
  criteria: z
    .object({
      size: z.string().max(40).nullable().optional(),
      minPrice: z.number().nonnegative().nullable().optional(),
      maxPrice: z.number().nonnegative().nullable().optional(),
    })
    .partial()
    .nullable()
    .optional(),
  cadence_hours: z.union([z.literal(24), z.literal(168)]),
  notify_timezone: z.string().max(64).optional(),
  next_run_at: z.string().datetime().optional(),
});

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('saved_searches')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.issues }, { status: 400 });
  }

  const admin = createAdminClient();

  // Check tier cap
  const { data: profile } = await admin
    .from('profiles')
    .select('subscription_status, subscription_tier, max_saved_searches, min_alert_cadence_hours')
    .eq('id', user.id)
    .single();

  const maxAlerts = profile?.max_saved_searches ?? TIER_CAPS.free.maxSavedSearches;
  const minCadence = profile?.min_alert_cadence_hours ?? TIER_CAPS.free.minAlertCadenceHours;
  const isPro = resolveTier(profile?.subscription_status, profile?.subscription_tier) !== 'free';

  // Enforce cadence floor based on tier
  if (parsed.data.cadence_hours < minCadence) {
    return NextResponse.json(
      { error: 'cadence_not_allowed', message: `Your plan requires a minimum ${minCadence}hr cadence.` },
      { status: 403 },
    );
  }

  // Paused alerts don't occupy a slot: only active ones count toward the cap.
  const { count } = await supabase
    .from('saved_searches')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('paused', false);

  if ((count ?? 0) >= maxAlerts) {
    // Pro alerts are marketed as "Unlimited" (see TIER_CAPS.pro.maxSavedSearches
    // in lib/tierCaps.ts) over a real backstop, same rule as /api/search: a paying
    // user must never be told to "upgrade your plan" (Pro is the top plan) and
    // landing on this cap for real should raise it rather than stay silent about
    // it. `isPro` here also covers legacy `max` accounts, which is correct: no
    // paid tier should ever see upgrade copy at its own ceiling.
    if (isPro) {
      console.warn(
        `[quota] PAID user hit the alerts abuse backstop: user=${user.id} count=${count} cap=${maxAlerts}. ` +
        `Raise TIER_CAPS.pro.maxSavedSearches or drop the "Unlimited" copy.`,
      );
    }
    return NextResponse.json(
      {
        error: 'quota_exceeded',
        message: isPro
          ? 'You have hit an unusually high number of saved alerts, so we have paused new ones as an anti-abuse check. Get in touch and we will lift it right away.'
          : `Free includes ${maxAlerts} alert${maxAlerts === 1 ? '' : 's'}. Upgrade your plan to create more.`,
        limit: maxAlerts,
      },
      { status: 402 },
    );
  }

  // Insert the row: next_run_at is now so the first run fires immediately.
  // The client-supplied next_run_at is the *anchored* next run (e.g. tomorrow 9 AM
  // local): alertRunner will overwrite next_run_at after the first run completes.
  const { data: newRow, error: insertErr } = await supabase
    .from('saved_searches')
    .insert({
      user_id: user.id,
      query: parsed.data.query,
      platforms: parsed.data.platforms,
      filters: parsed.data.filters ?? null,
      criteria: parsed.data.criteria ?? null,
      cadence_hours: parsed.data.cadence_hours,
      notify_timezone: parsed.data.notify_timezone ?? null,
      next_run_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (insertErr || !newRow) {
    return NextResponse.json({ error: insertErr?.message ?? 'insert failed' }, { status: 500 });
  }

  // Run first search immediately (silent: no notification sent)
  void runAlert(newRow as SavedSearch);

  return NextResponse.json(newRow, { status: 201 });
}
