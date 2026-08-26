import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { runAlert, SavedSearch } from '@/lib/alertRunner';
import { FREE_BASELINE_EDIT_COOLDOWN_HOURS, findAlertQueryProblem } from '@/lib/alertConstants';
import { TIER_CAPS } from '@/lib/tierCaps';

const patchSchema = z.object({
  query: z.string().min(1).max(200).refine(
    (q) => findAlertQueryProblem(q) === null,
    // An alert watches one thing. A list separator survives tokenizing as a
    // separate required anchor, so the alert could never match. Mirrors the
    // client-side guard in CreateAlertModal via the same shared function.
    { message: 'No symbols like , ; | / & + in an alert. Use plain words only.' },
  ),
  platforms: z.array(z.string()).min(1),
  filters: z.record(z.string(), z.unknown()).nullable(),
  criteria: z.record(z.string(), z.unknown()).nullable(),
  cadence_hours: z.union([z.literal(24), z.literal(168)]),
  paused: z.boolean(),
}).partial();

// Fields whose change invalidates the alert's baseline (last_seen_urls was built
// from the OLD query's results). Editing any of these = a fresh baseline search,
// metered exactly like creating a new alert.
const BASELINE_FIELDS = ['query', 'platforms', 'filters', 'criteria'] as const;

// Single-alert fetch for the /alerts/[id] matches page (loaded standalone,
// so it can't rely on the list already being in memory like the old modal did).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('saved_searches')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.issues }, { status: 400 });
  }

  // Load the current row (also confirms ownership).
  const { data: current, error: loadErr } = await supabase
    .from('saved_searches')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();
  if (loadErr || !current) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  // Did the edit actually change any baseline field? (PATCH semantics: only
  // fields present in the body are considered; identical values are a no-op.)
  const baselineChanged = BASELINE_FIELDS.some(
    (f) => f in parsed.data &&
      JSON.stringify(parsed.data[f] ?? null) !== JSON.stringify(current[f] ?? null),
  );

  // Enforce the cadence floor on edit, not just on create. POST has always
  // checked this; PATCH did not, so a free user could create a weekly alert and
  // immediately edit it to daily. Only checked when the edit actually changes
  // cadence, so grandfathered alerts already on a faster cadence keep working
  // until their owner touches that field.
  if (
    parsed.data.cadence_hours !== undefined &&
    parsed.data.cadence_hours !== current.cadence_hours
  ) {
    const admin = createAdminClient();
    const { data: cadenceProfile } = await admin
      .from('profiles')
      .select('min_alert_cadence_hours')
      .eq('id', user.id)
      .single();
    const minCadence =
      cadenceProfile?.min_alert_cadence_hours ?? TIER_CAPS.free.minAlertCadenceHours;
    if (parsed.data.cadence_hours < minCadence) {
      return NextResponse.json(
        {
          error: 'cadence_not_allowed',
          message: `Your plan requires a minimum ${minCadence}hr cadence.`,
        },
        { status: 403 },
      );
    }
  }

  // Block unpause if it would push the user over their active-alert cap.
  if (parsed.data.paused === false && current.paused === true) {
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from('profiles')
      .select('max_saved_searches')
      .eq('id', user.id)
      .single();
    const maxAlerts = profile?.max_saved_searches ?? TIER_CAPS.free.maxSavedSearches;

    const { count } = await supabase
      .from('saved_searches')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('paused', false);

    if ((count ?? 0) >= maxAlerts) {
      return NextResponse.json(
        {
          error: 'quota_exceeded',
          message: `You've reached your limit of ${maxAlerts} active alert${maxAlerts === 1 ? '' : 's'}. Pause or delete another alert first.`,
        },
        { status: 402 },
      );
    }
  }

  // Simple path: nothing baseline-invalidating changed (pause toggle, no-op
  // edit). No re-run, no charge: just apply the fields.
  if (!baselineChanged) {
    const { data, error } = await supabase
      .from('saved_searches')
      .update(parsed.data)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  // Baseline-invalidating edit: reset the baseline and re-run so the next
  // scheduled run doesn't flood the user with results that are only "new"
  // relative to the OLD query. No search credit is charged: the re-run is
  // in-house crawl4ai only (eBay, the sole Firecrawl-metered platform, is
  // excluded from alerts). Free tier is rate-limited by a per-alert cooldown;
  // paid tiers are uncapped.
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('subscription_status')
    .eq('id', user.id)
    .single();

  const isPro =
    profile?.subscription_status === 'active' ||
    profile?.subscription_status === 'past_due';

  if (!isPro && current.last_baseline_edit_at) {
    const elapsedMs =
      Date.now() - new Date(current.last_baseline_edit_at).getTime();
    const cooldownMs = FREE_BASELINE_EDIT_COOLDOWN_HOURS * 60 * 60 * 1000;
    if (elapsedMs < cooldownMs) {
      const hoursLeft = Math.ceil((cooldownMs - elapsedMs) / (60 * 60 * 1000));
      return NextResponse.json(
        {
          error: 'edit_cooldown',
          message: `You can change this alert's search again in ~${hoursLeft}h. Upgrade for unlimited edits.`,
          retry_after_hours: hoursLeft,
        },
        { status: 429 },
      );
    }
  }

  // Apply the edit AND reset the baseline so runAlert treats this as a first run.
  const { data: updated, error: updErr } = await supabase
    .from('saved_searches')
    .update({
      ...parsed.data,
      last_seen_urls: null,
      last_run_at: null,
      unread_match_count: 0,
      next_run_at: new Date().toISOString(),
      last_baseline_edit_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();
  if (updErr || !updated) {
    return NextResponse.json({ error: updErr?.message ?? 'update failed' }, { status: 500 });
  }

  // The old query's stored matches AND run history are now stale: drop both so
  // the user doesn't see listings/dates that don't belong to the new search.
  // notifications first (alert_matches.notification_id cascades), then
  // alert_matches by alert_id as a belt-and-braces for any orphaned rows.
  await admin.from('notifications').delete().eq('alert_id', id);
  await admin.from('alert_matches').delete().eq('alert_id', id);

  // Re-run immediately (silent baseline seed: last_seen_urls is null).
  void runAlert(updated as SavedSearch);

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { error } = await supabase
    .from('saved_searches')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new Response(null, { status: 204 });
}
