import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { runAlert, SavedSearch } from '@/lib/alertRunner';

const patchSchema = z.object({
  query: z.string().min(1).max(200),
  platforms: z.array(z.string()).min(1),
  filters: z.record(z.string(), z.unknown()).nullable(),
  criteria: z.record(z.string(), z.unknown()).nullable(),
  cadence_hours: z.literal(24),
  paused: z.boolean(),
}).partial();

// Fields whose change invalidates the alert's baseline (last_seen_urls was built
// from the OLD query's results). Editing any of these = a fresh baseline search,
// metered exactly like creating a new alert.
const BASELINE_FIELDS = ['query', 'platforms', 'filters', 'criteria'] as const;

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

  // Block unpause if it would push the user over their active-alert cap.
  if (parsed.data.paused === false && current.paused === true) {
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from('profiles')
      .select('max_saved_searches')
      .eq('id', user.id)
      .single();
    const maxAlerts = profile?.max_saved_searches ?? 2;

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
  // edit). No re-run, no charge — just apply the fields.
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

  // Baseline-invalidating edit: charge 1 search and re-run, mirroring creation
  // (app/api/saved-searches/route.ts). The new query needs a fresh baseline so
  // the next run doesn't flood the user with results that are only "new"
  // relative to the OLD query.
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('searches_used_this_period, searches_period_start, max_searches_per_period')
    .eq('id', user.id)
    .single();

  const cap = profile?.max_searches_per_period ?? 5;
  const RESET_PERIOD_MS = 7 * 24 * 60 * 60 * 1000;
  let used = profile?.searches_used_this_period ?? 0;
  const periodStartMs = profile?.searches_period_start
    ? new Date(profile.searches_period_start).getTime()
    : 0;
  if (Date.now() - periodStartMs > RESET_PERIOD_MS) {
    await admin.from('profiles').update({
      searches_used_this_period: 0,
      searches_period_start: new Date().toISOString(),
    }).eq('id', user.id);
    used = 0;
  }

  if (used >= cap) {
    return NextResponse.json(
      {
        error: 'search_quota_exceeded',
        message: `You have used all ${cap} searches for this period. Editing an alert's query uses 1 search.`,
        used,
        cap,
      },
      { status: 402 },
    );
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
    })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();
  if (updErr || !updated) {
    return NextResponse.json({ error: updErr?.message ?? 'update failed' }, { status: 500 });
  }

  // The old query's stored matches are now stale — drop them so the user doesn't
  // see listings that don't match the new search.
  await admin.from('alert_matches').delete().eq('alert_id', id);

  // Charge 1 search for the fresh baseline run.
  await admin
    .from('profiles')
    .update({ searches_used_this_period: used + 1 })
    .eq('id', user.id);

  // Re-run immediately (silent baseline seed — last_seen_urls is null).
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
