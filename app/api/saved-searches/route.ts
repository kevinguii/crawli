import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { PLATFORM_DOMAINS } from '@/lib/types';
import { runAlert, SavedSearch } from '@/lib/alertRunner';
import { ALERT_EXCLUDED_PLATFORMS } from '@/lib/alertConstants';

const VALID_ALERT_PLATFORMS = Object.keys(PLATFORM_DOMAINS).filter(
  (p) => !ALERT_EXCLUDED_PLATFORMS.has(p),
) as [string, ...string[]];

const createSchema = z.object({
  query: z.string().min(1).max(200),
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
  // AND-only boolean sourcing criteria (brand AND size AND price<X), applied as
  // a post-filter in alertRunner. All fields optional; null/absent = no-op.
  criteria: z
    .object({
      brand: z.string().max(80).nullable().optional(),
      keywordsAll: z.array(z.string().max(40)).max(10).optional(),
      size: z.string().max(40).nullable().optional(),
      minPrice: z.number().nonnegative().nullable().optional(),
      maxPrice: z.number().nonnegative().nullable().optional(),
    })
    .partial()
    .nullable()
    .optional(),
  cadence_hours: z.literal(24),
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
    .select('subscription_status, searches_used_this_period, searches_period_start, max_saved_searches, min_alert_cadence_hours')
    .eq('id', user.id)
    .single();

  const maxAlerts = profile?.max_saved_searches ?? 1;
  const minCadence = profile?.min_alert_cadence_hours ?? 24;
  const isPro = profile?.subscription_status === 'active' || profile?.subscription_status === 'past_due';

  // Enforce cadence floor based on tier
  if (parsed.data.cadence_hours < minCadence) {
    return NextResponse.json(
      { error: 'cadence_not_allowed', message: `Your plan requires a minimum ${minCadence}hr cadence.` },
      { status: 403 },
    );
  }

  // Paused alerts don't occupy a slot — only active ones count toward the cap.
  const { count } = await supabase
    .from('saved_searches')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('paused', false);

  if ((count ?? 0) >= maxAlerts) {
    return NextResponse.json(
      {
        error: 'quota_exceeded',
        message: isPro
          ? `You've reached your limit of ${maxAlerts} saved alert${maxAlerts === 1 ? '' : 's'}. Pause or delete one to create another, or upgrade your plan for more.`
          : `Free includes ${maxAlerts} alert${maxAlerts === 1 ? '' : 's'}. Upgrade your plan to create more.`,
        limit: maxAlerts,
      },
      { status: 402 },
    );
  }

  // Quota check — first run costs 1 search
  const FREE_SEARCH_CAP = 10;
  const PRO_SEARCH_CAP = 100;
  const FREE_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;
  const cap = isPro ? PRO_SEARCH_CAP : FREE_SEARCH_CAP;
  let used = profile?.searches_used_this_period ?? 0;

  if (!isPro) {
    const periodStartMs = profile?.searches_period_start
      ? new Date(profile.searches_period_start).getTime()
      : 0;
    if (Date.now() - periodStartMs > FREE_PERIOD_MS) {
      await admin.from('profiles').update({
        searches_used_this_period: 0,
        searches_period_start: new Date().toISOString(),
      }).eq('id', user.id);
      used = 0;
    }
  }

  if (used >= cap) {
    return NextResponse.json(
      {
        error: 'search_quota_exceeded',
        message: isPro
          ? 'You have used all 100 searches for this billing period.'
          : 'You have used all 10 free searches this month.',
        used,
        cap,
      },
      { status: 402 },
    );
  }

  // Insert the row — next_run_at is now so the first run fires immediately.
  // The client-supplied next_run_at is the *anchored* next run (e.g. tomorrow 9 AM
  // local) — alertRunner will overwrite next_run_at after the first run completes.
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

  // Charge 1 quota for the first run
  await admin
    .from('profiles')
    .update({ searches_used_this_period: used + 1 })
    .eq('id', user.id);

  // Run first search immediately (silent — no notification sent)
  void runAlert(newRow as SavedSearch);

  return NextResponse.json(newRow, { status: 201 });
}
